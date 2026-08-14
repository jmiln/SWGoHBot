import assert from "node:assert";
import { describe, it } from "node:test";
import { TokenBucket } from "../../services/swapiServe/tokenBucket.ts";

describe("swapiServe.TokenBucket", () => {
    it("starts full to its burst capacity", () => {
        const bucket = new TokenBucket({ ratePerSecond: 10, burstFactor: 2 });
        for (let i = 0; i < 20; i++) {
            assert.strictEqual(bucket.tryTake(0), true, `token ${i} should be available`);
        }
        assert.strictEqual(bucket.tryTake(0), false, "should be empty after the burst");
    });

    it("refills at the configured rate over time", () => {
        const bucket = new TokenBucket({ ratePerSecond: 10, burstFactor: 2 });
        while (bucket.tryTake(0)) {
            // drain
        }

        // 10 per second means one token every 100ms
        assert.strictEqual(bucket.tryTake(99), false, "not quite a full token yet");
        assert.strictEqual(bucket.tryTake(100), true, "one token after 100ms");
        assert.strictEqual(bucket.tryTake(100), false, "only one token was earned");
    });

    it("does not refill beyond burst capacity however long it idles", () => {
        const bucket = new TokenBucket({ ratePerSecond: 10, burstFactor: 2 });
        while (bucket.tryTake(0)) {
            // drain
        }

        let taken = 0;
        while (bucket.tryTake(60_000)) taken++;
        assert.strictEqual(taken, 20, "a long idle should bank at most the burst capacity");
    });

    it("reports how long until the next token is due", () => {
        const bucket = new TokenBucket({ ratePerSecond: 10, burstFactor: 2 });
        while (bucket.tryTake(0)) {
            // drain
        }

        assert.strictEqual(bucket.msUntilNextToken(0), 100);
        assert.strictEqual(bucket.msUntilNextToken(50), 50);
    });

    it("reports zero wait when a token is already available", () => {
        const bucket = new TokenBucket({ ratePerSecond: 10, burstFactor: 2 });
        assert.strictEqual(bucket.msUntilNextToken(0), 0);
    });

    it("applies a new rate without losing banked tokens", () => {
        const bucket = new TokenBucket({ ratePerSecond: 10, burstFactor: 2 });
        bucket.setRate(20);

        assert.strictEqual(bucket.getRate(), 20);
        assert.strictEqual(bucket.tryTake(0), true);
    });

    it("shrinks banked tokens when the new rate lowers the burst ceiling", () => {
        const bucket = new TokenBucket({ ratePerSecond: 10, burstFactor: 2 });
        bucket.setRate(1);

        let taken = 0;
        while (bucket.tryTake(0)) taken++;
        assert.strictEqual(taken, 2, "burst ceiling should follow the reduced rate");
    });

    it("returns a refunded token without exceeding capacity", () => {
        const bucket = new TokenBucket({ ratePerSecond: 10, burstFactor: 2 });
        assert.strictEqual(bucket.tryTake(0), true);
        bucket.refund();

        let taken = 0;
        while (bucket.tryTake(0)) taken++;
        assert.strictEqual(taken, 20, "refund should restore the token but not overfill");
    });
});
