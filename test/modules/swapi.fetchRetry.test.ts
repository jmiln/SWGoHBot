import assert from "node:assert";
import { describe, it } from "node:test";
import { createRetryBudget, fetchWithRetry, isNonRetryableFetchError, type RetryBudget } from "../../modules/swapi.ts";

// Arena/player fetches against comlink intermittently fail with transient errors
// (502 Bad Gateway, timeouts, the generic sentry "An error occurred" message).
// A single such blip was permanently dropping the player from the tick because
// per-player failures were swallowed with no retry. fetchWithRetry isolates the
// retry/backoff + retryable-vs-not classification so it can be tested
// without a live comlink connection.
describe("swapi.fetchWithRetry", () => {
    it("returns the value on first success without retrying", async () => {
        let calls = 0;
        const result = await fetchWithRetry(
            async () => {
                calls++;
                return "ok";
            },
            { retries: 2, baseDelayMs: 0 },
        );
        assert.strictEqual(result, "ok");
        assert.strictEqual(calls, 1, "should not retry a call that succeeds immediately");
    });

    it("retries a transient failure and returns the eventual success", async () => {
        let calls = 0;
        const result = await fetchWithRetry(
            async () => {
                calls++;
                if (calls < 3) throw new Error("Response code 502 (Bad Gateway)");
                return "recovered";
            },
            { retries: 2, baseDelayMs: 0 },
        );
        assert.strictEqual(result, "recovered");
        assert.strictEqual(calls, 3, "should retry twice before the third attempt succeeds");
    });

    it("gives up and returns null after exhausting retries on persistent transient errors", async () => {
        let calls = 0;
        let gaveUpMessage: string | null = null;
        const result = await fetchWithRetry(
            async () => {
                calls++;
                throw new Error("An error occurred. For more information, enable sentry.io");
            },
            {
                retries: 2,
                baseDelayMs: 0,
                onGiveUp: (message) => {
                    gaveUpMessage = message;
                },
            },
        );
        assert.strictEqual(result, null);
        assert.strictEqual(calls, 3, "one initial attempt plus two retries");
        assert.ok(gaveUpMessage?.includes("An error occurred"), "onGiveUp should receive the final error message");
    });

    it("does not retry a 'Failed to find ally code' failure", async () => {
        let calls = 0;
        const result = await fetchWithRetry(
            async () => {
                calls++;
                throw new Error("Failed to find ally code 999547527");
            },
            { retries: 2, baseDelayMs: 0 },
        );
        assert.strictEqual(result, null);
        assert.strictEqual(calls, 1, "a dead/renamed ally code will never resolve - retrying wastes API calls");
    });
});

// Per-ally-code retries are the right call for an isolated blip, but they are issued inside
// eachLimit(MAX_CONCURRENT), where each backoff holds a concurrency slot. A comlink-wide outage
// (502s, timeouts) is retryable by classification, so without a shared ceiling every watched
// account pays three attempts plus backoff at once - which stretches an arena tick past its
// minute, and clientReady's arenaTickRunning guard then drops the whole next minute.
describe("swapi.fetchWithRetry retry budget", () => {
    it("stops retrying once the shared budget is spent", async () => {
        const budget: RetryBudget = { remaining: 1 };
        const attempts: number[] = [];

        for (let i = 0; i < 3; i++) {
            let calls = 0;
            await fetchWithRetry(
                async () => {
                    calls++;
                    throw new Error("Response code 502 (Bad Gateway)");
                },
                { retries: 2, baseDelayMs: 0, budget },
            );
            attempts.push(calls);
        }

        // First call spends the single retry the budget allows; everything after it fails once
        // and is dropped, so a systemic outage costs one attempt per account, not three.
        assert.deepStrictEqual(attempts, [2, 1, 1]);
    });

    it("leaves the budget alone when calls succeed", async () => {
        const budget: RetryBudget = { remaining: 5 };
        for (let i = 0; i < 5; i++) {
            await fetchWithRetry(async () => "ok", { retries: 2, baseDelayMs: 0, budget });
        }
        assert.strictEqual(budget.remaining, 5, "a healthy batch must not erode the budget");
    });

    it("does not spend budget on non-retryable errors", async () => {
        const budget: RetryBudget = { remaining: 5 };
        await fetchWithRetry(
            async () => {
                throw new Error("Response code 429 (Too Many Requests)");
            },
            { retries: 2, baseDelayMs: 0, budget },
        );
        assert.strictEqual(budget.remaining, 5, "an error we never retry must not consume a retry");
    });

    it("retries normally when no budget is supplied", async () => {
        let calls = 0;
        await fetchWithRetry(
            async () => {
                calls++;
                throw new Error("Response code 502 (Bad Gateway)");
            },
            { retries: 2, baseDelayMs: 0 },
        );
        assert.strictEqual(calls, 3, "an unbudgeted call keeps the existing retry behaviour");
    });
});

describe("swapi.createRetryBudget", () => {
    // Scales with the batch so a big tick gets proportionally more slack, with a floor so a
    // handful of accounts still get their retries.
    it("scales with batch size above the floor", () => {
        assert.strictEqual(createRetryBudget(400).remaining, 100);
    });

    it("applies a floor for small batches", () => {
        assert.strictEqual(createRetryBudget(4).remaining, 10);
        assert.strictEqual(createRetryBudget(0).remaining, 10);
    });
});

describe("swapi.isNonRetryableFetchError", () => {
    it("treats a missing ally code as non-retryable", () => {
        assert.strictEqual(isNonRetryableFetchError("Failed to find ally code 999547527"), true);
    });

    it("treats a 502 / gateway error as transient", () => {
        assert.strictEqual(isNonRetryableFetchError("Response code 502 (Bad Gateway)"), false);
    });

    it("treats the generic sentry error as transient", () => {
        assert.strictEqual(isNonRetryableFetchError("An error occurred. For more information, enable sentry.io"), false);
    });

    // The comlink throttle is account-wide, so retrying a 429 in-tick multiplies the calls
    // that put us over the limit in the first place - drop the player and pick it up next tick.
    it("treats a rate limit as non-retryable", () => {
        assert.strictEqual(isNonRetryableFetchError("Response code 429 (Too Many Requests)"), true);
        assert.strictEqual(isNonRetryableFetchError("Request failed: rate limit exceeded"), true);
    });

    it("does not mistake an ally code containing 429 for a rate limit", () => {
        assert.strictEqual(isNonRetryableFetchError("Response code 502 for 429114295"), false);
    });

    // A rejected request is rejected identically on the next attempt, so retrying an auth or
    // bad-request failure only multiplies the call volume - and a rotated SWAPI_* credential
    // fails this way for every watched account at once, which is exactly when the extra
    // attempts and backoff can push an arena tick past its minute.
    it("treats auth and bad-request failures as non-retryable", () => {
        assert.strictEqual(isNonRetryableFetchError("Response code 401 (Unauthorized)"), true);
        assert.strictEqual(isNonRetryableFetchError("Response code 403 (Forbidden)"), true);
        assert.strictEqual(isNonRetryableFetchError("Response code 400 (Bad Request)"), true);
        assert.strictEqual(isNonRetryableFetchError("Response code 404 (Not Found)"), true);
    });

    // 408 is the one 4xx that describes a transient condition rather than a bad request
    it("treats a request timeout as transient", () => {
        assert.strictEqual(isNonRetryableFetchError("Response code 408 (Request Timeout)"), false);
    });

    it("treats 5xx failures other than the ones above as transient", () => {
        assert.strictEqual(isNonRetryableFetchError("Response code 503 (Service Unavailable)"), false);
        assert.strictEqual(isNonRetryableFetchError("Response code 504 (Gateway Timeout)"), false);
    });
});
