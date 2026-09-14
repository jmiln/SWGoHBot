import assert from "node:assert";
import { describe, it } from "node:test";
import { PRIORITY, type Priority } from "../../data/constants/swapiServe.ts";
import { Dispatcher, type ProxyResponse } from "../../services/swapiServe/dispatcher.ts";
import { FakeClock } from "../helpers/fakeClock.ts";
import { createSimulatedBackend } from "../helpers/simulatedBackend.ts";

const CREDENTIALS = { accessKey: "a", secretKey: "s" };

// Pinned so retuning the start constants cannot silently change what this file measures.
const COLD_START = { startLimit: 5, ratePerSecond: 5 };

// Without a per-test bound, a slow controller surfaces as a file-level timeout naming no test.
const TEST_TIMEOUT_MS = 20_000;

// Step coarsely: advance() fires every timer due in the window in due order, so a bigger step
// costs no fidelity, and at a 15s probe interval fine steps need tens of thousands of iterations.
// Bounded above too: a step spanning many forwarder completions starves the drain check, since
// those settle as promises between advances and never inside one.
const STEP_MS = 100;

function submit(
    dispatcher: Dispatcher,
    clock: FakeClock,
    priority: Priority,
    uri = "/player",
    deadlineMs = 3_600_000,
): Promise<ProxyResponse> {
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
 *
 * The controller's state goes in the message because a correctly throttled backend and a stalled
 * one both present as "did not drain": limit, rate and backoffs are what tell them apart.
 */
async function drain(dispatcher: Dispatcher, clock: FakeClock, maxSteps = 20_000): Promise<void> {
    for (let i = 0; i < maxSteps; i++) {
        clock.advance(STEP_MS);
        await clock.flush();
        // In-flight requests are not queued, and they complete on a clock this loop owns: returning
        // while any remain stops time forever and their promises can never settle.
        const { queue, backends } = dispatcher.status();
        if (queue.depths.every((depth) => depth === 0) && backends.every((backend) => backend.inFlight === 0)) return;
    }
    const { queue, blocked, backends, terminal } = dispatcher.status();
    const [backend] = backends;
    throw new Error(
        `queue did not drain in ${(maxSteps * STEP_MS) / 1000}s of virtual time; ` +
            `depths=${JSON.stringify(queue.depths)} blocked=${JSON.stringify(blocked)} ` +
            `limit=${backend.limit} rate=${backend.ratePerSecond.toFixed(1)} state=${backend.state} ` +
            `backoffs=${backend.backoffs} inFlight=${backend.inFlight} completed=${terminal.completed}`,
    );
}

describe("swapiServe controller simulation", () => {
    it("settles below the backend's tolerance instead of hammering it", { timeout: TEST_TIMEOUT_MS }, async () => {
        const clock = new FakeClock();
        const backend = createSimulatedBackend({ throttleAboveRps: 15, latencyMs: 50 }, clock);
        const dispatcher = new Dispatcher({
            backends: ["sim://a"],
            ...CREDENTIALS,
            ...COLD_START,
            forwarder: backend.forwarder,
            clock,
            retryDelayMs: 10,
        });

        const pending = Array.from({ length: 1500 }, () => submit(dispatcher, clock, PRIORITY.BULK));
        await drain(dispatcher, clock);
        await Promise.all(pending);
        dispatcher.stop();

        const { total, throttled } = backend.stats();
        const throttleRate = throttled / total;
        assert.ok(throttleRate < 0.2, `should settle below the tolerance, throttle rate was ${(throttleRate * 100).toFixed(1)}%`);
    });

    it("does not oscillate: the limit stays in a stable band once settled", { timeout: TEST_TIMEOUT_MS }, async () => {
        const clock = new FakeClock();
        const backend = createSimulatedBackend({ throttleAboveRps: 20, latencyMs: 30 }, clock);
        const dispatcher = new Dispatcher({
            backends: ["sim://a"],
            ...CREDENTIALS,
            ...COLD_START,
            forwarder: backend.forwarder,
            clock,
            retryDelayMs: 10,
        });

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

    // Raising the start constants is a tuning decision, and this is what makes getting it wrong
    // survivable: overshooting the backend costs throttles and time, never the circuit.
    it("recovers from a start above the backend's tolerance without opening the breaker", { timeout: TEST_TIMEOUT_MS }, async () => {
        const clock = new FakeClock();
        const tolerance = 20;
        const backend = createSimulatedBackend({ throttleAboveRps: tolerance, latencyMs: 30 }, clock);
        const events: string[] = [];
        const dispatcher = new Dispatcher({
            backends: ["sim://a"],
            ...CREDENTIALS,
            startLimit: tolerance * 2,
            ratePerSecond: tolerance * 2,
            forwarder: backend.forwarder,
            clock,
            retryDelayMs: 10,
            onGovernorTransition: (transition) => events.push(transition.event),
        });

        const pending = Array.from({ length: 400 }, () => submit(dispatcher, clock, PRIORITY.BULK));
        await drain(dispatcher, clock);
        const responses = await Promise.all(pending);
        const status = dispatcher.status();
        dispatcher.stop();

        // A backoff happens at any start once the limit climbs into the tolerance, so its presence
        // proves nothing; needing almost no growth to reach it is what implicates the start.
        const growthBeforeFirstBackoff = events.indexOf("backoff");
        assert.ok(
            growthBeforeFirstBackoff >= 0 && growthBeforeFirstBackoff <= 3,
            `the start must overshoot, or this asserts nothing; ${growthBeforeFirstBackoff} increases preceded the first backoff`,
        );

        assert.strictEqual(status.backends[0].state, "closed", "an overshoot must not trip the circuit");

        // Not all of them: a burst this far over the tolerance outruns the retry budget, so the
        // overshoot is paid partly in 429s reaching the caller. That cost is why the start matters.
        const served = responses.filter((response) => response.status === 200).length;
        assert.ok(
            served / responses.length > 0.85,
            `an overshoot should cost throttles, not the batch; only ${served} of ${responses.length} were served`,
        );
    });

    // The reservations exist so a busy bot cannot stall the nightly data pull into staleness.
    it("keeps bulk work moving while interactive load runs continuously", { timeout: TEST_TIMEOUT_MS }, async () => {
        const clock = new FakeClock();
        const backend = createSimulatedBackend({ throttleAboveRps: 25, latencyMs: 20 }, clock);
        const dispatcher = new Dispatcher({
            backends: ["sim://a"],
            ...CREDENTIALS,
            ...COLD_START,
            forwarder: backend.forwarder,
            clock,
            retryDelayMs: 10,
        });

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
    it("serves an arena tick promptly even behind a large bulk backlog", { timeout: TEST_TIMEOUT_MS }, async () => {
        const clock = new FakeClock();
        const backend = createSimulatedBackend({ throttleAboveRps: 25, latencyMs: 20 }, clock);
        const dispatcher = new Dispatcher({
            backends: ["sim://a"],
            ...CREDENTIALS,
            ...COLD_START,
            forwarder: backend.forwarder,
            clock,
            retryDelayMs: 10,
        });

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

    it("recovers after a backend outage clears", { timeout: TEST_TIMEOUT_MS }, async () => {
        const clock = new FakeClock();
        let healthy = false;
        const dispatcher = new Dispatcher({
            backends: ["sim://a"],
            ...CREDENTIALS,
            ...COLD_START,
            clock,
            retryDelayMs: 10,
            forwarder: async () =>
                healthy ? { status: 200, headers: {}, body: Buffer.from("{}") } : { status: undefined, headers: {}, body: Buffer.alloc(0) },
        });

        // Short deadlines, so that once the breaker opens the rest of the batch is shed rather
        // than waiting: nothing here is meant to survive the outage, it only has to cause it.
        const failing = Array.from({ length: 12 }, () => submit(dispatcher, clock, PRIORITY.BULK, "/player", 10_000));
        await drain(dispatcher, clock);
        await Promise.all(failing);
        assert.strictEqual(dispatcher.status().backends[0].state, "open", "sustained failure should open the breaker");

        healthy = true;

        // A request outlasting the probe interval keeps its place, so recovery needs only time:
        // the breaker half-opens and the waiting request becomes the probe.
        const recovering = submit(dispatcher, clock, PRIORITY.BULK);
        await drain(dispatcher, clock);
        const response = await recovering;
        dispatcher.stop();

        assert.strictEqual(response.status, 200, "the request that waited out the outage should be served");
        assert.strictEqual(dispatcher.status().backends[0].state, "closed", "the breaker must recover once the backend does");
    });
});
