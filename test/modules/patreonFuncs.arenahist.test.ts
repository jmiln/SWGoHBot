import assert from "node:assert";
import { describe, it } from "node:test";
import { buildArenaHistChart } from "../../modules/patreonFuncs.ts";
import type { ArenaHistEntry } from "../../types/types.ts";

const DAY_MS = 24 * 60 * 60 * 1000;

// Fixed reference point: 2026-06-09 12:00 UTC — injected so tests are deterministic
const NOW = Date.UTC(2026, 5, 9, 12, 0, 0);

function makeEntry(daysAgo: number, rank: number): ArenaHistEntry {
    return { rank, ts: NOW - daysAgo * DAY_MS };
}

describe("buildArenaHistChart", () => {
    it("returns null when both arrays are empty", () => {
        assert.strictEqual(buildArenaHistChart([], [], 7, NOW, "Test"), null);
    });

    it("returns null when both arrays are undefined", () => {
        assert.strictEqual(buildArenaHistChart(undefined, undefined, 7, NOW, "Test"), null);
    });

    it("returns null when all entries are outside the window", () => {
        const charHist = [makeEntry(10, 99)]; // 10 days ago — outside 7-day window
        assert.strictEqual(buildArenaHistChart(charHist, [], 7, NOW, "Test"), null);
    });

    it("returns one dataset when only charHist has in-window data", () => {
        const result = buildArenaHistChart([makeEntry(2, 50)], [], 7, NOW, "Test");
        assert.ok(result);
        assert.strictEqual(result.datasets.length, 1);
        assert.strictEqual(result.datasets[0].label, "Char Arena");
    });

    it("returns one dataset when only shipHist has in-window data", () => {
        const result = buildArenaHistChart([], [makeEntry(2, 30)], 7, NOW, "Test");
        assert.ok(result);
        assert.strictEqual(result.datasets.length, 1);
        assert.strictEqual(result.datasets[0].label, "Fleet Arena");
    });

    it("returns two datasets when both arrays have in-window data", () => {
        const result = buildArenaHistChart([makeEntry(2, 50)], [makeEntry(2, 30)], 7, NOW, "Test");
        assert.ok(result);
        assert.strictEqual(result.datasets.length, 2);
    });

    it("generates exactly windowDays labels", () => {
        const result7 = buildArenaHistChart([makeEntry(1, 40)], [], 7, NOW, "Test");
        assert.ok(result7);
        assert.strictEqual(result7.labels.length, 7);

        const result30 = buildArenaHistChart([makeEntry(1, 40)], [], 30, NOW, "Test");
        assert.ok(result30);
        assert.strictEqual(result30.labels.length, 30);
    });

    it("maps an entry to the correct day index", () => {
        // makeEntry(2, 42) → Jun 7 noon UTC
        // 7-day window ending Jun 9: dates[0]=Jun3 … dates[4]=Jun7 … dates[6]=Jun9
        const result = buildArenaHistChart([makeEntry(2, 42)], [], 7, NOW, "Test");
        assert.ok(result);
        assert.strictEqual(result.datasets[0].data[4], 42);
    });

    it("places null for days with no entry", () => {
        // Only today (daysAgo=0 → dates[6])
        const result = buildArenaHistChart([makeEntry(0, 10)], [], 7, NOW, "Test");
        assert.ok(result);
        const data = result.datasets[0].data;
        for (let i = 0; i < data.length - 1; i++) {
            assert.strictEqual(data[i], null, `expected null at index ${i}`);
        }
        assert.strictEqual(data[6], 10);
    });

    it("includes partial data over full label range when window > history", () => {
        // 3 days of data inside a 30-day window
        const charHist = [makeEntry(1, 20), makeEntry(2, 25), makeEntry(3, 30)];
        const result = buildArenaHistChart(charHist, [], 30, NOW, "Test");
        assert.ok(result);
        assert.strictEqual(result.labels.length, 30);
        const nonNull = result.datasets[0].data.filter(d => d !== null);
        assert.strictEqual(nonNull.length, 3);
    });

    it("uses weekly ticks for 90-day window — non-multiple-of-7 labels are empty strings", () => {
        const result = buildArenaHistChart([makeEntry(1, 50)], [], 90, NOW, "Test");
        assert.ok(result);
        assert.strictEqual(result.labels.length, 90);
        const wronglyFilled = result.labels.filter((l, i) => i % 7 !== 0 && l !== "");
        assert.strictEqual(wronglyFilled.length, 0);
        assert.ok(result.labels[0].length > 0, "first label should be a non-empty date string");
    });

    it("includes the label in the chart title", () => {
        const result = buildArenaHistChart([makeEntry(1, 50)], [], 7, NOW, "MyPlayer (123456789)");
        assert.ok(result);
        assert.ok(result.title.includes("MyPlayer (123456789)"), `title was: ${result.title}`);
    });

    it("includes windowDays in the title", () => {
        const result = buildArenaHistChart([makeEntry(1, 50)], [], 30, NOW, "Test");
        assert.ok(result);
        assert.ok(result.title.includes("30"), `title was: ${result.title}`);
    });

    it("chart dimensions are 800x400", () => {
        const result = buildArenaHistChart([makeEntry(1, 50)], [], 7, NOW, "Test");
        assert.ok(result);
        assert.strictEqual(result.width, 800);
        assert.strictEqual(result.height, 400);
    });

    it("char dataset uses blue color, fleet dataset uses orange with borderDash", () => {
        const result = buildArenaHistChart([makeEntry(1, 50)], [makeEntry(1, 20)], 7, NOW, "Test");
        assert.ok(result);
        const char = result.datasets.find(d => d.label === "Char Arena");
        const fleet = result.datasets.find(d => d.label === "Fleet Arena");
        assert.ok(char);
        assert.ok(fleet);
        assert.strictEqual(char.borderColor, "#4a90d9");
        assert.strictEqual(fleet.borderColor, "#e8874a");
        assert.deepStrictEqual(fleet.borderDash, [6, 4]);
    });

    it("includes entries at exactly windowStart and excludes entries 1ms before it", () => {
        // 7-day window ending NOW (Jun 9 noon): dates[0] = Jun 3 noon, windowStart = midnight Jun 3 UTC
        const jun3Midnight = Date.UTC(2026, 5, 3);
        const inWindow = [{ rank: 55, ts: jun3Midnight }];
        const outOfWindow = [{ rank: 99, ts: jun3Midnight - 1 }];

        const resultIn = buildArenaHistChart(inWindow, [], 7, NOW, "Test");
        assert.ok(resultIn, "entry at windowStart should be included");

        const resultOut = buildArenaHistChart(outOfWindow, [], 7, NOW, "Test");
        assert.strictEqual(resultOut, null, "entry 1ms before windowStart should be excluded");
    });
});
