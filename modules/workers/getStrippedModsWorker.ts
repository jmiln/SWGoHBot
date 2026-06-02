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

const PLAYER_FETCH_TIMEOUT_MS = 30_000;

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

export async function fetchPlayerData(stub: ComlinkStub, playerId: number, modMap: ModMap, timeoutMs = PLAYER_FETCH_TIMEOUT_MS) {
    const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`getPlayer(${playerId}) timed out after ${timeoutMs}ms`)), timeoutMs),
    );

    return Promise.race([stub.getPlayer(null, playerId.toString()) as Promise<ComlinkPlayer>, timeoutPromise])
        .then((res: ComlinkPlayer) => {
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
        })
        .catch((err: unknown) => {
            const message = err instanceof Error ? err.message : String(err);
            const status =
                err instanceof Error
                    ? ((err as { status?: number; statusCode?: number }).status ??
                      (err as { status?: number; statusCode?: number }).statusCode)
                    : undefined;
            const statusStr = status != null ? ` [status ${status}]` : "";
            logger.error(`[getStrippedModsWorker] Error fetching player ${playerId}:${statusStr} ${message}`);
        });
}

export default async function ({ playerId, modMap }: { playerId: number; modMap: ModMap }) {
    return fetchPlayerData(getComlinkStub(), playerId, modMap);
}
