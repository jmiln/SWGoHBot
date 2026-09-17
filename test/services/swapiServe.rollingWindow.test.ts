import assert from "node:assert";
import { describe, it } from "node:test";
import { STATUS_WINDOW } from "../../data/constants/swapiServe.ts";
import { RollingWindow } from "../../services/swapiServe/rollingWindow.ts";

const SERIES = "completed";

describe("swapiServe.RollingWindow", () => {
    it("reports nothing for a series that has never been recorded", () => {
        const window = new RollingWindow();

        assert.deepStrictEqual(window.metrics(0).series, {});
    });

    it("summarises a series as count, mean and max", () => {
        const window = new RollingWindow();
        window.record(SERIES, 100, 1000);
        window.record(SERIES, 300, 2000);

        const series = window.metrics(3000).series[SERIES];
        assert.strictEqual(series.count, 2);
        assert.strictEqual(series.mean, 200);
        assert.strictEqual(series.max, 300);
    });

    // The whole point of the window: a dashboard that keeps no state of its own still gets a rate.
    it("derives a per-second rate the caller does not have to compute", () => {
        const window = new RollingWindow();
        for (let i = 0; i < 120; i++) window.record(SERIES, 0, i * 500);

        assert.strictEqual(window.metrics(60_000).series[SERIES].perSecond, 2);
    });

    it("drops samples that have aged out of the window", () => {
        const window = new RollingWindow();
        window.record(SERIES, 0, 0);

        assert.strictEqual(window.metrics(1000).series[SERIES].count, 1);
        assert.deepStrictEqual(window.metrics(STATUS_WINDOW.WINDOW_MS * 2).series, {});
    });

    // A lifetime max never decays, which is what made `latencyMs.max` useless on a dashboard.
    it("lets the max fall again once the peak ages out", () => {
        const window = new RollingWindow();
        window.record(SERIES, 9000, 0);
        window.record(SERIES, 100, STATUS_WINDOW.WINDOW_MS - STATUS_WINDOW.BUCKET_MS);

        const later = STATUS_WINDOW.WINDOW_MS + STATUS_WINDOW.BUCKET_MS;
        assert.strictEqual(window.metrics(later).series[SERIES].max, 100);
    });

    it("keeps series apart", () => {
        const window = new RollingWindow();
        window.record("blockedSlot", 0, 1000);
        window.record("blockedToken", 0, 1000);
        window.record("blockedToken", 0, 2000);

        const { series } = window.metrics(3000);
        assert.strictEqual(series.blockedSlot.count, 1);
        assert.strictEqual(series.blockedToken.count, 2);
    });

    // A service seconds old must not read as 60s of near-silence, nor divide by a millisecond and
    // report a rate in the thousands.
    it("never reports a rate over a span shorter than one bucket", () => {
        const window = new RollingWindow();
        window.record(SERIES, 0, 0);

        assert.strictEqual(window.metrics(1).series[SERIES].perSecond, 1000 / STATUS_WINDOW.BUCKET_MS);
    });

    it("reports how much time the numbers actually cover", () => {
        const window = new RollingWindow();
        window.record(SERIES, 0, 0);

        assert.strictEqual(window.metrics(10_000).coveredMs, 10_000);
        assert.strictEqual(window.metrics(600_000).coveredMs, STATUS_WINDOW.WINDOW_MS);
    });
});
