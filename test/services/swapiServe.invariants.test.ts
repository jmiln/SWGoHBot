import assert from "node:assert";
import { describe, it } from "node:test";
import { PRIORITY_COUNT, type Priority } from "../../data/constants/swapiServe.ts";
import { Dispatcher } from "../../services/swapiServe/dispatcher.ts";
import type { Forwarder } from "../../services/swapiServe/forwarder.ts";
import { FakeClock } from "../helpers/fakeClock.ts";

// Deterministic PRNG so a failure can be replayed exactly from the seed in the message.
function makeRandom(seed: number): () => number {
    let state = seed >>> 0;
    return () => {
        state = (state * 1664525 + 1013904223) >>> 0;
        return state / 0x100000000;
    };
}

const REQUEST_COUNT = 3_000;
const SEED = 20260807;

// Real traffic hits a dozen comlink paths, not one per request. Using unique URIs here would
// inflate the per-endpoint cost map to REQUEST_COUNT entries and make every status() call scan
// it, which measures the test harness rather than the scheduler. Request identity travels in the
// body instead.
const ENDPOINTS = ["/player", "/guild", "/playerArenaProfile", "/data", "/metadata"];

/**
 * The scheduler is a concurrent state machine, and its likely bugs (a request dispatched twice,
 * accounting drifting negative, a cancelled request still reaching the backend) are exactly the
 * ones example-based tests miss. This drives a large randomised workload and asserts properties
 * that must hold on every run, on virtual time so the volume costs milliseconds.
 */
describe("swapiServe scheduler invariants", () => {
    it("holds every invariant across a large randomised workload", async () => {
        const random = makeRandom(SEED);
        const clock = new FakeClock();

        // A retry is a legitimate second dispatch of the same request, so "dispatched twice" is
        // not by itself a defect. What must never happen is a request in flight twice at once,
        // or dispatched again after it has already been answered.
        const inFlightIds = new Set<string>();
        const settledIds = new Set<string>();
        const cancelledIds = new Set<string>();
        const shortDeadlineIds = new Set<string>();

        let concurrentDuplicate: string | null = null;
        let dispatchedAfterSettle: string | null = null;
        let dispatchedAfterCancel: string | null = null;
        let concurrent = 0;
        let negativeAccounting = false;

        const forwarder: Forwarder = async (_backendUrl, request) => {
            const id = request.body ? String(JSON.parse(request.body.toString()).id) : "";
            if (inFlightIds.has(id)) concurrentDuplicate = id;
            if (settledIds.has(id)) dispatchedAfterSettle = id;
            if (cancelledIds.has(id)) dispatchedAfterCancel = id;
            inFlightIds.add(id);

            concurrent++;
            const roll = random();
            concurrent--;
            if (concurrent < 0) negativeAccounting = true;
            inFlightIds.delete(id);

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

        const dispatcher = new Dispatcher({
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

        for (let i = 0; i < REQUEST_COUNT; i++) {
            const priority = Math.floor(random() * PRIORITY_COUNT) as Priority;
            const id = String(i);
            const uri = ENDPOINTS[i % ENDPOINTS.length];

            // A short deadline on a slice of requests exercises the expiry path under load rather
            // than only in isolation.
            const shortLived = random() < 0.1;
            if (shortLived) shortDeadlineIds.add(id);

            const controller = new AbortController();
            settled.push(
                dispatcher
                    .submit(
                        {
                            method: "POST",
                            uri,
                            body: Buffer.from(JSON.stringify({ id })),
                            priority,
                            deadline: clock.now() + (shortLived ? 20 : 3_600_000),
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
            if (i % 100 === 0) await clock.flush();
        }

        // Drain until every request has actually settled, NOT until the queue looks empty. A
        // request waiting out its retry backoff is not in any queue, so an empty queue is a false
        // completion signal: the loop would exit, the clock would stop, and the pending retry
        // timer would never fire.
        let drained = false;
        for (let i = 0; i < 40_000; i++) {
            clock.advance(50);
            await clock.flush();
            if (settledCount === REQUEST_COUNT) {
                drained = true;
                break;
            }
        }
        const results = await Promise.all(settled);
        const status = dispatcher.status();
        dispatcher.stop();

        assert.strictEqual(concurrentDuplicate, null, `seed ${SEED}: request in flight twice at once: ${concurrentDuplicate}`);
        assert.strictEqual(dispatchedAfterSettle, null, `seed ${SEED}: request dispatched after it settled: ${dispatchedAfterSettle}`);
        assert.strictEqual(negativeAccounting, false, `seed ${SEED}: in-flight accounting went negative`);
        assert.strictEqual(dispatchedAfterCancel, null, `seed ${SEED}: cancelled request reached the backend: ${dispatchedAfterCancel}`);

        assert.ok(
            drained,
            `seed ${SEED}: only ${settledCount} of ${REQUEST_COUNT} requests settled; depths were ${JSON.stringify(status.queue.depths)}`,
        );
        assert.strictEqual(results.length, REQUEST_COUNT, `seed ${SEED}: every request must reach a terminal state`);
        for (const result of results) {
            assert.ok(typeof result.status === "number", `seed ${SEED}: every request must resolve with a status`);
        }

        // Exactly one terminal reason per request, and they must add up.
        const terminalTotal = Object.values(status.terminal).reduce((sum, count) => sum + count, 0);
        assert.strictEqual(terminalTotal, REQUEST_COUNT, `seed ${SEED}: terminal reasons ${terminalTotal} != ${REQUEST_COUNT} requests`);

        for (const backend of status.backends) {
            assert.ok(backend.inFlight >= 0, `seed ${SEED}: ${backend.url} reported negative in-flight`);
            assert.ok(backend.inFlight <= backend.limit, `seed ${SEED}: ${backend.url} exceeded its own limit`);
        }

        // The workload is meant to exercise every path; if one never fired the test is weaker
        // than it looks and the mix needs revisiting.
        assert.ok(status.terminal.completed > 0, `seed ${SEED}: no request completed normally`);
        assert.ok(status.terminal.cancelled > 0, `seed ${SEED}: the cancellation path never ran`);
        assert.ok(status.terminal.deadline > 0, `seed ${SEED}: the expiry path never ran`);
        assert.ok(status.retries > 0, `seed ${SEED}: the retry path never ran`);
    });
});
