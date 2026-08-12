import assert from "node:assert";
import { describe, it } from "node:test";
import { GOVERNOR, RATE } from "../../data/constants/swapiServe.ts";
import { Governor } from "../../services/swapiServe/governor.ts";

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
    it("halves the limit on a throttle", () => {
        const governor = new Governor([A]);
        governor.acquire(0);
        governor.report(A, "throttled", 0);
        assert.strictEqual(governor.snapshot()[0].limit, Math.floor(GOVERNOR.START_LIMIT / 2));
    });

    it("halves the limit on a server error", () => {
        const governor = new Governor([A]);
        governor.acquire(0);
        governor.report(A, "server_error", 0);
        assert.strictEqual(governor.snapshot()[0].limit, Math.floor(GOVERNOR.START_LIMIT / 2));
    });

    it("never drops below the minimum limit", () => {
        const governor = new Governor([A]);
        // Deliberately fewer than CIRCUIT_OPEN_AFTER_FAILURES: this is about the floor on the
        // limit, not about the breaker, and tripping the breaker would mask it.
        for (let i = 0; i < GOVERNOR.CIRCUIT_OPEN_AFTER_FAILURES - 1; i++) {
            governor.report(A, "throttled", 0);
        }
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
        for (let i = 0; i < 3; i++) governor.report(A, "throttled", 0);

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
        assert.strictEqual(
            governor.acquire(probeTime + GOVERNOR.CIRCUIT_PROBE_INTERVAL_MS + 1).url,
            A,
            "and probes again later",
        );
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
        for (let i = 0; i < 3; i++) governor.report(B, "throttled", 0);
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

    it("halves the rate alongside the limit on a throttle", () => {
        const governor = new Governor([A]);
        const startingRate = governor.snapshot()[0].ratePerSecond;
        governor.report(A, "throttled", 0);

        assert.strictEqual(governor.snapshot()[0].ratePerSecond, startingRate / 2);
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
