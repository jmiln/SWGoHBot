import assert from "node:assert";
import { describe, it } from "node:test";
import { GOVERNOR, RATE } from "../../data/constants/swapiServe.ts";
import { Governor, type GovernorTransition, RECENT_PEAKS } from "../../services/swapiServe/governor.ts";

const A = "http://a.test";
const B = "http://b.test";

function completeClean(governor: Governor, url: string, times: number, now = 0): void {
    for (let i = 0; i < times; i++) {
        const at = now + i * 1000;
        governor.acquire(at);
        governor.report(url, "ok", at);
    }
}

describe("swapiServe.Governor capacity", () => {
    it("starts each backend at the conservative starting limit", () => {
        const governor = new Governor([A]);
        assert.strictEqual(governor.snapshot()[0].limit, GOVERNOR.START_LIMIT);
    });

    // Per-backend budgets being independent is the point: it is what makes adding a second comlink
    // instance and comparing the two learned limits answer whether it bought any capacity.
    it("gives each backend its own budget rather than a shared one", () => {
        const governor = new Governor([A, B]);
        assert.deepStrictEqual(
            governor.snapshot().map((backend) => backend.limit),
            [GOVERNOR.START_LIMIT, GOVERNOR.START_LIMIT],
        );
    });

    it("hands out slots until a backend is saturated, then refuses", () => {
        const governor = new Governor([A]);
        for (let i = 0; i < GOVERNOR.START_LIMIT; i++) {
            assert.strictEqual(governor.acquire(0).url, A, `slot ${i} should be granted`);
        }
        assert.strictEqual(governor.acquire(0).url, null, "should refuse once at the limit");
    });

    it("frees the slot when the outcome is reported", () => {
        const governor = new Governor([A]);
        for (let i = 0; i < GOVERNOR.START_LIMIT; i++) governor.acquire(0);
        assert.strictEqual(governor.acquire(0).url, null);

        governor.report(A, "ok", 0);
        assert.strictEqual(governor.acquire(0).url, A);
    });
});

describe("swapiServe.Governor additive increase", () => {
    it("raises the limit after enough consecutive clean completions", () => {
        const governor = new Governor([A]);
        completeClean(governor, A, GOVERNOR.INCREASE_AFTER_CLEAN);
        assert.strictEqual(governor.snapshot()[0].limit, GOVERNOR.START_LIMIT + 1);
    });

    it("does not raise the limit before the streak is met", () => {
        const governor = new Governor([A]);
        completeClean(governor, A, GOVERNOR.INCREASE_AFTER_CLEAN - 1);
        assert.strictEqual(governor.snapshot()[0].limit, GOVERNOR.START_LIMIT);
    });

    it("never exceeds the configured ceiling", () => {
        const governor = new Governor([A]);
        completeClean(governor, A, GOVERNOR.INCREASE_AFTER_CLEAN * (GOVERNOR.MAX_LIMIT + 5));
        assert.strictEqual(governor.snapshot()[0].limit, GOVERNOR.MAX_LIMIT);
    });
});

describe("swapiServe.Governor multiplicative decrease", () => {
    it("cuts the limit by the decrease factor on a throttle", () => {
        const governor = new Governor([A]);
        governor.acquire(0);
        governor.report(A, "throttled", 0);
        assert.strictEqual(governor.snapshot()[0].limit, Math.floor(GOVERNOR.START_LIMIT * GOVERNOR.DECREASE_FACTOR));
    });

    it("cuts the limit by the decrease factor on a server error", () => {
        const governor = new Governor([A]);
        governor.acquire(0);
        governor.report(A, "server_error", 0);
        assert.strictEqual(governor.snapshot()[0].limit, Math.floor(GOVERNOR.START_LIMIT * GOVERNOR.DECREASE_FACTOR));
    });

    // Started at the floor, not driven to it: the number of cuts that takes can exceed
    // CIRCUIT_OPEN_AFTER_FAILURES, which would test the breaker instead of the clamp.
    it("never drops below the minimum limit", () => {
        const governor = new Governor([A]);
        governor.setLimit(A, GOVERNOR.MIN_LIMIT);

        governor.report(A, "throttled", 0);
        governor.report(A, "throttled", 0);

        assert.strictEqual(governor.snapshot()[0].limit, GOVERNOR.MIN_LIMIT);
        assert.strictEqual(governor.snapshot()[0].state, "closed");
    });

    // A dead ally code must not shrink the pool. This is the case that would otherwise
    // silently degrade throughput whenever users typed bad codes.
    it("leaves the limit untouched for a missing ally code", () => {
        const governor = new Governor([A]);
        governor.acquire(0);
        governor.report(A, "not_found", 0);
        assert.strictEqual(governor.snapshot()[0].limit, GOVERNOR.START_LIMIT);
    });

    it("leaves the limit untouched for a rejected request", () => {
        const governor = new Governor([A]);
        governor.acquire(0);
        governor.report(A, "rejected", 0);
        assert.strictEqual(governor.snapshot()[0].limit, GOVERNOR.START_LIMIT);
    });
});

describe("swapiServe.Governor cooldown", () => {
    it("suppresses increases during the cooldown after a decrease", () => {
        const governor = new Governor([A]);
        governor.acquire(0);
        governor.report(A, "throttled", 0);
        const afterDecrease = governor.snapshot()[0].limit;

        for (let i = 0; i < GOVERNOR.INCREASE_AFTER_CLEAN; i++) {
            governor.acquire(1);
            governor.report(A, "ok", 1);
        }
        assert.strictEqual(governor.snapshot()[0].limit, afterDecrease, "should not regrow during cooldown");
    });

    it("allows increases again once the cooldown has passed", () => {
        const governor = new Governor([A]);
        governor.acquire(0);
        governor.report(A, "throttled", 0);
        const afterDecrease = governor.snapshot()[0].limit;

        const past = GOVERNOR.COOLDOWN_MS + 1;
        for (let i = 0; i < GOVERNOR.INCREASE_AFTER_CLEAN; i++) {
            governor.acquire(past);
            governor.report(A, "ok", past);
        }
        assert.strictEqual(governor.snapshot()[0].limit, afterDecrease + 1);
    });
});

describe("swapiServe.Governor backend selection", () => {
    it("prefers the backend with the most available capacity", () => {
        const governor = new Governor([A, B]);
        const first = governor.acquire(0).url;
        const second = governor.acquire(0).url;
        assert.notStrictEqual(first, second, "should spread across backends before doubling up");
    });

    it("drains traffic away from a backend whose limit has collapsed", () => {
        const governor = new Governor([A, B]);
        // Collapse A to the minimum without tripping its breaker, so this tests selection
        // rather than the circuit.
        governor.setLimit(A, GOVERNOR.MIN_LIMIT);

        assert.strictEqual(governor.snapshot()[0].limit, GOVERNOR.MIN_LIMIT);
        assert.strictEqual(governor.snapshot()[0].state, "closed", "should still be eligible, just small");

        for (let i = 0; i < 3; i++) {
            assert.strictEqual(governor.acquire(0).url, B, "healthy backend should absorb the traffic");
        }
    });
});

// One test per edge of the state machine. The breaker is where a small edit can silently turn
// "temporarily unavailable" into "disabled until restart", so every transition is pinned.
describe("swapiServe.Governor circuit breaker", () => {
    function openTheCircuit(governor: Governor): void {
        for (let i = 0; i < GOVERNOR.CIRCUIT_OPEN_AFTER_FAILURES; i++) {
            governor.report(A, "transport_failure", 0);
        }
    }

    it("moves closed -> open after repeated failures and refuses the backend", () => {
        const governor = new Governor([A]);
        openTheCircuit(governor);

        assert.strictEqual(governor.snapshot()[0].state, "open");
        assert.strictEqual(governor.acquire(0).url, null);
    });

    it("stays open until the probe interval has elapsed", () => {
        const governor = new Governor([A]);
        openTheCircuit(governor);

        assert.strictEqual(governor.acquire(GOVERNOR.CIRCUIT_PROBE_INTERVAL_MS - 1).url, null);
        assert.strictEqual(governor.snapshot()[0].state, "open");
    });

    it("moves open -> half-open and allows exactly one probe", () => {
        const governor = new Governor([A]);
        openTheCircuit(governor);

        const probeTime = GOVERNOR.CIRCUIT_PROBE_INTERVAL_MS + 1;
        assert.strictEqual(governor.acquire(probeTime).url, A, "should allow one probe");
        assert.strictEqual(governor.snapshot()[0].state, "half-open");
        assert.strictEqual(governor.acquire(probeTime).url, null, "should not allow a second probe");
    });

    it("moves half-open -> closed when the probe succeeds", () => {
        const governor = new Governor([A]);
        openTheCircuit(governor);

        const probeTime = GOVERNOR.CIRCUIT_PROBE_INTERVAL_MS + 1;
        const probe = governor.acquire(probeTime);
        governor.report(A, "ok", probeTime, probe.isProbe);

        assert.strictEqual(governor.snapshot()[0].state, "closed");
        // The failures that opened the breaker also collapsed the rate to its floor, so the
        // backend is eligible immediately but has to wait for a token like anything else.
        assert.strictEqual(governor.acquire(probeTime + 10_000).url, A);
    });

    it("does not restore the old limit when a probe succeeds, so recovery climbs normally", () => {
        const governor = new Governor([A]);
        governor.setLimit(A, 40);
        openTheCircuit(governor);
        const collapsedLimit = governor.snapshot()[0].limit;

        const probeTime = GOVERNOR.CIRCUIT_PROBE_INTERVAL_MS + 1;
        const probe = governor.acquire(probeTime);
        governor.report(A, "ok", probeTime, probe.isProbe);

        assert.strictEqual(governor.snapshot()[0].limit, collapsedLimit);
    });

    it("moves half-open -> open when the probe fails, restarting the interval", () => {
        const governor = new Governor([A]);
        openTheCircuit(governor);

        const probeTime = GOVERNOR.CIRCUIT_PROBE_INTERVAL_MS + 1;
        const probe = governor.acquire(probeTime);
        governor.report(A, "transport_failure", probeTime, probe.isProbe);

        assert.strictEqual(governor.snapshot()[0].state, "open");
        assert.strictEqual(governor.acquire(probeTime + 1).url, null, "interval restarts from the failed probe");
        assert.strictEqual(governor.acquire(probeTime + GOVERNOR.CIRCUIT_PROBE_INTERVAL_MS + 1).url, A, "and probes again later");
    });

    // The invariant that stops the breaker becoming permanent.
    it("always reaches half-open again however many probes have failed", () => {
        const governor = new Governor([A]);
        openTheCircuit(governor);

        let now = 0;
        for (let round = 0; round < 5; round++) {
            now += GOVERNOR.CIRCUIT_PROBE_INTERVAL_MS + 1;
            const probe = governor.acquire(now);
            assert.strictEqual(probe.url, A, `probe ${round} should be allowed`);
            governor.report(A, "transport_failure", now, probe.isProbe);
        }
    });
});

/**
 * A probe is one specific request, not "whatever comes back next while half-open". Requests
 * dispatched before the breaker opened can still be in flight when it probes, and crediting one of
 * those to the probe reads a minute-old observation as current evidence: a stale success re-admits
 * a backend nothing has actually tested, and a stale failure discards a probe that was about to
 * prove the backend healthy, costing another full interval of downtime.
 */
describe("swapiServe.Governor probe attribution", () => {
    /**
     * Opens the breaker while requests dispatched before the collapse are still in flight, which is
     * what a partly-wedged backend actually produces.
     *
     * The learned limit collapses far faster than the in-flight work drains: from 40 it is at the
     * floor after six failures, so thirty-odd requests are still out there when the tenth failure
     * trips the breaker. Returns how many, so the test can assert the scenario really was set up.
     */
    const LEARNED_LIMIT = 40;
    const DISPATCH_SPACING_MS = 100;
    const OPENED_AT = LEARNED_LIMIT * DISPATCH_SPACING_MS;
    const probeTime = OPENED_AT + GOVERNOR.CIRCUIT_PROBE_INTERVAL_MS + 1;

    function openTheCircuitWithStragglers(governor: Governor): number {
        governor.setLimit(A, LEARNED_LIMIT);
        governor.setRate(A, RATE.MAX_PER_SEC);
        // Spaced out because the bucket only ever holds a burst, so filling 40 slots needs tokens
        // to refill along the way, exactly as a backend that really climbed to 40 would have.
        for (let i = 0; i < LEARNED_LIMIT; i++) governor.acquire(i * DISPATCH_SPACING_MS);
        for (let i = 0; i < GOVERNOR.CIRCUIT_OPEN_AFTER_FAILURES; i++) governor.report(A, "transport_failure", OPENED_AT);

        assert.strictEqual(governor.snapshot()[0].state, "open", "the breaker should be open");
        return governor.snapshot()[0].inFlight;
    }

    it("does not credit an unrelated in-flight completion as the probe", () => {
        const governor = new Governor([A]);
        const stragglers = openTheCircuitWithStragglers(governor);
        assert.ok(stragglers > 0, "the scenario needs work still in flight when the breaker opens");

        assert.strictEqual(governor.acquire(probeTime).isProbe, true, "the breaker should be probing");

        // A request sent before the collapse, finally coming back. It says nothing about the state
        // of the backend now: it was dispatched a probe interval ago.
        governor.report(A, "ok", probeTime, false);

        assert.strictEqual(governor.snapshot()[0].state, "half-open", "only the probe's own outcome may re-admit a backend");
    });

    it("re-admits the backend when its own probe succeeds, even if a straggler failed meanwhile", () => {
        const governor = new Governor([A]);
        openTheCircuitWithStragglers(governor);

        const probe = governor.acquire(probeTime);
        assert.strictEqual(probe.isProbe, true);

        governor.report(A, "transport_failure", probeTime, false);
        governor.report(A, "ok", probeTime + 100, probe.isProbe);

        assert.strictEqual(governor.snapshot()[0].state, "closed", "the probe is the freshest evidence there is");
    });

    it("keeps the probe outstanding when an unrelated request releases its slot unused", () => {
        const governor = new Governor([A]);
        openTheCircuitWithStragglers(governor);

        assert.strictEqual(governor.acquire(probeTime).isProbe, true);
        governor.releaseUnused(A, false);

        assert.strictEqual(governor.acquire(probeTime).url, null, "a second probe must not run alongside the first");
    });
});

describe("swapiServe.Governor backend selection under collapse", () => {
    // Selection uses absolute available slots, not the inFlight/limit ratio. A backend that just
    // collapsed to its minimum looks idle by ratio, and feeding it would be exactly wrong.
    it("prefers a healthy high-limit backend over an idle collapsed one", () => {
        const governor = new Governor([A, B]);
        governor.setLimit(A, 40);
        // This test is about slot-based selection; give A rate headroom so the bucket is not
        // what refuses the request.
        governor.setRate(A, 60);

        // B collapses to the minimum but sits completely idle, so by utilisation ratio it looks
        // like the better choice. It is not.
        governor.setLimit(B, GOVERNOR.MIN_LIMIT);
        assert.strictEqual(governor.snapshot()[1].limit, GOVERNOR.MIN_LIMIT);

        // Load A well past B's ratio while leaving it plenty of absolute headroom. Time advances
        // so the bucket keeps up; this test is about slot selection, not pacing.
        for (let i = 0; i < 20; i++) governor.acquire(i * 100);

        assert.strictEqual(governor.acquire(2000).url, A, "should use proven capacity, not the sick backend");
    });
});

describe("swapiServe.Governor releaseUnused", () => {
    it("frees the slot without counting towards the clean streak", () => {
        const governor = new Governor([A]);
        for (let i = 0; i < GOVERNOR.INCREASE_AFTER_CLEAN * 2; i++) {
            governor.acquire(i * 1000);
            governor.releaseUnused(A);
        }

        assert.strictEqual(governor.snapshot()[0].limit, GOVERNOR.START_LIMIT, "an idle service must not inflate its own budget");
        assert.strictEqual(governor.snapshot()[0].inFlight, 0);
    });

    it("makes the slot available again", () => {
        const governor = new Governor([A]);
        for (let i = 0; i < GOVERNOR.START_LIMIT; i++) governor.acquire(0);
        assert.strictEqual(governor.acquire(0).url, null);

        governor.releaseUnused(A);
        assert.strictEqual(governor.acquire(0).url, A);
    });
});

describe("swapiServe.Governor setLimit", () => {
    it("clamps an override to the configured bounds", () => {
        const governor = new Governor([A]);
        governor.setLimit(A, GOVERNOR.MAX_LIMIT + 100);
        assert.strictEqual(governor.snapshot()[0].limit, GOVERNOR.MAX_LIMIT);

        governor.setLimit(A, 0);
        assert.strictEqual(governor.snapshot()[0].limit, GOVERNOR.MIN_LIMIT);
    });
});

describe("swapiServe.Governor blocked reasons", () => {
    // Three genuinely different resources. Knowing which one bound us is what tells us whether
    // the upstream ceiling counts connections or requests per second.
    it("reports slot when every healthy backend is saturated", () => {
        const governor = new Governor([A]);
        for (let i = 0; i < GOVERNOR.START_LIMIT; i++) governor.acquire(0);

        assert.strictEqual(governor.acquire(0).blockedBy, "slot");
    });

    it("reports health when no backend is usable at all", () => {
        const governor = new Governor([A]);
        for (let i = 0; i < GOVERNOR.CIRCUIT_OPEN_AFTER_FAILURES; i++) {
            governor.report(A, "transport_failure", 0);
        }

        assert.strictEqual(governor.acquire(0).blockedBy, "health");
    });

    it("reports health when every backend has been drained by an operator", () => {
        const governor = new Governor([A]);
        governor.drain(A);

        assert.strictEqual(governor.acquire(0).url, null);
        assert.strictEqual(governor.acquire(0).blockedBy, "health");
    });
});

describe("swapiServe.Governor operator controls", () => {
    it("stops dispatching to a drained backend and resumes when enabled", () => {
        const governor = new Governor([A, B]);
        governor.drain(A);

        for (let i = 0; i < 3; i++) {
            assert.strictEqual(governor.acquire(0).url, B, "a drained backend must receive nothing");
        }

        governor.enable(A);
        assert.strictEqual(governor.snapshot()[0].drained, false);
    });

    // An operator drain is a deliberate decision, not a health signal, so a successful probe
    // must never quietly put the backend back into rotation.
    it("keeps a drained backend drained even after a successful request elsewhere", () => {
        const governor = new Governor([A, B]);
        governor.drain(A);
        governor.acquire(0);
        governor.report(B, "ok", 0);

        assert.strictEqual(governor.snapshot()[0].drained, true);
    });
});

describe("swapiServe.Governor rate limiting", () => {
    it("refuses a slot once the burst is spent, even with concurrency free", () => {
        const governor = new Governor([A]);
        governor.setLimit(A, 100);
        governor.setRate(A, 1); // burst capacity of 2 at BURST_FACTOR 2

        assert.strictEqual(governor.acquire(0).url, A);
        assert.strictEqual(governor.acquire(0).url, A);

        const refused = governor.acquire(0);
        assert.strictEqual(refused.url, null, "rate should bind even though 98 slots are free");
        assert.strictEqual(refused.blockedBy, "token", "and it must be reported as a rate block, not a slot block");
    });

    it("reports how long until the next token is due", () => {
        const governor = new Governor([A]);
        governor.setLimit(A, 100);
        governor.setRate(A, 1);
        governor.acquire(0);
        governor.acquire(0);

        assert.strictEqual(governor.nextAvailableAt(0), 1000, "one token per second");
    });

    it("reports null when nothing is rate-blocked", () => {
        const governor = new Governor([A]);
        assert.strictEqual(governor.nextAvailableAt(0), null);
    });

    // Without this, a pool whose circuits are all open has no completion coming to wake it and
    // queued work would sit until an unrelated enqueue happened to pump the queue.
    it("reports the time until the next circuit probe when every backend is open", () => {
        const governor = new Governor([A]);
        for (let i = 0; i < GOVERNOR.CIRCUIT_OPEN_AFTER_FAILURES; i++) {
            governor.report(A, "transport_failure", 0);
        }

        assert.strictEqual(governor.nextAvailableAt(0), GOVERNOR.CIRCUIT_PROBE_INTERVAL_MS);
    });

    it("cuts the rate alongside the limit on a throttle", () => {
        const governor = new Governor([A]);
        const startingRate = governor.snapshot()[0].ratePerSecond;
        governor.report(A, "throttled", 0);

        assert.strictEqual(governor.snapshot()[0].ratePerSecond, startingRate * GOVERNOR.DECREASE_FACTOR);
    });

    it("raises the rate alongside the limit on a clean streak", () => {
        const governor = new Governor([A]);
        const startingRate = governor.snapshot()[0].ratePerSecond;
        completeClean(governor, A, GOVERNOR.INCREASE_AFTER_CLEAN);

        assert.ok(governor.snapshot()[0].ratePerSecond > startingRate, "clean traffic should earn a higher rate");
    });

    it("does not change the rate for a missing ally code", () => {
        const governor = new Governor([A]);
        const startingRate = governor.snapshot()[0].ratePerSecond;
        governor.report(A, "not_found", 0);

        assert.strictEqual(governor.snapshot()[0].ratePerSecond, startingRate);
    });
});

describe("swapiServe.Governor settling metrics", () => {
    // The first report only anchors the accounting clock. Without an anchor, a service whose first
    // traffic arrives an hour after start would book that idle hour at the starting limit.
    it("accumulates time-weighted limit and rate across reported activity", () => {
        const governor = new Governor([A]);

        governor.acquire(0);
        governor.report(A, "ok", 0);
        governor.acquire(1000);
        governor.report(A, "ok", 1000);

        const snap = governor.snapshot()[0];
        assert.strictEqual(snap.observedMs, 1000);
        assert.strictEqual(snap.limitMsIntegral, GOVERNOR.START_LIMIT * 1000);
        assert.strictEqual(snap.rateMsIntegral, RATE.START_PER_SEC * 1000);
    });

    it("books no observed time before the first report", () => {
        const governor = new Governor([A]);
        const snap = governor.snapshot()[0];

        assert.strictEqual(snap.observedMs, 0);
        assert.strictEqual(snap.limitMsIntegral, 0);
        assert.strictEqual(snap.backoffs, 0);
        assert.deepStrictEqual(snap.recentPeaks, []);
    });

    // Only the pre-backoff value says how high the controller got before the backend pushed back,
    // which is what the ceiling constants are pinned against; the mean only says where it centers.
    it("records the pre-backoff peak, not the halved value", () => {
        const governor = new Governor([A]);
        completeClean(governor, A, GOVERNOR.INCREASE_AFTER_CLEAN);
        const climbedTo = governor.snapshot()[0].limit;

        governor.acquire(20_000);
        governor.report(A, "throttled", 20_000);

        const snap = governor.snapshot()[0];
        assert.strictEqual(snap.backoffs, 1);
        assert.strictEqual(snap.recentPeaks.at(-1)?.limit, climbedTo);
        assert.strictEqual(snap.recentPeaks.at(-1)?.at, 20_000);
        assert.ok(snap.limit < climbedTo, "and the live limit should have halved below it");
    });

    it("keeps only the most recent peaks", () => {
        const governor = new Governor([A]);

        for (let i = 0; i < RECENT_PEAKS + 2; i++) {
            const at = 1000 * (i + 1);
            governor.acquire(at);
            governor.report(A, "throttled", at);
        }

        const snap = governor.snapshot()[0];
        assert.strictEqual(snap.backoffs, RECENT_PEAKS + 2);
        assert.strictEqual(snap.recentPeaks.length, RECENT_PEAKS);
        assert.strictEqual(snap.recentPeaks[0].at, 3000, "the two oldest should have been dropped");
    });

    it("does not let a caller mutate the stored peaks through the snapshot", () => {
        const governor = new Governor([A]);
        governor.acquire(1000);
        governor.report(A, "throttled", 1000);

        governor.snapshot()[0].recentPeaks[0].limit = -1;

        assert.notStrictEqual(governor.snapshot()[0].recentPeaks[0].limit, -1);
    });
});

describe("swapiServe.Governor latency observation", () => {
    const URI = "/player";
    const BASELINE_MS = 500;

    function reportAt(governor: Governor, latencyMs: number, now: number): void {
        governor.report(A, "ok", now, false, { uri: URI, latencyMs });
    }

    function establishBaseline(governor: Governor): void {
        for (let i = 0; i < 5; i++) reportAt(governor, BASELINE_MS, i);
    }

    function degradedEvents(seen: GovernorTransition[]): GovernorTransition[] {
        return seen.filter((transition) => transition.event === "degraded");
    }

    it("ignores latency that matches the endpoint's own baseline", () => {
        const seen: GovernorTransition[] = [];
        const governor = new Governor([A], { onTransition: (transition) => seen.push(transition) });
        establishBaseline(governor);

        for (let i = 0; i < GOVERNOR.DEGRADED_SAMPLES * 3; i++) reportAt(governor, BASELINE_MS, 10 + i);

        assert.deepStrictEqual(degradedEvents(seen), []);
    });

    // The case that would otherwise make every guild command look congested: 50 concurrent calls
    // all served promptly raise nothing but the in-flight count, which is not congestion.
    it("stays quiet for a burst the upstream is keeping up with", () => {
        const seen: GovernorTransition[] = [];
        const governor = new Governor([A], { onTransition: (transition) => seen.push(transition) });
        establishBaseline(governor);
        for (let i = 0; i < 50; i++) governor.acquire(10 + i);

        for (let i = 0; i < GOVERNOR.DEGRADED_SAMPLES * 3; i++) reportAt(governor, BASELINE_MS, 100 + i);

        assert.deepStrictEqual(degradedEvents(seen), []);
    });

    // Separates estimating the upstream queue from comparing raw latency: doubled response times
    // with few in flight is capacity being used, not a backend at its limit. A ratio rule fires here.
    it("treats a modest slowdown at a small limit as capacity, not congestion", () => {
        const seen: GovernorTransition[] = [];
        const governor = new Governor([A], { onTransition: (transition) => seen.push(transition) });
        governor.setLimit(A, 5);
        establishBaseline(governor);

        for (let i = 0; i < GOVERNOR.DEGRADED_SAMPLES * 2; i++) reportAt(governor, BASELINE_MS * 2, 10 + i);

        assert.deepStrictEqual(degradedEvents(seen), []);
    });

    // Latency here is dominated by EA's round trip, which moves for reasons we neither cause nor
    // influence, so slowing down cannot drain it. The estimate is reported and nothing more.
    it("reports a sustained queue estimate without touching the limit or the rate", () => {
        const seen: GovernorTransition[] = [];
        const governor = new Governor([A], { onTransition: (transition) => seen.push(transition) });
        establishBaseline(governor);
        const before = governor.snapshot()[0];

        for (let i = 0; i < GOVERNOR.DEGRADED_SAMPLES * 2; i++) reportAt(governor, BASELINE_MS * 20, 10 + i);

        const degraded = seen.filter((transition) => transition.event === "degraded");
        assert.ok(degraded.length > 0, "sustained upstream queueing should still be reported");
        assert.ok((degraded[0].queueEstimate ?? 0) > GOVERNOR.QUEUE_ESTIMATE_THRESHOLD, "and should carry the estimate that tripped it");
        assert.ok(governor.snapshot()[0].limit >= before.limit, "but must not lower the limit");
        assert.ok(governor.snapshot()[0].ratePerSecond >= before.ratePerSecond, "nor the rate");
        assert.strictEqual(governor.snapshot()[0].backoffs, 0, "and must not count as the backend pushing back");
        assert.strictEqual(governor.snapshot()[0].recentPeaks.length, 0, "nor train the learned ceiling");
    });

    // The production collapse this replaced: a baseline latched onto one fast response pinned the
    // limit at threshold / (1 - baseline/latency) forever, because the estimate grows with the limit.
    it("keeps growing the limit while the queue estimate stays high", () => {
        const governor = new Governor([A]);
        establishBaseline(governor);
        const before = governor.snapshot()[0].limit;

        for (let i = 0; i < GOVERNOR.INCREASE_AFTER_CLEAN * 3; i++) {
            governor.acquire(10 + i);
            reportAt(governor, BASELINE_MS * 20, 10 + i);
        }

        assert.ok(governor.snapshot()[0].limit > before, "a slow backend that never fails should still earn capacity");
    });

    it("never opens the circuit, however slow the backend gets", () => {
        const governor = new Governor([A]);
        establishBaseline(governor);

        for (let i = 0; i < GOVERNOR.DEGRADED_SAMPLES * 20; i++) reportAt(governor, BASELINE_MS * 50, 10 + i);

        assert.strictEqual(governor.snapshot()[0].state, "closed", "slow is not broken");
    });

    it("honors an overridden sensitivity instead of the constants", () => {
        const seen: GovernorTransition[] = [];
        const governor = new Governor([A], {
            degradedSamples: 1,
            queueThreshold: 0.5,
            rttAlpha: 1,
            onTransition: (transition) => seen.push(transition),
        });
        establishBaseline(governor);

        reportAt(governor, BASELINE_MS * 20, 10);

        assert.strictEqual(degradedEvents(seen).length, 1, "one sample should be enough at these settings");
    });

    it("judges each endpoint against its own baseline", () => {
        const seen: GovernorTransition[] = [];
        const governor = new Governor([A], { onTransition: (transition) => seen.push(transition) });
        for (let i = 0; i < 5; i++) {
            governor.report(A, "ok", i, false, { uri: "/guild", latencyMs: 300 });
            governor.report(A, "ok", i, false, { uri: "/player", latencyMs: 3000 });
        }

        for (let i = 0; i < GOVERNOR.DEGRADED_SAMPLES * 3; i++) {
            governor.report(A, "ok", 10 + i, false, { uri: "/player", latencyMs: 3000 });
        }

        assert.deepStrictEqual(degradedEvents(seen), [], "a slow endpoint is not a degraded one");
    });
});

describe("swapiServe.Governor learned ceiling", () => {
    const PEAKS = [40, 50, 60];
    const MEDIAN_PEAK = 50;
    const expectedCeiling = Math.floor(MEDIAN_PEAK * GOVERNOR.CEILING_SAFETY_FACTOR);

    function recordPeaks(governor: Governor, url: string, limits: number[]): void {
        for (const [index, limit] of limits.entries()) {
            governor.setLimit(url, limit);
            governor.report(url, "throttled", index * 1000);
        }
    }

    // Climbs from just under the ceiling, so the run stays well inside PEAK_TTL_MS and the test
    // cannot pass by the peaks quietly expiring.
    function climbFrom(governor: Governor, url: string, from: number, at: number): void {
        governor.setLimit(url, from);
        completeClean(governor, url, GOVERNOR.INCREASE_AFTER_CLEAN * 20, at);
    }

    it("leaves growth unconstrained until enough peaks have been recorded", () => {
        const governor = new Governor([A]);
        recordPeaks(governor, A, PEAKS.slice(0, GOVERNOR.CEILING_MIN_PEAKS - 1));

        climbFrom(governor, A, 40, GOVERNOR.COOLDOWN_MS + 10_000);

        assert.ok(
            governor.snapshot()[0].limit > expectedCeiling,
            `too few peaks must not constrain growth, but the limit stopped at ${governor.snapshot()[0].limit}`,
        );
    });

    it("stops growing below the median of the recent peaks", () => {
        const governor = new Governor([A]);
        recordPeaks(governor, A, PEAKS);

        climbFrom(governor, A, 40, GOVERNOR.COOLDOWN_MS + 10_000);

        assert.strictEqual(governor.snapshot()[0].limit, expectedCeiling);
    });

    it("holds the rate below the median peak rate too", () => {
        const governor = new Governor([A]);
        for (const [index, rate] of [40, 50, 60].entries()) {
            governor.setRate(A, rate);
            governor.report(A, "throttled", index * 1000);
        }

        governor.setRate(A, 40);
        completeClean(governor, A, GOVERNOR.INCREASE_AFTER_CLEAN * 20, GOVERNOR.COOLDOWN_MS + 10_000);

        assert.strictEqual(governor.snapshot()[0].ratePerSecond, MEDIAN_PEAK * GOVERNOR.CEILING_SAFETY_FACTOR);
    });

    it("releases the ceiling once the peaks have aged out", () => {
        const governor = new Governor([A]);
        recordPeaks(governor, A, PEAKS);

        climbFrom(governor, A, 40, GOVERNOR.PEAK_TTL_MS + 10_000);

        assert.ok(
            governor.snapshot()[0].limit > expectedCeiling,
            `expired peaks must stop constraining growth, but the limit stopped at ${governor.snapshot()[0].limit}`,
        );
    });
});

describe("swapiServe.Governor transition reporting", () => {
    it("reports a backoff with the limit before and after the halving", () => {
        const seen: GovernorTransition[] = [];
        const governor = new Governor([A], { onTransition: (t) => seen.push(t) });

        governor.acquire(0);
        governor.report(A, "server_error", 0);

        const backoff = seen.find((t) => t.event === "backoff");
        assert.ok(backoff, "expected a backoff transition");
        assert.strictEqual(backoff.url, A);
        assert.strictEqual(backoff.previousLimit, GOVERNOR.START_LIMIT);
        assert.ok(backoff.limit < GOVERNOR.START_LIMIT);
    });

    it("reports the breaker opening after enough consecutive failures", () => {
        const seen: GovernorTransition[] = [];
        const governor = new Governor([A], { onTransition: (t) => seen.push(t) });

        for (let i = 0; i < GOVERNOR.CIRCUIT_OPEN_AFTER_FAILURES; i++) {
            governor.acquire(i);
            governor.report(A, "server_error", i);
        }

        assert.ok(
            seen.some((t) => t.event === "open"),
            "expected an open transition",
        );
    });

    // Production's probe interval, not a compressed one: the failures that open the breaker also
    // collapse the token rate, so a shortened interval blocks the probe on a token instead.
    it("reports half-open and then closed when the probe succeeds", () => {
        const seen: GovernorTransition[] = [];
        const governor = new Governor([A], { onTransition: (t) => seen.push(t) });

        for (let i = 0; i < GOVERNOR.CIRCUIT_OPEN_AFTER_FAILURES; i++) {
            governor.report(A, "transport_failure", 0);
        }

        const probeTime = GOVERNOR.CIRCUIT_PROBE_INTERVAL_MS + 1;
        const probe = governor.acquire(probeTime);
        assert.ok(probe.isProbe, "expected the acquire to be the probe");
        governor.report(A, "ok", probeTime, probe.isProbe);

        assert.ok(
            seen.some((t) => t.event === "half-open"),
            "expected a half-open transition",
        );
        assert.ok(
            seen.some((t) => t.event === "closed"),
            "expected a closed transition",
        );
    });

    it("reports each additive increase with the limit and rate on both sides", () => {
        const seen: GovernorTransition[] = [];
        const governor = new Governor([A], { onTransition: (t) => seen.push(t) });

        completeClean(governor, A, GOVERNOR.INCREASE_AFTER_CLEAN * 3);

        const increases = seen.filter((t) => t.event === "increase");
        assert.strictEqual(increases.length, 3);
        assert.strictEqual(increases[0].previousLimit, GOVERNOR.START_LIMIT);
        assert.strictEqual(increases[0].limit, GOVERNOR.START_LIMIT + 1);
        assert.strictEqual(increases[0].previousRatePerSecond, RATE.START_PER_SEC);
        assert.strictEqual(increases[0].ratePerSecond, RATE.START_PER_SEC + 1);
    });

    // The limit pins at MAX_LIMIT long before the rate reaches MAX_PER_SEC, so an increase
    // reported only as a limit change goes silent while the controller is still ramping.
    it("keeps reporting increases once the limit has pinned at its ceiling", () => {
        const seen: GovernorTransition[] = [];
        const governor = new Governor([A], { onTransition: (t) => seen.push(t) });

        const stepsToCeiling = GOVERNOR.MAX_LIMIT - GOVERNOR.START_LIMIT;
        completeClean(governor, A, GOVERNOR.INCREASE_AFTER_CLEAN * (stepsToCeiling + 3));

        assert.strictEqual(governor.snapshot()[0].limit, GOVERNOR.MAX_LIMIT);
        const pinned = seen.filter((t) => t.event === "increase" && t.limit === GOVERNOR.MAX_LIMIT);
        assert.ok(pinned.length >= 3, `expected increases past the limit ceiling, got ${pinned.length}`);
        const last = pinned.at(-1);
        assert.ok(last, "expected a final increase");
        assert.strictEqual(last.ratePerSecond, last.previousRatePerSecond + 1);
    });

    it("honors an overridden ceiling instead of the constant", () => {
        const maxLimit = GOVERNOR.START_LIMIT + 2;
        const governor = new Governor([A], { maxLimit });

        completeClean(governor, A, GOVERNOR.INCREASE_AFTER_CLEAN * 10);

        assert.strictEqual(governor.snapshot()[0].limit, maxLimit);
    });

    it("clamps an operator set-limit to the overridden ceiling", () => {
        const maxLimit = GOVERNOR.START_LIMIT + 2;
        const governor = new Governor([A], { maxLimit });

        governor.setLimit(A, GOVERNOR.MAX_LIMIT);

        assert.strictEqual(governor.snapshot()[0].limit, maxLimit);
    });

    it("works without a callback, which is how production tests construct it", () => {
        const governor = new Governor([A]);
        governor.acquire(0);
        assert.doesNotThrow(() => governor.report(A, "server_error", 0));
    });
});
