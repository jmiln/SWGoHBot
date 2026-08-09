import assert from "node:assert";
import { describe, it } from "node:test";
import { RetryBudget } from "../../services/swapiServe/retryBudget.ts";

describe("swapiServe.RetryBudget", () => {
    // The floor is what makes an isolated failure retryable at all: 25 percent of one dispatch
    // rounds to zero, so without it a quiet service would never retry anything.
    it("allows a minimum number of retries regardless of how little traffic there has been", () => {
        const budget = new RetryBudget({ windowMs: 1000, maxFraction: 0.25, minInWindow: 3 });
        budget.recordDispatch(0);

        assert.strictEqual(budget.tryConsume(0), true, "the first failure on a quiet service must be retryable");
        assert.strictEqual(budget.tryConsume(0), true);
        assert.strictEqual(budget.tryConsume(0), true);
        assert.strictEqual(budget.tryConsume(0), false, "but only up to the floor");
    });

    it("allows retries up to the configured fraction of dispatches", () => {
        const budget = new RetryBudget({ windowMs: 1000, maxFraction: 0.25, minInWindow: 0 });
        for (let i = 0; i < 100; i++) budget.recordDispatch(0);

        for (let i = 0; i < 25; i++) {
            assert.strictEqual(budget.tryConsume(0), true, `retry ${i} should be allowed`);
        }
        assert.strictEqual(budget.tryConsume(0), false, "the 26th retry exceeds 25 percent of 100");
    });

    it("refuses every retry when nothing has been dispatched", () => {
        const budget = new RetryBudget({ windowMs: 1000, maxFraction: 0.25, minInWindow: 0 });
        assert.strictEqual(budget.tryConsume(0), false);
    });

    it("forgets dispatches and retries that fall outside the window", () => {
        const budget = new RetryBudget({ windowMs: 1000, maxFraction: 0.5, minInWindow: 0 });
        for (let i = 0; i < 10; i++) budget.recordDispatch(0);
        for (let i = 0; i < 5; i++) budget.tryConsume(0);
        assert.strictEqual(budget.tryConsume(0), false, "budget is spent within the window");

        // Everything above ages out; a fresh dispatch gives a fresh allowance
        for (let i = 0; i < 10; i++) budget.recordDispatch(2000);
        assert.strictEqual(budget.tryConsume(2000), true);
    });

    it("scales the allowance with recent traffic", () => {
        const budget = new RetryBudget({ windowMs: 1000, maxFraction: 0.25, minInWindow: 0 });
        for (let i = 0; i < 4; i++) budget.recordDispatch(0);

        assert.strictEqual(budget.tryConsume(0), true, "one retry is 25 percent of four dispatches");
        assert.strictEqual(budget.tryConsume(0), false);
    });
});
