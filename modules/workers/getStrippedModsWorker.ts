import { workerData } from "node:worker_threads";
import ComlinkStub from "@swgoh-utils/comlink";
import { env } from "../../config/config.ts";
import type { ComlinkPlayer } from "../../types/swapi_types.ts";
import logger from "../Logger.ts";

interface ModMap {
    [key: string]: {
        pips: number;
        set: string;
        slot: number;
    };
}

type ComlinkError = Error & { status?: number; statusCode?: number; response?: { statusCode?: number } };

const PLAYER_FETCH_TIMEOUT_MS = 30_000;

// Cache stub instance per worker thread to avoid recreating for each player
let cachedStub: ComlinkStub | null = null;

function getComlinkStub(): ComlinkStub {
    if (!cachedStub) {
        // dataUpdater resolves once whether swapiServe is reachable and passes the base URL it
        // settled on through workerData, so every thread inherits that one decision instead of
        // each probing the service separately. The fallback to the direct URL only matters if
        // this worker is ever run outside that pool.
        const { comlinkUrl } = (workerData ?? {}) as { comlinkUrl?: string };
        cachedStub = new ComlinkStub({
            url: comlinkUrl ?? env.SWAPI_CLIENT_URL,
            accessKey: env.SWAPI_ACCESS_KEY,
            secretKey: env.SWAPI_SECRET_KEY,
        });
    }
    return cachedStub;
}

function getStatusCode(err: unknown): number | undefined {
    if (!(err instanceof Error)) return undefined;
    const e = err as ComlinkError;
    return e.response?.statusCode ?? e.status ?? e.statusCode;
}

/**
 * Fetches one player's roster and strips it down to the mod info the aggregation needs.
 *
 * Retry deliberately lives in swapiServe now, not here. This worker used to retry 502/503 twice
 * itself, which stacked multiplicatively once its calls started going through the queue: three
 * worker attempts times three service attempts is up to nine upstream calls for a single player,
 * amplifying load at exactly the moment the backend is already struggling. The service retries
 * with a shared budget and paces those retries against live traffic, which this thread cannot see.
 *
 * The timeout stays, because it bounds how long a worker thread is held by one wedged request.
 */
export async function fetchPlayerData(stub: ComlinkStub, playerId: number, modMap: ModMap, timeoutMs = PLAYER_FETCH_TIMEOUT_MS) {
    let timeoutTimer: NodeJS.Timeout | undefined;
    const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutTimer = setTimeout(() => reject(new Error(`getPlayer(${playerId}) timed out after ${timeoutMs}ms`)), timeoutMs);
    });

    try {
        const res = await Promise.race([stub.getPlayer(null, playerId.toString()) as Promise<ComlinkPlayer>, timeoutPromise]);
        return res?.rosterUnit
            .filter((unit) => unit?.equippedStatMod?.length)
            .map((unit) => ({
                defId: unit.definitionId.split(":")[0],
                mods: unit.equippedStatMod
                    .map(({ definitionId, primaryStat }) => {
                        const modSchema = modMap[definitionId];
                        if (!modSchema) return null;
                        return {
                            slot: modSchema.slot - 1, // mod slots are numbered 2-7
                            set: Number(modSchema.set),
                            primaryStat: primaryStat?.stat.unitStatId,
                        };
                    })
                    .filter((mod) => mod !== null),
            }));
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        const code = getStatusCode(err);
        const statusStr = code != null ? ` [status ${code}]` : "";
        logger.error(`[getStrippedModsWorker] Error fetching player ${playerId}:${statusStr} ${message}`);
        return undefined;
    } finally {
        // Clear the racing timer so it doesn't keep the event loop (or worker) alive for the full timeout
        clearTimeout(timeoutTimer);
    }
}

export default async function ({ playerId, modMap }: { playerId: number; modMap: ModMap }) {
    return fetchPlayerData(getComlinkStub(), playerId, modMap);
}
