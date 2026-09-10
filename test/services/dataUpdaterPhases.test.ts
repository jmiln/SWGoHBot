import assert from "node:assert";
import { describe, it } from "node:test";
import { PhaseTimer } from "../../services/dataUpdater.ts";

describe("PhaseTimer", () => {
    it("records a duration per completed phase", () => {
        let now = 0;
        const timer = new PhaseTimer(() => now);

        timer.start("metadata");
        now = 250;
        timer.end("metadata");

        assert.deepStrictEqual(timer.durations(), { metadata: 250 });
    });

    it("keeps phases separate and preserves start order", () => {
        let now = 0;
        const timer = new PhaseTimer(() => now);

        timer.start("metadata");
        now = 100;
        timer.end("metadata");
        timer.start("mods");
        now = 400;
        timer.end("mods");

        assert.deepStrictEqual(Object.keys(timer.durations()), ["metadata", "mods"]);
        assert.deepStrictEqual(timer.durations(), { metadata: 100, mods: 300 });
    });

    it("ignores an end with no matching start rather than recording a bogus duration", () => {
        const timer = new PhaseTimer(() => 0);
        timer.end("never-started");
        assert.deepStrictEqual(timer.durations(), {});
    });

    it("omits a phase that was started but never ended, so a crashed phase is visibly absent", () => {
        let now = 0;
        const timer = new PhaseTimer(() => now);

        timer.start("done");
        now = 10;
        timer.end("done");
        timer.start("crashed");

        assert.deepStrictEqual(timer.durations(), { done: 10 });
    });
});
