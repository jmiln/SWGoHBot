import assert from "node:assert";
import { describe, it } from "node:test";
import { GOVERNOR, PRIORITY_COUNT, type Priority, RATE, UPSTREAM_TIMEOUT_MS } from "../../data/constants/swapiServe.ts";
import { Dispatcher } from "../../services/swapiServe/dispatcher.ts";
import type { Forwarder } from "../../services/swapiServe/forwarder.ts";
import { Governor } from "../../services/swapiServe/governor.ts";
import { FakeClock } from "../helpers/fakeClock.ts";

// Deterministic PRNG so a failure can be replayed exactly from the seed in the message.
function makeRandom(seed: number): () => number {
    let state = seed >>> 0;
    return () => {
        state = (state * 1664525 + 1013904223) >>> 0;
        return state / 0x100000000;
    };
}

// Several seeds rather than one, because a single seed pins one interleaving and every property
// here is about interleavings. Kept small enough that the whole file stays well inside the suite's
// time budget; the workload size matters less than the number of distinct orderings tried.
const SEEDS = [20260807, 981, 44_711];
const REQUEST_COUNT = 2_000;

// Real traffic hits a dozen comlink paths, not one per request. Using unique URIs here would
// inflate the per-endpoint cost map to REQUEST_COUNT entries and make every status() call scan
// it, which measures the test harness rather than the scheduler. Request identity travels in the
// body instead.
const ENDPOINTS = ["/player", "/guild", "/playerArenaProfile", "/data", "/metadata"];

interface WorkloadOptions {
    seed: number;
    requestCount?: number;
    /**
     * Submission index at which every response starts failing, until every breaker has opened.
     *
     * Without an outage the failure mix never produces the CIRCUIT_OPEN_AFTER_FAILURES consecutive
     * failures a breaker needs, and the whole open/half-open/closed path goes untested by this file.
     * It ends on the breakers opening rather than at a fixed point because the two are not
     * interchangeable: a failing backend has its rate halved down to one token per two seconds, so a
     * window measured in submissions or in milliseconds delivers almost no requests and the breaker
     * never trips. Ending it on the state actually being reached is what makes this independent of
     * how hard AIMD happens to clamp down.
     */
    storm?: { from: number };
}

interface WorkloadResult {
    settledCount: number;
    drained: boolean;
    /** Set when the run stopped making progress, which is what a wedged scheduler looks like. */
    stalled: boolean;
    /** How many requests had settled when the stall was detected. */
    stalledAtSettled: number;
    results: { status: number }[];
    status: ReturnType<Dispatcher["status"]>;
    concurrentDuplicate: string | null;
    dispatchedAfterSettle: string | null;
    dispatchedAfterCancel: string | null;
    negativeAccounting: boolean;
    /** Backends whose in-flight accounting disagreed with what was really in flight. */
    accountingMismatch: string | null;
    /** Circuit states each backend was observed in, in the order first seen. */
    statesSeen: Map<string, string[]>;
}

/**
 * Drives one randomised workload to completion and returns everything the assertions need.
 *
 * Extracted so the same invariants can be checked against different traffic shapes without
 * restating them: an ordinary mix, and one containing a total outage. A property that only holds
 * for the happy mix is not a property.
 */
async function runWorkload({ seed, requestCount = REQUEST_COUNT, storm }: WorkloadOptions): Promise<WorkloadResult> {
    const random = makeRandom(seed);
    const clock = new FakeClock();

    // A retry is a legitimate second dispatch of the same request, so "dispatched twice" is
    // not by itself a defect. What must never happen is a request in flight twice at once,
    // or dispatched again after it has already been answered.
    const inFlightIds = new Set<string>();
    const settledIds = new Set<string>();
    const cancelledIds = new Set<string>();

    let concurrentDuplicate: string | null = null;
    let dispatchedAfterSettle: string | null = null;
    let dispatchedAfterCancel: string | null = null;
    let concurrent = 0;
    let negativeAccounting = false;
    let accountingMismatch: string | null = null;

    // Live count of requests actually at each backend, against which the governor's own in-flight
    // number is checked below.
    const liveByBackend = new Map<string, number>();
    const statesSeen = new Map<string, string[]>();
    let submitted = 0;

    let dispatcher: Dispatcher | null = null;

    let stormActive = false;

    const recordState = (): void => {
        const backends = dispatcher?.status().backends ?? [];
        for (const backend of backends) {
            const seen = statesSeen.get(backend.url) ?? [];
            if (seen[seen.length - 1] !== backend.state) {
                seen.push(backend.state);
                statesSeen.set(backend.url, seen);
            }
        }
        // The outage lasts exactly as long as it takes to trip every breaker, then lifts so recovery
        // is part of the same run.
        if (stormActive && backends.length > 0 && backends.every((backend) => statesSeen.get(backend.url)?.includes("open"))) {
            stormActive = false;
        }
    };

    const forwarder: Forwarder = async (backendUrl, request) => {
        const id = request.body ? String(JSON.parse(request.body.toString()).id) : "";
        if (inFlightIds.has(id)) concurrentDuplicate = id;
        if (settledIds.has(id)) dispatchedAfterSettle = id;
        if (cancelledIds.has(id)) dispatchedAfterCancel = id;
        inFlightIds.add(id);

        // The governor must never believe FEWER requests are in flight than really are: its count
        // is what caps concurrency, so undercounting is how the cap gets exceeded, and it is what a
        // premature or duplicated slot release looks like from here.
        //
        // Deliberately a lower bound rather than equality. A request keeps its slot until its
        // outcome is reported, which happens a microtask after this function returns, so the
        // governor legitimately counts requests whose forwarder has already finished. The matching
        // leak check (nothing left behind) is asserted once everything has drained.
        const live = (liveByBackend.get(backendUrl) ?? 0) + 1;
        liveByBackend.set(backendUrl, live);
        const governed = dispatcher?.status().backends.find((backend) => backend.url === backendUrl);
        if (governed && governed.inFlight < live) {
            accountingMismatch = `${backendUrl}: governor says ${governed.inFlight} in flight, ${live} really are`;
        }
        // A slot is only granted while inFlight is below the limit, and the half-open probe is the
        // one dispatch allowed to ignore it, so nothing can ever put more than one request past the
        // ceiling however the limit moves underneath it.
        if (live > GOVERNOR.MAX_LIMIT + 1) {
            accountingMismatch = `${backendUrl}: ${live} concurrent requests, past the ceiling of ${GOVERNOR.MAX_LIMIT} + 1 probe`;
        }

        // Sampled here as well as between clock steps, because half-open exists only while its
        // probe is in flight: it opens in acquire and closes when the probe reports, which on a
        // fake clock is inside a single flush. A sampler that only looks between steps therefore
        // records closed -> open -> closed and cannot tell a legal recovery from a state machine
        // that skipped the probe entirely. Inside the forwarder, a probe is by definition running.
        recordState();

        concurrent++;
        const roll = random();
        concurrent--;
        if (concurrent < 0) negativeAccounting = true;
        inFlightIds.delete(id);
        liveByBackend.set(backendUrl, (liveByBackend.get(backendUrl) ?? 1) - 1);

        // A total outage while the storm is running: this is what drives the breakers through open
        // and back to closed, and what puts stragglers in flight at the moment one trips, which is
        // the state probe attribution has to get right.
        if (stormActive) {
            return { status: 503, headers: {}, body: Buffer.from(JSON.stringify({ message: "Service Unavailable" })) };
        }

        // Every failure mode fires, but at rates a real backend might plausibly show. A
        // sustained double-digit hard-failure rate drives AIMD to its floor and keeps it
        // there, which is correct behaviour but means the run measures the controller's
        // minimum throughput rather than the scheduler's correctness.
        if (roll < 0.02) return { status: 429, headers: {}, body: Buffer.from(JSON.stringify({ message: "Too Many Requests" })) };
        if (roll < 0.04) return { status: 500, headers: {}, body: Buffer.from(JSON.stringify({ message: "boom" })) };
        if (roll < 0.05) return { status: undefined, headers: {}, body: Buffer.alloc(0) };
        if (roll < 0.08) return { status: 400, headers: {}, body: Buffer.from(JSON.stringify({ message: "Failed to find ally code 1" })) };
        return { status: 200, headers: {}, body: Buffer.from(JSON.stringify({ ok: true })) };
    };

    dispatcher = new Dispatcher({
        backends: ["sim://a", "sim://b"],
        accessKey: "a",
        secretKey: "s",
        forwarder,
        clock,
        retryDelayMs: 5,
        // High so pacing is not the thing under test: this is about correctness of the state
        // machine, and the simulation suite already covers convergence.
        ratePerSecond: 1000,
        startLimit: 30,
        depthLimits: [50_000, 50_000, 50_000, 50_000, 50_000],
    });

    const settled: Promise<{ status: number }>[] = [];
    let settledCount = 0;

    for (let i = 0; i < requestCount; i++) {
        submitted = i;
        if (storm && i === storm.from) stormActive = true;
        const priority = Math.floor(random() * PRIORITY_COUNT) as Priority;
        const id = String(i);
        const uri = ENDPOINTS[i % ENDPOINTS.length];

        // Three deadline bands, because the paths a request can leave by depend entirely on which
        // one it is in. A very short deadline exercises expiry under load. A deadline inside one
        // circuit-probe interval is the profile of the two user-facing tiers, and it is the only
        // band the dead-pool shed can act on: anything longer keeps its place through an outage by
        // design. Without this band the shed path went untested here, whatever the failure rate.
        const deadlineRoll = random();
        const deadlineMs = deadlineRoll < 0.1 ? 20 : deadlineRoll < 0.25 ? 12_000 : 3_600_000;

        const controller = new AbortController();
        settled.push(
            dispatcher
                .submit(
                    {
                        method: "POST",
                        uri,
                        body: Buffer.from(JSON.stringify({ id })),
                        priority,
                        deadline: clock.now() + deadlineMs,
                    },
                    controller.signal,
                )
                .then((response) => {
                    settledCount++;
                    settledIds.add(id);
                    return response;
                }),
        );

        // Cancel a slice of requests immediately after submitting them.
        if (random() < 0.08) {
            cancelledIds.add(id);
            controller.abort();
        }

        clock.advance(1);
        if (i % 100 === 0) {
            await clock.flush();
            recordState();
        }
    }

    submitted = requestCount;

    // Drain until every request has actually settled, NOT until the queue looks empty. A
    // request waiting out its retry backoff is not in any queue, so an empty queue is a false
    // completion signal: the loop would exit, the clock would stop, and the pending retry
    // timer would never fire.
    //
    // State is sampled every iteration rather than periodically, because a missed sample is a
    // missed transition: half-open in particular lasts only until the probe reports, and a coarse
    // sample would leave the legality check with gaps it cannot see.
    //
    // The loop gives up early once nothing has settled for a long stretch of virtual time, rather
    // than grinding out its whole budget. A wedged scheduler is exactly what this file is here to
    // catch, and it should say so in seconds: leaking a single backend slot makes the drain spin the
    // full budget, which took nearly four minutes and reported a file-level timeout instead of a
    // failed assertion. The longest legitimate gap between settles is a circuit-probe interval plus
    // a retry backoff, so this threshold is far beyond anything healthy.
    const STALL_LIMIT_MS = 120_000;
    let drained = false;
    let lastProgressAt = clock.now();
    let lastSettledCount = settledCount;
    let stalled = false;
    // Captured at the moment of the stall, because stop() settles everything still waiting and the
    // final count would otherwise read as a complete run.
    let stalledAtSettled = 0;

    for (let i = 0; i < 40_000; i++) {
        clock.advance(50);
        await clock.flush();
        recordState();
        if (settledCount === requestCount) {
            drained = true;
            break;
        }
        if (settledCount !== lastSettledCount) {
            lastSettledCount = settledCount;
            lastProgressAt = clock.now();
        } else if (clock.now() - lastProgressAt > STALL_LIMIT_MS) {
            stalled = true;
            stalledAtSettled = settledCount;
            break;
        }
    }

    // Cancel whatever is still outstanding so the awaited promises below can settle, otherwise a
    // detected stall turns into a hang in the assertions instead of a readable failure.
    if (!drained) dispatcher.stop();
    const results = await Promise.all(settled);
    recordState();
    const status = dispatcher.status();
    dispatcher.stop();

    return {
        settledCount,
        drained,
        stalled,
        stalledAtSettled,
        results,
        status,
        concurrentDuplicate,
        dispatchedAfterSettle,
        dispatchedAfterCancel,
        negativeAccounting,
        accountingMismatch,
        statesSeen,
    };
}

/** Every property that must hold whatever the traffic looked like. */
function assertUniversalInvariants(seed: number, run: WorkloadResult, requestCount: number): void {
    assert.strictEqual(run.concurrentDuplicate, null, `seed ${seed}: request in flight twice at once: ${run.concurrentDuplicate}`);
    assert.strictEqual(run.dispatchedAfterSettle, null, `seed ${seed}: request dispatched after it settled: ${run.dispatchedAfterSettle}`);
    assert.strictEqual(run.negativeAccounting, false, `seed ${seed}: in-flight accounting went negative`);
    assert.strictEqual(run.dispatchedAfterCancel, null, `seed ${seed}: cancelled request reached the backend: ${run.dispatchedAfterCancel}`);
    assert.strictEqual(run.accountingMismatch, null, `seed ${seed}: backend slot accounting drifted: ${run.accountingMismatch}`);

    assert.strictEqual(
        run.stalled,
        false,
        `seed ${seed}: the scheduler stopped making progress at ${run.stalledAtSettled}/${requestCount} settled. ` +
            `Queue depths ${JSON.stringify(run.status.queue.depths)}, blocked ${JSON.stringify(run.status.blocked)}, ` +
            `backends ${JSON.stringify(run.status.backends.map((backend) => ({ inFlight: backend.inFlight, limit: backend.limit, state: backend.state })))}. ` +
            "A backend holding slots it is not using is the usual cause.",
    );
    assert.ok(
        run.drained,
        `seed ${seed}: only ${run.settledCount} of ${requestCount} requests settled; depths were ${JSON.stringify(run.status.queue.depths)}`,
    );
    assert.strictEqual(run.results.length, requestCount, `seed ${seed}: every request must reach a terminal state`);
    for (const result of run.results) {
        assert.ok(typeof result.status === "number", `seed ${seed}: every request must resolve with a status`);
    }

    // Exactly one terminal reason per request, and they must add up.
    const terminalTotal = Object.values(run.status.terminal).reduce((sum, count) => sum + count, 0);
    assert.strictEqual(terminalTotal, requestCount, `seed ${seed}: terminal reasons ${terminalTotal} != ${requestCount} requests`);

    for (const backend of run.status.backends) {
        assert.ok(backend.inFlight >= 0, `seed ${seed}: ${backend.url} reported negative in-flight`);
        // Everything has drained by now, so this is the "no slot was left behind" check rather
        // than a statement about capacity; the live comparison in the forwarder is what polices
        // the limit while work is actually running.
        assert.strictEqual(backend.inFlight, 0, `seed ${seed}: ${backend.url} still holds ${backend.inFlight} slots after draining`);
    }
}

/**
 * The scheduler is a concurrent state machine, and its likely bugs (a request dispatched twice,
 * accounting drifting negative, a cancelled request still reaching the backend) are exactly the
 * ones example-based tests miss. This drives a large randomised workload and asserts properties
 * that must hold on every run, on virtual time so the volume costs milliseconds.
 */
describe("swapiServe scheduler invariants", () => {
    for (const seed of SEEDS) {
        it(`holds every invariant across a large randomised workload (seed ${seed})`, async () => {
            const run = await runWorkload({ seed });
            assertUniversalInvariants(seed, run, REQUEST_COUNT);

            // The workload is meant to exercise every path; if one never fired the test is weaker
            // than it looks and the mix needs revisiting.
            assert.ok(run.status.terminal.completed > 0, `seed ${seed}: no request completed normally`);
            assert.ok(run.status.terminal.cancelled > 0, `seed ${seed}: the cancellation path never ran`);
            assert.ok(run.status.terminal.deadline > 0, `seed ${seed}: the expiry path never ran`);
            assert.ok(run.status.retries > 0, `seed ${seed}: the retry path never ran`);
        });
    }

    // The ordinary mix never produces CIRCUIT_OPEN_AFTER_FAILURES consecutive failures, so without
    // a deliberate outage the breaker, its probe, and recovery are untouched by this file. That is
    // the part of the design where a wrong state transition is least visible and most expensive: it
    // decides how long an outage lasts after the backend itself is healthy again.
    it("holds every invariant across an outage that opens the breakers and recovers", async () => {
        const seed = SEEDS[0];
        const requestCount = 1_200;
        const run = await runWorkload({ seed, requestCount, storm: { from: 300, until: 700 } });

        assertUniversalInvariants(seed, run, requestCount);

        for (const [url, states] of run.statesSeen) {
            assert.ok(states.includes("open"), `seed ${seed}: ${url} never opened its breaker, so the outage path did not run`);
            // Recovery is the half that matters: a breaker that opens and stays open is an outage
            // that outlives its cause, and nothing else in the suite would notice.
            assert.strictEqual(states[states.length - 1], "closed", `seed ${seed}: ${url} ended on ${states[states.length - 1]}`);
            for (const [i, state] of states.entries()) {
                const previous = states[i - 1];
                if (previous === undefined) continue;
                const legal =
                    (previous === "closed" && state === "open") ||
                    (previous === "open" && state === "half-open") ||
                    (previous === "half-open" && (state === "closed" || state === "open"));
                assert.ok(legal, `seed ${seed}: ${url} made an illegal transition ${previous} -> ${state} in ${states.join(" -> ")}`);
            }
        }

        assert.ok(
            run.status.terminal.backend_unavailable > 0,
            `seed ${seed}: the outage never shed anything, so the dead-pool path did not run`,
        );
    });
});

/**
 * The breaker's probe, driven directly, because the invariants that matter about it are not
 * observable from outside the governor.
 *
 * A probe is one specific request. Requests dispatched before the breaker opened can still be in
 * flight when it probes, so the governor cannot infer which outcome belongs to the probe and the
 * caller has to tell it. These properties are what stop that contract rotting: they hold for any
 * interleaving of stragglers, probes, and recoveries rather than for the handful the example tests
 * pin down.
 */
describe("swapiServe.Governor state machine invariants", () => {
    const HEALTHY_OUTCOMES = ["ok", "ok", "ok", "not_found", "rejected"] as const;
    const FAILING_OUTCOMES = ["server_error", "throttled", "transport_failure"] as const;

    // Long enough that a run of failures reliably reaches CIRCUIT_OPEN_AFTER_FAILURES. Leaving it
    // to the random mix does not work: consecutiveFailures resets on any healthy outcome, so ten in
    // a row is rare enough that some seeds never open a breaker at all and the test silently
    // proves nothing. Alternating phases keeps the randomness where it matters, which is the order
    // acquires and reports interleave, not whether the outage happens.
    const PHASE_STEPS = 150;

    // Durations are production's, uncompressed. Compressing the probe interval looks tempting for
    // speed and quietly breaks the test: at 15s the interval comfortably exceeds the two seconds a
    // collapsed backend needs to earn a token, so a probe fires as soon as it is due, but shrink the
    // interval to a second and the probe is waiting on a token that has not refilled yet, so it
    // barely ever runs. The relationships between these constants are the thing under test, so they
    // are left alone and the step size is what gets tuned instead.
    const STEP_MS = 400;
    const STRAGGLER_LIFETIME_MS = UPSTREAM_TIMEOUT_MS;
    const PROBE_LIFETIME_MS = GOVERNOR.CIRCUIT_PROBE_INTERVAL_MS * 3;
    // Fine steps mean the token bucket, not the step count, decides how many requests get out, so
    // the budget has to be generous enough to cover many breaker cycles. It is all in-memory work.
    const STEPS = 30_000;
    const LEARNED_LIMIT = 40;

    for (const seed of [7, 31_337]) {
        it(`never runs two probes at once, whatever the interleaving (seed ${seed})`, () => {
            const random = makeRandom(seed);
            const url = "sim://a";
            const governor = new Governor([url]);

            // Slots taken but not yet reported, each remembering whether it was the probe, so a
            // report can be paired with the acquire that produced it exactly as the dispatcher
            // pairs them.
            //
            // `dueAt` is what makes this resemble a real backend rather than a queue of tokens.
            // Requests do not come back in a uniform trickle: a wedged backend holds some for the
            // full upstream timeout, and a probe sent to test one is itself likely to be slow,
            // because slow is what is wrong with it. Both are needed here. A probe that is still
            // outstanding when the breaker next becomes eligible to probe is the state the whole
            // isProbe contract exists for, and with uniformly short-lived slots it never occurs.
            const outstanding: { isProbe: boolean; dueAt: number }[] = [];
            let now = 0;
            let probesOutstanding = 0;
            let maxProbesOutstanding = 0;
            let probeWhileClosed = 0;
            let openedAndProbed = 0;
            let stragglerDuringProbe = 0;

            for (let step = 0; step < STEPS; step++) {
                // At the start of each healthy stretch, put the backend back where a recovered one
                // would be: a learned limit and rate well above the floor. Without this the driver
                // never reaches the state being defended against. A token-starved backend can only
                // open its breaker once its own stragglers report, since nothing else is left to
                // fail, so the stragglers are always gone by the time it probes. Production opens a
                // breaker the other way round: a backend carrying dozens of requests fails ten of
                // them fast while a hung one is still hanging, and that is the overlap that makes
                // probe attribution matter at all.
                if (step % (PHASE_STEPS * 2) === 0) {
                    governor.setLimit(url, LEARNED_LIMIT);
                    governor.setRate(url, RATE.MAX_PER_SEC);
                }
                // Small steps, deliberately. Report pressure is measured in steps while the probe
                // interval is measured in time, so coarse steps quietly destroy the case this test
                // exists for: with big jumps, the ten failures that open a breaker take a minute of
                // virtual time, every straggler has timed out before the probe goes, and the probe
                // is then the only thing in flight. Fine steps let a straggler outlive the interval
                // and still be at the backend when the probe is dispatched, which is what actually
                // happens when a backend hangs, and is the only way to reach the state where the
                // governor has to be told which outcome belongs to the probe.
                now += Math.floor(random() * STEP_MS);

                // Acquire sometimes, report sometimes, so stragglers accumulate and outlive the
                // state changes that happen while they are in flight.
                if (random() < 0.55) {
                    const stateBefore = governor.snapshot()[0].state;
                    const acquired = governor.acquire(now);
                    if (acquired.url) {
                        const isProbe = acquired.isProbe === true;
                        if (isProbe) {
                            probesOutstanding++;
                            maxProbesOutstanding = Math.max(maxProbesOutstanding, probesOutstanding);
                            if (stateBefore === "closed") probeWhileClosed++;
                            openedAndProbed++;
                        }
                        const lifetime = isProbe
                            ? random() * PROBE_LIFETIME_MS
                            : random() < 0.15
                              ? STRAGGLER_LIFETIME_MS
                              : random() * STEP_MS;
                        outstanding.push({ isProbe, dueAt: now + Math.floor(lifetime) });
                    }
                } else if (outstanding.length > 0) {
                    // Only slots whose response is actually due, and among those in a random order
                    // rather than FIFO: a straggler coming back long after a probe was dispatched is
                    // the whole case being defended against.
                    const due = outstanding.filter((slot) => slot.dueAt <= now);
                    if (due.length === 0) continue;
                    const slot = due[Math.floor(random() * due.length)];
                    outstanding.splice(outstanding.indexOf(slot), 1);
                    if (slot.isProbe) probesOutstanding--;
                    else if (probesOutstanding > 0) stragglerDuringProbe++;
                    const failing = Math.floor(step / PHASE_STEPS) % 2 === 1;
                    const outcomes = failing ? FAILING_OUTCOMES : HEALTHY_OUTCOMES;
                    const outcome = outcomes[Math.floor(random() * outcomes.length)];
                    governor.report(url, outcome, now, slot.isProbe);
                }

                const snapshot = governor.snapshot()[0];
                assert.ok(snapshot.inFlight >= 0, `seed ${seed}: step ${step}: in-flight went negative`);
                assert.strictEqual(
                    snapshot.inFlight,
                    outstanding.length,
                    `seed ${seed}: step ${step}: governor holds ${snapshot.inFlight} slots, ${outstanding.length} are outstanding`,
                );
                assert.ok(probesOutstanding <= 1, `seed ${seed}: step ${step}: ${probesOutstanding} probes outstanding at once`);
            }

            assert.ok(openedAndProbed > 0, `seed ${seed}: the breaker never probed, so this proved nothing`);
            // Reachability, asserted rather than assumed. The interesting region here is narrow and
            // easy to tune out of by accident: every earlier version of this driver ran thousands of
            // steps, opened dozens of breakers, and never once had a straggler report while a probe
            // was in flight, which is the only case that can tell a correct implementation from one
            // that infers the probe from the backend instead of being told. A run that never gets
            // there passes vacuously, so it fails here instead.
            assert.ok(
                stragglerDuringProbe > 0,
                `seed ${seed}: no unrelated request ever reported while a probe was outstanding, so probe attribution went untested`,
            );
            assert.strictEqual(maxProbesOutstanding, 1, `seed ${seed}: expected exactly one probe at a time, saw ${maxProbesOutstanding}`);
            assert.strictEqual(probeWhileClosed, 0, `seed ${seed}: a closed breaker dispatched ${probeWhileClosed} probes`);
        });
    }

    // Liveness: the property that stops "temporarily unavailable" becoming "dead until restart".
    // Checked for every outcome that can open a breaker, since each takes its own path through
    // report() and any one of them could strand the state machine on its own.
    for (const outcome of ["server_error", "throttled", "transport_failure"] as const) {
        it(`returns an open breaker to half-open after ${outcome}, however long it has been open`, () => {
            const url = "sim://a";
            const governor = new Governor([url]);

            for (let i = 0; i < GOVERNOR.CIRCUIT_OPEN_AFTER_FAILURES; i++) governor.report(url, outcome, 0);
            assert.strictEqual(governor.snapshot()[0].state, "open", `${outcome} should have opened the breaker`);

            // Long enough that any accumulated cooldown or rate collapse has been waited out, so a
            // refusal here would mean the state machine, not pacing.
            const probeAt = GOVERNOR.CIRCUIT_PROBE_INTERVAL_MS * 100;
            const probe = governor.acquire(probeAt);

            assert.strictEqual(probe.url, url, `${outcome} left the breaker permanently open`);
            assert.strictEqual(probe.isProbe, true, `${outcome} re-admitted the backend without probing it`);
        });
    }
});
