import assert from "node:assert";
import { describe, it } from "node:test";
import { eachLimit } from "../../modules/utils/concurrency.ts";

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

describe("eachLimit", () => {
    it("visits every item exactly once", async () => {
        const items = ["a", "b", "c", "d", "e"];
        const seen: string[] = [];
        await eachLimit(items, 2, async (item) => {
            seen.push(item);
        });
        assert.deepStrictEqual(seen.sort(), [...items].sort());
    });

    it("starts items in order", async () => {
        const started: number[] = [];
        await eachLimit([0, 1, 2, 3, 4, 5], 2, async (n) => {
            started.push(n);
            await sleep(1);
        });
        assert.deepStrictEqual(started, [0, 1, 2, 3, 4, 5]);
    });

    it("never exceeds the concurrency limit", async () => {
        let inFlight = 0;
        let peak = 0;
        await eachLimit(Array.from({ length: 40 }, (_, i) => i), 5, async () => {
            inFlight++;
            peak = Math.max(peak, inFlight);
            await sleep(1);
            inFlight--;
        });
        assert.strictEqual(peak, 5, `expected peak in-flight of 5, saw ${peak}`);
    });

    it("actually runs work concurrently rather than serially", async () => {
        // 8 items x 10ms: ~80ms serial, ~20ms at 4 wide. 60ms tolerates a loaded box, fails serial.
        const start = Date.now();
        await eachLimit([1, 2, 3, 4, 5, 6, 7, 8], 4, async () => {
            await sleep(10);
        });
        const elapsed = Date.now() - start;
        assert.ok(elapsed < 60, `expected concurrent execution, took ${elapsed}ms`);
    });

    it("caps concurrency at the item count when the limit is larger", async () => {
        let peak = 0;
        let inFlight = 0;
        await eachLimit([1, 2], 250, async () => {
            inFlight++;
            peak = Math.max(peak, inFlight);
            await sleep(1);
            inFlight--;
        });
        assert.strictEqual(peak, 2);
    });

    it("resolves immediately on an empty collection without calling the iteratee", async () => {
        let calls = 0;
        await eachLimit([], 4, async () => {
            calls++;
        });
        assert.strictEqual(calls, 0);
    });

    it("rejects with the first error", async () => {
        const boom = new Error("boom");
        await assert.rejects(
            eachLimit([1, 2, 3], 2, async (n) => {
                if (n === 2) throw boom;
            }),
            (err: unknown) => err === boom,
        );
    });

    it("stops starting new items once one has failed", async () => {
        const started: number[] = [];
        await assert.rejects(
            eachLimit([1, 2, 3, 4, 5, 6, 7, 8], 1, async (n) => {
                started.push(n);
                if (n === 3) throw new Error("boom");
            }),
        );
        assert.deepStrictEqual(started, [1, 2, 3], `expected to stop after the failure, started ${started}`);
    });

    it("waits for in-flight items to settle before rejecting", async () => {
        let finished = 0;
        await assert.rejects(
            eachLimit([1, 2, 3, 4], 4, async (n) => {
                if (n === 1) throw new Error("boom");
                await sleep(5);
                finished++;
            }),
        );
        assert.strictEqual(finished, 3, `expected the 3 healthy items to finish, got ${finished}`);
    });

    it("reports the first error when several fail", async () => {
        const first = new Error("first");
        await assert.rejects(
            eachLimit([1, 2], 1, async (n) => {
                if (n === 1) throw first;
                throw new Error("second");
            }),
            (err: unknown) => err === first,
        );
    });

    it("rejects a concurrency limit below 1", async () => {
        await assert.rejects(
            eachLimit([1, 2], 0, async () => {}),
            RangeError,
        );
    });

    it("rejects a non-integer concurrency limit", async () => {
        await assert.rejects(
            eachLimit([1, 2], 2.5, async () => {}),
            RangeError,
        );
    });
});
