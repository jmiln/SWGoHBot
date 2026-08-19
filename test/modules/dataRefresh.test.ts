import assert from "node:assert/strict";
import { mkdtemp, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import { QUIESCENCE_MS, checkAndRefresh, resetDataRefreshState, startDataRefresh, stopDataRefresh } from "../../modules/dataRefresh.ts";
import logger from "../../modules/Logger.ts";
import type { RefreshCount, RefreshSource } from "../../types/types.ts";

const MINUTE = 60 * 1000;

let dir: string;
let filePath: string;
let calls: number;
let logged: string[];
let originalLog: typeof logger.log;
let originalDebug: typeof logger.debug;
let originalError: typeof logger.error;

/** A source whose refresh just counts invocations. */
function makeSource(overrides: Partial<RefreshSource> = {}): RefreshSource {
    return {
        name: "fake",
        files: [filePath],
        refresh: async (): Promise<RefreshCount[]> => {
            calls++;
            return [{ label: "fake", total: 3, noun: "keys" }];
        },
        ...overrides,
    };
}

/** Set the file's mtime to a fixed instant so quiescence can be driven deterministically. */
async function setMtime(atMs: number): Promise<void> {
    await utimes(filePath, new Date(atMs), new Date(atMs));
}

beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), "datarefresh-"));
    filePath = path.join(dir, "characters.json");
    await writeFile(filePath, JSON.stringify([{ uniqueName: "A" }]));
    calls = 0;
    logged = [];
    resetDataRefreshState();
    originalLog = logger.log;
    originalDebug = logger.debug;
    originalError = logger.error;
    logger.log = (content: unknown) => {
        logged.push(String(content));
    };
    logger.debug = (content: unknown) => {
        logged.push(String(content));
    };
    logger.error = (content: unknown) => {
        logged.push(String(content));
    };
});

afterEach(() => {
    logger.log = originalLog;
    logger.debug = originalDebug;
    logger.error = originalError;
});

describe("checkAndRefresh", () => {
    it("treats the first check as a baseline and does not refresh", async () => {
        const now = Date.now();
        await setMtime(now - 10 * MINUTE);

        const refreshed = await checkAndRefresh([makeSource()], now);

        assert.equal(refreshed, false);
        assert.equal(calls, 0, "boot baseline must not trigger a refresh of data just loaded");
    });

    it("does not refresh when no mtime has changed", async () => {
        const now = Date.now();
        await setMtime(now - 10 * MINUTE);
        const source = makeSource();

        await checkAndRefresh([source], now);
        const refreshed = await checkAndRefresh([source], now + MINUTE);

        assert.equal(refreshed, false);
        assert.equal(calls, 0);
    });

    it("does not refresh while the newest write is still inside the quiescence window", async () => {
        const now = Date.now();
        await setMtime(now - 30 * MINUTE);
        const source = makeSource();
        await checkAndRefresh([source], now);

        await setMtime(now - 30 * 1000);
        const refreshed = await checkAndRefresh([source], now);

        assert.equal(refreshed, false, "a cycle still writing must be skipped");
        assert.equal(calls, 0);
    });

    it("refreshes once the newest write has settled past the quiescence window", async () => {
        const now = Date.now();
        await setMtime(now - 30 * MINUTE);
        const source = makeSource();
        await checkAndRefresh([source], now);

        const settled = now - QUIESCENCE_MS - MINUTE;
        await setMtime(settled);
        const refreshed = await checkAndRefresh([source], now);

        assert.equal(refreshed, true);
        assert.equal(calls, 1);
    });

    it("does not refresh again when nothing further changed", async () => {
        const now = Date.now();
        await setMtime(now - 30 * MINUTE);
        const source = makeSource();
        await checkAndRefresh([source], now);
        await setMtime(now - QUIESCENCE_MS - MINUTE);
        await checkAndRefresh([source], now);

        const refreshed = await checkAndRefresh([source], now + MINUTE);

        assert.equal(refreshed, false);
        assert.equal(calls, 1, "a completed refresh must advance the baseline");
    });

    it("retries on the next tick when a source throws, and reports that nothing changed", async () => {
        const now = Date.now();
        await setMtime(now - 30 * MINUTE);
        let attempts = 0;
        const source = makeSource({
            refresh: async (): Promise<RefreshCount[]> => {
                attempts++;
                if (attempts === 1) throw new Error("Unexpected end of JSON input");
                calls++;
                return [{ label: "fake", total: 3, noun: "keys" }];
            },
        });
        await checkAndRefresh([source], now);
        await setMtime(now - QUIESCENCE_MS - MINUTE);

        const failed = await checkAndRefresh([source], now);
        const recovered = await checkAndRefresh([source], now + MINUTE);

        assert.equal(failed, false);
        assert.equal(recovered, true, "a failed refresh must not advance the baseline");
        assert.equal(calls, 1);
        assert.ok(
            logged.some((line) => line.includes("aborted") && line.includes("no data changed")),
            `expected an abort log stating no data changed, got: ${logged.join(" | ")}`,
        );
    });

    it("logs the changed file names on detection and the per-dataset counts on success", async () => {
        const now = Date.now();
        await setMtime(now - 30 * MINUTE);
        const source = makeSource({
            refresh: async (): Promise<RefreshCount[]> => [
                { label: "characters", total: 312, added: 2, removed: 0, updated: 47 },
                { label: "omicrons", total: 94, noun: "keys" },
            ],
        });
        await checkAndRefresh([source], now);
        await setMtime(now - QUIESCENCE_MS - MINUTE);

        await checkAndRefresh([source], now);

        const detection = logged.find((line) => line.includes("Detected"));
        assert.ok(detection, `expected a detection log, got: ${logged.join(" | ")}`);
        assert.ok(detection.includes("characters.json"), "detection log must name the changed files");

        const applied = logged.find((line) => line.includes("Refreshed"));
        assert.ok(applied, `expected an applied log, got: ${logged.join(" | ")}`);
        assert.ok(applied.includes("characters 312 (+2 added, -0 removed, 47 updated)"), applied);
        assert.ok(applied.includes("omicrons 94 keys"), applied);
    });

    it("reports a dataset whose contents did not change rather than omitting it", async () => {
        const now = Date.now();
        await setMtime(now - 30 * MINUTE);
        const source = makeSource({
            refresh: async (): Promise<RefreshCount[]> => [{ label: "ships", total: 148, added: 0, removed: 0, updated: 0 }],
        });
        await checkAndRefresh([source], now);
        await setMtime(now - QUIESCENCE_MS - MINUTE);

        await checkAndRefresh([source], now);

        const applied = logged.find((line) => line.includes("Refreshed"));
        assert.ok(applied?.includes("ships 148 (unchanged)"), `got: ${applied}`);
    });

    it("ignores a watched file that does not exist yet", async () => {
        const now = Date.now();
        await setMtime(now - 30 * MINUTE);
        const source = makeSource({ files: [filePath, path.join(dir, "unitNames.json")] });

        const refreshed = await checkAndRefresh([source], now);

        assert.equal(refreshed, false);
        assert.ok(
            !logged.some((line) => line.includes("ENOENT")),
            "a not-yet-generated file is expected, not an error",
        );
    });
});

describe("startDataRefresh / stopDataRefresh", () => {
    it("clears its interval so a shutdown is not held open by it", () => {
        const before = process.getActiveResourcesInfo().filter((name) => name === "Timeout").length;

        startDataRefresh([makeSource()]);
        const during = process.getActiveResourcesInfo().filter((name) => name === "Timeout").length;
        stopDataRefresh();
        const after = process.getActiveResourcesInfo().filter((name) => name === "Timeout").length;

        assert.equal(during, before + 1, "starting must register exactly one timer");
        assert.equal(after, before, "stopping must leave no timer behind");
    });

    it("does not start a second interval if called twice", () => {
        startDataRefresh([makeSource()]);
        const during = process.getActiveResourcesInfo().filter((name) => name === "Timeout").length;
        startDataRefresh([makeSource()]);
        const afterSecond = process.getActiveResourcesInfo().filter((name) => name === "Timeout").length;
        stopDataRefresh();

        assert.equal(afterSecond, during, "a second start must be a no-op while one is running");
    });
});
