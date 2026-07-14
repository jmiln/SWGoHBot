import { eachLimit } from "async";
import { MongoClient } from "mongodb";
import { env } from "../config/config.ts";
import cache from "../modules/cache.ts";
import {
    type Accumulator,
    type BuildOptions,
    buildCounterDocs,
    DEFAULT_BUILD_OPTIONS,
    foldPlayer,
} from "../modules/counters/counterAggregator.ts";
import { createGahistoryClient, type GahistoryClient, type InfoDoc, type Mode } from "../modules/counters/gahistoryClient.ts";
import logger from "../modules/Logger.ts";
import type { CounterCursor } from "../schemas/counters.schema.ts";

const COLLECTION = "counterData";
const MODES: Mode[] = ["5v5", "3v3"];

function numericArg(flag: string, fallback: number): number {
    const ix = process.argv.indexOf(flag);
    if (ix === -1) return fallback;
    const parsed = Number.parseInt(process.argv[ix + 1], 10);
    return Number.isNaN(parsed) ? fallback : parsed;
}

export function shouldIngest(info: InfoDoc, cursor: CounterCursor | null): boolean {
    return !cursor || cursor.lastInstanceId !== info.instanceId;
}

export interface RunDeps {
    client: GahistoryClient;
    db: string;
    concurrency: number;
    options: BuildOptions;
    /** When true, emit per-batch fetch-progress heartbeats (off by default; too noisy otherwise). */
    debug?: boolean;
}
export interface RunResult {
    mode: Mode;
    ingested: boolean;
    docCount: number;
}

export async function runMode(mode: Mode, deps: RunDeps): Promise<RunResult> {
    const { client, db, concurrency, options, debug } = deps;
    logger.log(`[counterUpdater] ${mode}: checking for a new event...`);
    const info = await client.getInfo(mode);
    const cursor = (await cache.getOne(db, COLLECTION, { _id: `meta:${mode}` })) as CounterCursor | null;
    if (!shouldIngest(info, cursor)) {
        logger.log(`[counterUpdater] ${mode}: already at ${info.instanceId}, nothing to do`);
        return { mode, ingested: false, docCount: 0 };
    }

    const playerIds = await client.getPlayerIds(mode);
    const total = playerIds.length;
    // Heartbeat cadence: ~20 progress lines at most, but no sparser than every 500 players.
    const logEvery = Math.max(500, Math.ceil(total / 20));
    logger.log(`[counterUpdater] ${mode}: new event ${info.instanceId}, fetching ${total} players...`);

    const acc: Accumulator = new Map();
    let processed = 0;
    let failed = 0;
    await eachLimit(playerIds, concurrency, async (playerId: string) => {
        try {
            const doc = await client.getPlayer(mode, playerId);
            if (doc) foldPlayer(acc, doc);
        } catch (err) {
            failed++;
            logger.error(`[counterUpdater] ${mode} player ${playerId} failed: ${err instanceof Error ? err.message : String(err)}`);
        } finally {
            processed++;
            if (debug && processed % logEvery === 0) logger.log(`[counterUpdater] ${mode}: ${processed}/${total} players fetched`);
        }
    });
    logger.log(`[counterUpdater] ${mode}: fetch complete (${failed} failed), building counter docs...`);

    const docs = buildCounterDocs(acc, { mode, instanceId: info.instanceId, season: info.season }, options);
    if (!playerIds.length || !docs.length) {
        // The upstream may publish info.json before the player data is fully posted. If we got no
        // players or no qualifying docs, treat the event as not-yet-ready: leave the existing docs
        // and cursor untouched so the next tick retries, rather than pruning good data for weeks.
        logger.warn(
            `[counterUpdater] ${mode}: no data yet (players=${playerIds.length}, docs=${docs.length}); leaving cursor + existing docs intact`,
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
    // Prune counter docs from older events for this mode (never the meta cursor docs).
    await cache.delete(db, COLLECTION, { mode, leader: { $exists: true }, instanceId: { $ne: info.instanceId } });
    // Advance the cursor LAST so a mid-run crash simply re-runs next tick.
    await cache.put(
        db,
        COLLECTION,
        { _id: `meta:${mode}` },
        { _id: `meta:${mode}`, lastInstanceId: info.instanceId, season: info.season, status: "ok" },
    );

    return { mode, ingested: true, docCount: docs.length };
}

async function main(): Promise<void> {
    // The cache singleton has no connection until we give it one (see dataUpdater.init).
    const mongoClient = await MongoClient.connect(env.MONGODB_URL);
    cache.init(mongoClient);
    try {
        const deps = {
            // 800/10s = 80 req/s, well under the source's 2000/10s/IP cap.
            client: createGahistoryClient({ maxPer10s: numericArg("--max-per-10s", 800) }),
            db: env.MONGODB_SWAPI_DB,
            // Sized to keep the 80 req/s limiter saturated (~80 x avg-latency in flight); the limiter,
            // not this number, is the hard cap, so a generous default is safe.
            concurrency: numericArg("--concurrency", 50),
            options: {
                ...DEFAULT_BUILD_OPTIONS,
                minBattles: numericArg("--min-battles", DEFAULT_BUILD_OPTIONS.minBattles),
            },
            debug: process.argv.includes("--debug"),
        };
        for (const mode of MODES) {
            const res = await runMode(mode, deps);
            logger.log(`[counterUpdater] ${mode}: ${res.ingested ? `ingested ${res.docCount} leader docs` : "up to date"}`);
        }
    } finally {
        await mongoClient.close();
    }
}

// Run when executed directly (not when imported by tests).
if (!process.env.TESTING_ENV) {
    main()
        .then(() => process.exit(0))
        .catch((err) => {
            logger.error(`[counterUpdater] fatal: ${err instanceof Error ? err.stack : String(err)}`);
            process.exit(1);
        });
}

export default { shouldIngest, runMode };
