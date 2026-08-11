import assert from "node:assert";
import { describe, it } from "node:test";
import { PRIORITY, type Priority } from "../../data/constants/swapiServe.ts";
import { Dispatcher, type ProxyResponse } from "../../services/swapiServe/dispatcher.ts";
import { FakeClock } from "../helpers/fakeClock.ts";
import { createSimulatedBackend } from "../helpers/simulatedBackend.ts";

const CREDENTIALS = { accessKey: "a", secretKey: "s" };

// Virtual time is free, so step coarsely: advance() fires every timer due in the window, in due
// order, so a bigger step costs nothing in fidelity but covers far more simulated time per
// iteration. The circuit-breaker probe interval is 15s, so a fine step would need tens of
// thousands of iterations just to get through a handful of probes.
const STEP_MS = 100;

function submit(dispatcher: Dispatcher, clock: FakeClock, priority: Priority, uri = "/player", deadlineMs = 3_600_000): Promise<ProxyResponse> {
    return dispatcher.submit({
        method: "POST",
        uri,
        body: Buffer.from("{}"),
        priority,
        deadline: clock.now() + deadlineMs,
    });
}

/**
 * Advances virtual time until the queue drains.
 *
 * Throws rather than returning quietly if the budget runs out: a queue that never empties is a
 * real finding (a stall, a lost wakeup), and swallowing it would leave the caller's Promise.all
 * hanging until the test runner's timeout, which reports nothing useful.
 */
async function drain(dispatcher: Dispatcher, clock: FakeClock, maxSteps = 20_000): Promise<void> {
    for (let i = 0; i < maxSteps; i++) {
        clock.advance(STEP_MS);
        await clock.flush();
        if (dispatcher.status().queue.depths.every((depth) => depth === 0)) return;
    }
    const { queue, blocked } = dispatcher.status();
    throw new Error(
        `queue did not drain in ${(maxSteps * STEP_MS) / 1000}s of virtual time; ` +
            `depths=${JSON.stringify(queue.depths)} blocked=${JSON.stringify(blocked)}`,
    );
}

describe("swapiServe controller simulation", () => {
    it("settles below the backend's tolerance instead of hammering it", async () => {
        const clock = new FakeClock();
        const backend = createSimulatedBackend({ throttleAboveRps: 15, latencyMs: 50 }, clock);
        const dispatcher = new Dispatcher({ backends: ["sim://a"], ...CREDENTIALS, forwarder: backend.forwarder, clock, retryDelayMs: 10 });

        const pending = Array.from({ length: 1500 }, () => submit(dispatcher, clock, PRIORITY.BULK));
        await drain(dispatcher, clock);
        await Promise.all(pending);
        dispatcher.stop();

        const { total, throttled } = backend.stats();
        const throttleRate = throttled / total;
        assert.ok(throttleRate < 0.2, `should settle below the tolerance, throttle rate was ${(throttleRate * 100).toFixed(1)}%`);
    });

    it("does not oscillate: the limit stays in a stable band once settled", async () => {
        const clock = new FakeClock();
        const backend = createSimulatedBackend({ throttleAboveRps: 20, latencyMs: 30 }, clock);
        const dispatcher = new Dispatcher({ backends: ["sim://a"], ...CREDENTIALS, forwarder: backend.forwarder, clock, retryDelayMs: 10 });

        const first = Array.from({ length: 800 }, () => submit(dispatcher, clock, PRIORITY.BULK));
        await drain(dispatcher, clock);
        await Promise.all(first);
        const settled = dispatcher.status().backends[0].limit;

        const second = Array.from({ length: 800 }, () => submit(dispatcher, clock, PRIORITY.BULK));
        await drain(dispatcher, clock);
        await Promise.all(second);
        const later = dispatcher.status().backends[0].limit;
        dispatcher.stop();

        assert.ok(
            Math.abs(later - settled) <= Math.max(3, settled),
            `limit swung from ${settled} to ${later}, which suggests oscillation rather than convergence`,
        );
    });

    // The reservations exist so a busy bot cannot stall the nightly data pull into staleness.
    it("keeps bulk work moving while interactive load runs continuously", async () => {
        const clock = new FakeClock();
        const backend = createSimulatedBackend({ throttleAboveRps: 25, latencyMs: 20 }, clock);
        const dispatcher = new Dispatcher({ backends: ["sim://a"], ...CREDENTIALS, forwarder: backend.forwarder, clock, retryDelayMs: 10 });

        const bulk = Array.from({ length: 300 }, () => submit(dispatcher, clock, PRIORITY.BULK));
        const interactive = Array.from({ length: 900 }, () => submit(dispatcher, clock, PRIORITY.PUBLIC_COMMAND));

        await drain(dispatcher, clock);
        const settled = await Promise.all(bulk);
        await Promise.all(interactive);
        dispatcher.stop();

        const served = settled.filter((response) => response.status === 200).length;
        assert.ok(served > 250, `bulk must not starve under sustained interactive load, only ${served} of 300 completed`);
    });

    // The headline requirement: the payout tick has to land inside its minute.
    it("serves an arena tick promptly even behind a large bulk backlog", async () => {
        const clock = new FakeClock();
        const backend = createSimulatedBackend({ throttleAboveRps: 25, latencyMs: 20 }, clock);
        const dispatcher = new Dispatcher({ backends: ["sim://a"], ...CREDENTIALS, forwarder: backend.forwarder, clock, retryDelayMs: 10 });

        const bulk = Array.from({ length: 1000 }, () => submit(dispatcher, clock, PRIORITY.BULK));
        const submittedAt = clock.now();

        // Capture the clock when the tick actually resolves. Reading it after the drain loop
        // would measure how long the whole backlog took, not how long the tick waited.
        let completedAt = 0;
        const tick = submit(dispatcher, clock, PRIORITY.ARENA_TICK, "/arena").then((response) => {
            completedAt = clock.now();
            return response;
        });

        await drain(dispatcher, clock);
        await tick;
        await Promise.all(bulk);
        dispatcher.stop();

        const waited = completedAt - submittedAt;
        assert.ok(waited < 60_000, `the payout tick waited ${waited}ms, which risks missing its minute`);
    });

    it("recovers after a backend outage clears", async () => {
        const clock = new FakeClock();
        let healthy = false;
        const dispatcher = new Dispatcher({
            backends: ["sim://a"],
            ...CREDENTIALS,
            clock,
            retryDelayMs: 10,
            forwarder: async () =>
                healthy
                    ? { status: 200, headers: {}, body: Buffer.from("{}") }
                    : { status: undefined, headers: {}, body: Buffer.alloc(0) },
        });

        // Short deadlines, so that once the breaker opens the rest of the batch is shed rather
        // than waiting: nothing here is meant to survive the outage, it only has to cause it.
        const failing = Array.from({ length: 12 }, () => submit(dispatcher, clock, PRIORITY.BULK, "/player", 10_000));
        await drain(dispatcher, clock);
        await Promise.all(failing);
        assert.strictEqual(dispatcher.status().backends[0].state, "open", "sustained failure should open the breaker");

        healthy = true;

        // A request whose deadline outlasts the probe interval keeps its place through the outage,
        // so recovery needs nothing but time: the breaker reaches half-open at the probe interval,
        // the waiting request becomes the probe, and it succeeds. Nothing has to arrive at exactly
        // the right moment for the pool to come back.
        const recovering = submit(dispatcher, clock, PRIORITY.BULK);
        await drain(dispatcher, clock);
        const response = await recovering;
        dispatcher.stop();

        assert.strictEqual(response.status, 200, "the request that waited out the outage should be served");
        assert.strictEqual(dispatcher.status().backends[0].state, "closed", "the breaker must recover once the backend does");
    });
});
