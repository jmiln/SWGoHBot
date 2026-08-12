import assert from "node:assert";
import { describe, it } from "node:test";
import { PRIORITY } from "../../data/constants/swapiServe.ts";
import { RetryBudget } from "../../services/swapiServe/retryBudget.ts";

describe("swapiServe.RetryBudget", () => {
    // The floor is what makes an isolated failure retryable at all: 25 percent of one dispatch
    // rounds to zero, so without it a quiet service would never retry anything.
    it("allows a minimum number of retries regardless of how little traffic there has been", () => {
        const budget = new RetryBudget({ windowMs: 1000, maxFraction: 0.25, minInWindow: 3 });
        budget.recordDispatch(PRIORITY.PUBLIC_COMMAND, 0);

        assert.strictEqual(budget.tryConsume(PRIORITY.PUBLIC_COMMAND, 0), true, "the first failure on a quiet service must be retryable");
        assert.strictEqual(budget.tryConsume(PRIORITY.PUBLIC_COMMAND, 0), true);
        assert.strictEqual(budget.tryConsume(PRIORITY.PUBLIC_COMMAND, 0), true);
        assert.strictEqual(budget.tryConsume(PRIORITY.PUBLIC_COMMAND, 0), false, "but only up to the floor");
    });

    it("allows retries up to the configured fraction of dispatches", () => {
        const budget = new RetryBudget({ windowMs: 1000, maxFraction: 0.25, minInWindow: 0 });
        for (let i = 0; i < 100; i++) budget.recordDispatch(PRIORITY.PUBLIC_COMMAND, 0);

        for (let i = 0; i < 25; i++) {
            assert.strictEqual(budget.tryConsume(PRIORITY.PUBLIC_COMMAND, 0), true, `retry ${i} should be allowed`);
        }
        assert.strictEqual(budget.tryConsume(PRIORITY.PUBLIC_COMMAND, 0), false, "the 26th retry exceeds 25 percent of 100");
    });

    it("refuses every retry when nothing has been dispatched", () => {
        const budget = new RetryBudget({ windowMs: 1000, maxFraction: 0.25, minInWindow: 0 });
        assert.strictEqual(budget.tryConsume(PRIORITY.PUBLIC_COMMAND, 0), false);
    });

    it("forgets dispatches and retries that fall outside the window", () => {
        const budget = new RetryBudget({ windowMs: 1000, maxFraction: 0.5, minInWindow: 0 });
        for (let i = 0; i < 10; i++) budget.recordDispatch(PRIORITY.PUBLIC_COMMAND, 0);
        for (let i = 0; i < 5; i++) budget.tryConsume(PRIORITY.PUBLIC_COMMAND, 0);
        assert.strictEqual(budget.tryConsume(PRIORITY.PUBLIC_COMMAND, 0), false, "budget is spent within the window");

        // Everything above ages out; a fresh dispatch gives a fresh allowance
        for (let i = 0; i < 10; i++) budget.recordDispatch(PRIORITY.PUBLIC_COMMAND, 2000);
        assert.strictEqual(budget.tryConsume(PRIORITY.PUBLIC_COMMAND, 2000), true);
    });

    it("scales the allowance with recent traffic", () => {
        const budget = new RetryBudget({ windowMs: 1000, maxFraction: 0.25, minInWindow: 0 });
        for (let i = 0; i < 4; i++) budget.recordDispatch(PRIORITY.PUBLIC_COMMAND, 0);

        assert.strictEqual(budget.tryConsume(PRIORITY.PUBLIC_COMMAND, 0), true, "one retry is 25 percent of four dispatches");
        assert.strictEqual(budget.tryConsume(PRIORITY.PUBLIC_COMMAND, 0), false);
    });
});

/**
 * Every other scarce resource in the design is tiered: slots by priority, queue depth per tier,
 * deadlines per tier. The retry allowance has to be too, or it becomes the one place a nightly bulk
 * run can still crowd out the payout tick, which is the whole thing the priority queue exists to
 * stop. A tick request dropped for want of a retry loses that account's alert for the minute, and
 * the payout cycle and the poll interval are exact multiples, so it is the same minute every day.
 */
describe("swapiServe.RetryBudget tier isolation", () => {
    // Ordered the way production runs: the tick fires on its minute, and the nightly cycle floods
    // the same window around it. A shared allowance lets bulk spend the share the tick's own
    // dispatches funded, which is what leaves the tick with nothing when it needs a retry.
    it("does not let a bulk run spend the arena tier's allowance", () => {
        const budget = new RetryBudget({ windowMs: 60_000, maxFraction: 0.25, minInWindow: 0 });

        // The tick's requests for this minute, dispatched before the flood arrives.
        for (let i = 0; i < 40; i++) budget.recordDispatch(PRIORITY.ARENA_TICK, 0);

        // A nightly cycle failing throughout, spending every retry it is allowed to.
        for (let i = 0; i < 4_000; i++) budget.recordDispatch(PRIORITY.BULK, 0);
        let bulkRetries = 0;
        while (budget.tryConsume(PRIORITY.BULK, 0)) bulkRetries++;
        assert.ok(bulkRetries > 0, "the bulk tier should have had an allowance to spend");
        assert.strictEqual(budget.tryConsume(PRIORITY.BULK, 0), false, "and it should now be spent");

        // One of the tick's requests comes back with a transient failure. Dropping it here loses
        // that account's payout alert for the minute.
        assert.strictEqual(budget.tryConsume(PRIORITY.ARENA_TICK, 0), true, "the tick's own allowance must be untouched by bulk");
    });

    it("gives each tier an allowance funded by its own dispatches", () => {
        const budget = new RetryBudget({ windowMs: 60_000, maxFraction: 0.25, minInWindow: 0 });
        for (let i = 0; i < 100; i++) budget.recordDispatch(PRIORITY.BULK, 0);
        for (let i = 0; i < 8; i++) budget.recordDispatch(PRIORITY.ARENA_TICK, 0);

        let tickRetries = 0;
        while (budget.tryConsume(PRIORITY.ARENA_TICK, 0)) tickRetries++;
        assert.strictEqual(tickRetries, 2, "25 percent of the tick's own eight dispatches, not of the bulk traffic beside it");
    });

    it("applies the floor per tier, so a quiet top tier can still retry during an outage", () => {
        const budget = new RetryBudget({ windowMs: 60_000, maxFraction: 0.25, minInWindow: 10 });

        // Bulk exhausts everything it is entitled to, floor included.
        for (let i = 0; i < 1_000; i++) budget.recordDispatch(PRIORITY.BULK, 0);
        while (budget.tryConsume(PRIORITY.BULK, 0)) {
            // spend it all
        }

        budget.recordDispatch(PRIORITY.ARENA_TICK, 0);
        assert.strictEqual(budget.tryConsume(PRIORITY.ARENA_TICK, 0), true, "one tick request failing must still be retryable");
    });

    it("reports granted and denied retries per tier, so starvation is visible on /status", () => {
        const budget = new RetryBudget({ windowMs: 60_000, maxFraction: 0.25, minInWindow: 0 });
        for (let i = 0; i < 4; i++) budget.recordDispatch(PRIORITY.BULK, 0);

        budget.tryConsume(PRIORITY.BULK, 0);
        budget.tryConsume(PRIORITY.BULK, 0);
        budget.tryConsume(PRIORITY.ARENA_TICK, 0);

        const metrics = budget.metrics();
        assert.strictEqual(metrics.granted[PRIORITY.BULK], 1, "one retry is 25 percent of four dispatches");
        assert.strictEqual(metrics.denied[PRIORITY.BULK], 1);
        assert.strictEqual(metrics.denied[PRIORITY.ARENA_TICK], 1, "a tier with no dispatches of its own has nothing to spend");
    });
});
