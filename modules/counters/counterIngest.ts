import { eachLimit } from "async";
import type { CounterMetadata } from "../../schemas/counters.schema.ts";
import cache from "../cache.ts";
import logger from "../Logger.ts";
import { type Accumulator, type BuildOptions, buildCounterDocs, foldPlayer } from "./counterAggregator.ts";
import { readMetadata, writeMetadata } from "./counterMetadata.ts";
import type { GahistoryClient, InfoDoc, Mode } from "./gahistoryClient.ts";

const COLLECTION = "counterData";
export const MODES: Mode[] = ["5v5", "3v3"];

export function shouldIngest(info: InfoDoc, meta: CounterMetadata | null): boolean {
    return !meta || meta.lastInstanceId !== info.instanceId;
}

export interface RunDeps {
    client: GahistoryClient;
    db: string;
    concurrency: number;
    options: BuildOptions;
    /** When true, emit per-batch fetch-progress heartbeats (off by default; too noisy otherwise). */
    debug?: boolean;
    /** Overrides the real metadata file. Tests MUST set this so they never write data/. */
    metaFile?: string;
}
export interface RunResult {
    mode: Mode;
    ingested: boolean;
    docCount: number;
}
export interface RunSummary {
    /** False when any mode threw. The caller sets a non-zero exit code from this. */
    ok: boolean;
    results: RunResult[];
}

export async function runMode(mode: Mode, deps: RunDeps): Promise<RunResult> {
    const { client, db, concurrency, options, debug, metaFile } = deps;
    logger.log(`[counterIngest] ${mode}: checking for a new event...`);
    const info = await client.getInfo(mode);
    const meta = await readMetadata(mode, metaFile);
    if (!shouldIngest(info, meta)) {
        logger.log(`[counterIngest] ${mode}: already at ${info.instanceId}, nothing to do`);
        return { mode, ingested: false, docCount: 0 };
    }

    const playerIds = await client.getPlayerIds(mode);
    const total = playerIds.length;
    // Heartbeat cadence: ~20 progress lines at most, but no sparser than every 500 players.
    const logEvery = Math.max(500, Math.ceil(total / 20));
    logger.log(`[counterIngest] ${mode}: new event ${info.instanceId}, fetching ${total} players...`);

    const acc: Accumulator = new Map();
    let processed = 0;
    let failed = 0;
    await eachLimit(playerIds, concurrency, async (playerId: string) => {
        try {
            const doc = await client.getPlayer(mode, playerId);
            if (doc) foldPlayer(acc, doc);
        } catch (err) {
            failed++;
            logger.error(`[counterIngest] ${mode} player ${playerId} failed: ${err instanceof Error ? err.message : String(err)}`);
        } finally {
            processed++;
            if (debug && processed % logEvery === 0) logger.log(`[counterIngest] ${mode}: ${processed}/${total} players fetched`);
        }
    });
    logger.log(`[counterIngest] ${mode}: fetch complete (${failed} failed), building counter docs...`);

    const docs = buildCounterDocs(acc, { mode, instanceId: info.instanceId, season: info.season }, options);
    if (!playerIds.length || !docs.length) {
        // The upstream may publish info.json before the player data is fully posted. If we got no
        // players or no qualifying docs, treat the event as not-yet-ready: leave the existing docs
        // and metadata untouched so the next run retries, rather than pruning good data for weeks.
        logger.warn(
            `[counterIngest] ${mode}: no data yet (players=${playerIds.length}, docs=${docs.length}); leaving metadata + existing docs intact`,
        );
        return { mode, ingested: false, docCount: 0 };
    }

    await cache.putMany(
        db,
        COLLECTION,
        docs.map((doc) => ({
            updateOne: {
                filter: { mode: doc.mode, battleType: doc.battleType, leader: doc.leader },
                update: { $set: doc },
                upsert: true,
            },
        })),
    );
    // Prune counter docs from older events for this mode.
    await cache.delete(db, COLLECTION, { mode, leader: { $exists: true }, instanceId: { $ne: info.instanceId } });
    // Update the metadata LAST so a mid-run crash simply re-runs next time.
    await writeMetadata(
        mode,
        {
            lastInstanceId: info.instanceId,
            season: info.season,
            status: "ok",
            ingestedAt: new Date().toISOString(),
            leaderDocs: docs.length,
            players: total,
        },
        metaFile,
    );

    return { mode, ingested: true, docCount: docs.length };
}

/**
 * Runs every mode, isolating failures: one mode throwing must not cost the others their ingest,
 * and must not abort the surrounding dataUpdater cycle.
 */
export async function runAllModes(deps: RunDeps): Promise<RunSummary> {
    const results: RunResult[] = [];
    let ok = true;

    for (const mode of MODES) {
        try {
            const res = await runMode(mode, deps);
            results.push(res);
            logger.log(`[counterIngest] ${mode}: ${res.ingested ? `ingested ${res.docCount} leader docs` : "up to date"}`);
        } catch (err) {
            ok = false;
            logger.error(`[counterIngest] ${mode} failed: ${err instanceof Error ? err.stack : String(err)}`);
        }
    }

    return { ok, results };
}
