import { stat } from "node:fs/promises";
import path from "node:path";
import { refreshUnitData, UNIT_DATA_FILES } from "../data/constants/units.ts";
import type { RefreshCount, RefreshSource } from "../types/types.ts";
import { DATACRON_DATA_FILES, refreshDatacronData } from "./datacrons.ts";
import logger from "./Logger.ts";
import { refreshMapFiles, SWAPI_DATA_FILES } from "./swapi.ts";

/** How often to check whether anything on disk moved. The data changes at most once a day. */
export const TICK_MS = 15 * 60 * 1000;

/**
 * How long the newest write must have settled before a refresh runs. dataUpdater takes about
 * 7 minutes and writes its files one at a time, so reading mid-cycle would produce a set that is
 * individually valid but mutually inconsistent (new characters.json against old unitMap.json).
 * Per-file atomic writes would not help; this is a between-files problem.
 */
export const QUIESCENCE_MS = 2 * 60 * 1000;

// The newest mtime across all watched files as of the last successful refresh. Zero means no
// baseline has been taken yet, i.e. the process just booted and already holds current data.
let lastAppliedMtimeMs = 0;
let intervalId: NodeJS.Timeout | null = null;

/** Test seam: clears the baseline so each test starts from a boot-like state. */
export function resetDataRefreshState(): void {
    lastAppliedMtimeMs = 0;
}

/**
 * mtimes for every watched file. A file that does not exist is skipped rather than treated as an
 * error: unitNames.json is absent until dataUpdater's first run.
 */
async function statWatchedFiles(sources: RefreshSource[]): Promise<{ file: string; mtimeMs: number }[]> {
    const files = [...new Set(sources.flatMap((source) => source.files))];
    const results = await Promise.all(
        files.map(async (file) => {
            try {
                const info = await stat(file);
                return { file, mtimeMs: info.mtimeMs };
            } catch {
                return null;
            }
        }),
    );
    return results.filter((entry): entry is { file: string; mtimeMs: number } => entry !== null);
}

function agoLabel(ms: number): string {
    const minutes = Math.floor(ms / 60000);
    return minutes >= 1 ? `${minutes}m` : `${Math.floor(ms / 1000)}s`;
}

function formatCount(count: RefreshCount): string {
    if (count.added === undefined) return `${count.label} ${count.total} ${count.noun ?? "keys"}`;
    if (!count.added && !count.removed && !count.updated) return `${count.label} ${count.total} (unchanged)`;
    return `${count.label} ${count.total} (+${count.added} added, -${count.removed} removed, ${count.updated} updated)`;
}

/**
 * One tick. Returns true only when a refresh actually ran and applied.
 * `now` is injectable so tests can drive the quiescence window without sleeping.
 */
export async function checkAndRefresh(sources: RefreshSource[], now: number = Date.now()): Promise<boolean> {
    const stats = await statWatchedFiles(sources);
    if (!stats.length) return false;

    const newestMtimeMs = Math.max(...stats.map((entry) => entry.mtimeMs));

    // First tick after boot: the in-memory data was read from these same files moments ago, so
    // record where they stand and refresh nothing.
    if (lastAppliedMtimeMs === 0) {
        lastAppliedMtimeMs = newestMtimeMs;
        return false;
    }

    if (newestMtimeMs <= lastAppliedMtimeMs) return false;

    const settledForMs = now - newestMtimeMs;
    if (settledForMs < QUIESCENCE_MS) {
        logger.debug(`[DataRefresh] Changes detected but newest write is only ${agoLabel(settledForMs)} old. Waiting.`);
        return false;
    }

    const changed = stats.filter((entry) => entry.mtimeMs > lastAppliedMtimeMs).map((entry) => path.basename(entry.file));
    logger.log(
        `[DataRefresh] Detected ${changed.length} updated files (${changed.join(", ")}), newest write ${agoLabel(settledForMs)} ago. Refreshing.`,
    );

    const startedAt = Date.now();
    const counts: RefreshCount[] = [];
    for (const source of sources) {
        try {
            counts.push(...(await source.refresh()));
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            logger.error(`[DataRefresh] Refresh aborted, no data changed: ${source.name}: ${message}`);
            return false;
        }
    }

    lastAppliedMtimeMs = newestMtimeMs;
    logger.log(`[DataRefresh] Refreshed in ${Date.now() - startedAt}ms: ${counts.map(formatCount).join(", ")}`);
    return true;
}

/** Start the periodic check. Safe to call once per process, from swgohBot init. */
export function startDataRefresh(sources: RefreshSource[]): void {
    if (intervalId) return;
    intervalId = setInterval(() => {
        void checkAndRefresh(sources);
    }, TICK_MS);
}

/** Clear the timer so a shutdown is not held open by it. */
export function stopDataRefresh(): void {
    if (!intervalId) return;
    clearInterval(intervalId);
    intervalId = null;
    logger.log("[DataRefresh] Cleanup: cleared refresh interval");
}

/**
 * Every module that owns reloadable data files. A change to any watched file refreshes all three,
 * so the datasets stay consistent with each other rather than drifting apart.
 */
export function defaultSources(): RefreshSource[] {
    return [
        { name: "units", files: UNIT_DATA_FILES, refresh: refreshUnitData },
        { name: "datacrons", files: DATACRON_DATA_FILES, refresh: refreshDatacronData },
        { name: "swapiMaps", files: SWAPI_DATA_FILES, refresh: refreshMapFiles },
    ];
}
