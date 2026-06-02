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
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 3_000;

// Cache stub instance per worker thread to avoid recreating for each player
let cachedStub: ComlinkStub | null = null;

function getComlinkStub(): ComlinkStub {
    if (!cachedStub) {
        cachedStub = new ComlinkStub({
            url: env.SWAPI_CLIENT_URL,
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

function isRetryable(err: unknown): boolean {
    const code = getStatusCode(err);
    return code === 502 || code === 503;
}

export async function fetchPlayerData(
    stub: ComlinkStub,
    playerId: number,
    modMap: ModMap,
    timeoutMs = PLAYER_FETCH_TIMEOUT_MS,
    retryDelayMs = RETRY_DELAY_MS,
) {
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        const timeoutPromise = new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error(`getPlayer(${playerId}) timed out after ${timeoutMs}ms`)), timeoutMs),
        );

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
            if (attempt < MAX_RETRIES && isRetryable(err)) {
                logger.warn(`[getStrippedModsWorker] 502 for player ${playerId}, retrying (${attempt + 1}/${MAX_RETRIES})...`);
                await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
                continue;
            }
            const message = err instanceof Error ? err.message : String(err);
            const code = getStatusCode(err);
            const statusStr = code != null ? ` [status ${code}]` : "";
            logger.error(`[getStrippedModsWorker] Error fetching player ${playerId}:${statusStr} ${message}`);
            return undefined;
        }
    }
}

export default async function ({ playerId, modMap }: { playerId: number; modMap: ModMap }) {
    return fetchPlayerData(getComlinkStub(), playerId, modMap);
}
