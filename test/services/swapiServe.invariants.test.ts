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

// Several seeds rather than one: a single seed pins one interleaving, and every property here is
// about interleavings. The number of distinct orderings matters more than the workload size.
const SEEDS = [20260807, 981, 44_711];
const REQUEST_COUNT = 2_000;

// Real traffic hits a dozen comlink paths, not one per request; unique URIs would inflate the
// per-endpoint cost map and measure the harness. Request identity travels in the body instead.
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

    // A retry is a legitimate second dispatch, so "dispatched twice" is not itself a defect. In
    // flight twice at once, or dispatched after being answered, is.
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

        // Undercounting in-flight requests is how the concurrency cap gets exceeded. A lower bound
        // rather than equality, since a slot is held until the outcome reports a microtask later.
        const live = (liveByBackend.get(backendUrl) ?? 0) + 1;
        liveByBackend.set(backendUrl, live);
        const governed = dispatcher?.status().backends.find((backend) => backend.url === backendUrl);
        if (governed && governed.inFlight < live) {
            accountingMismatch = `${backendUrl}: governor says ${governed.inFlight} in flight, ${live} really are`;
        }
        // Only the half-open probe may ignore the limit, so at most one request can sit over the
        // ceiling however the limit moves underneath it.
        if (live > GOVERNOR.MAX_LIMIT + 1) {
            accountingMismatch = `${backendUrl}: ${live} concurrent requests, past the ceiling of ${GOVERNOR.MAX_LIMIT} + 1 probe`;
        }

        // Sampled here too: half-open opens in acquire and closes when the probe reports, which on
        // a fake clock is one flush, so a between-steps sampler cannot see it happen at all.
        recordState();

        concurrent++;
        const roll = random();
        concurrent--;
        if (concurrent < 0) negativeAccounting = true;
        inFlightIds.delete(id);
        liveByBackend.set(backendUrl, (liveByBackend.get(backendUrl) ?? 1) - 1);

        // A total outage mid-storm is what drives the breakers open and back, and what leaves
        // stragglers in flight as one trips - the state probe attribution has to get right.
        if (stormActive) {
            return { status: 503, headers: {}, body: Buffer.from(JSON.stringify({ message: "Service Unavailable" })) };
        }

        // Every failure mode fires, at plausible rates: a sustained double-digit hard-failure rate
        // pins AIMD at its floor, which measures minimum throughput rather than correctness.
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
        if (storm && i === storm.from) stormActive = true;
        const priority = Math.floor(random() * PRIORITY_COUNT) as Priority;
        const id = String(i);
        const uri = ENDPOINTS[i % ENDPOINTS.length];

        // Three bands, since the exits a request can take depend on which it is in. The middle one
        // (inside a probe interval) is the only band the dead-pool shed can act on.
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

    // Drain on settles, not on an empty queue: a request waiting out its backoff is in no queue.
    // Sample every iteration, since half-open lasts only until the probe reports.
    // Bail out on a stall so a wedged scheduler fails in seconds instead of timing out the file.
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
    assert.strictEqual(
        run.dispatchedAfterCancel,
        null,
        `seed ${seed}: cancelled request reached the backend: ${run.dispatchedAfterCancel}`,
    );
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
        // Everything has drained, so this checks no slot was left behind rather than anything
        // about capacity; the forwarder's live comparison polices the limit during a run.
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
    // a deliberate outage the breaker, its probe and recovery all go untouched.
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

    // Long enough to reliably reach CIRCUIT_OPEN_AFTER_FAILURES: consecutiveFailures resets on any
    // healthy outcome, so a random mix leaves some seeds never opening a breaker at all.
    const PHASE_STEPS = 150;

    // Production durations, uncompressed - the ratios between them are what is under test. Shrink
    // the probe interval and probes start waiting on tokens that have not refilled. Tune STEP_MS.
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

            // `dueAt` gives slots varied lifetimes, which is what reaches the state the isProbe
            // contract exists for: a probe still outstanding when the breaker may probe again.
            const outstanding: { isProbe: boolean; dueAt: number }[] = [];
            let now = 0;
            let probesOutstanding = 0;
            let maxProbesOutstanding = 0;
            let probeWhileClosed = 0;
            let openedAndProbed = 0;
            let stragglerDuringProbe = 0;

            for (let step = 0; step < STEPS; step++) {
                // Restore a recovered backend's learned limit and rate, or it stays token-starved
                // and its stragglers have always reported by the time it probes.
                if (step % (PHASE_STEPS * 2) === 0) {
                    governor.setLimit(url, LEARNED_LIMIT);
                    governor.setRate(url, RATE.MAX_PER_SEC);
                }
                // Keep steps small: report pressure is counted in steps but the probe interval in
                // time, so coarse steps time every straggler out before the probe is dispatched.
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
                    // Random order rather than FIFO among the due slots: a straggler returning long
                    // after a probe was dispatched is the case being defended against.
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
            // Reachability, asserted rather than assumed: the region is narrow and easy to tune out
            // of by accident, and a run that never reaches it would pass vacuously.
            assert.ok(
                stragglerDuringProbe > 0,
                `seed ${seed}: no unrelated request ever reported while a probe was outstanding, so probe attribution went untested`,
            );
            assert.strictEqual(maxProbesOutstanding, 1, `seed ${seed}: expected exactly one probe at a time, saw ${maxProbesOutstanding}`);
            assert.strictEqual(probeWhileClosed, 0, `seed ${seed}: a closed breaker dispatched ${probeWhileClosed} probes`);
        });
    }

    // Liveness: what stops "temporarily unavailable" becoming "dead until restart". Every outcome
    // that can open a breaker takes its own path through report(), so each is checked.
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
