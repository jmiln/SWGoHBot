import ComlinkStub from "@swgoh-utils/comlink";
import { env } from "../../config/config.ts";
import type { ComlinkPlayer } from "../../types/swapi_types.ts";
import { myTime } from "../functions.ts";
import logger from "../Logger.ts";

interface ModMap {
    [key: string]: {
        pips: number;
        set: string;
        slot: number;
    };
}

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

export default async function ({ playerId, modMap }: { playerId: number; modMap: ModMap }) {
    const comlinkStub = getComlinkStub();
    return await comlinkStub
        .getPlayer(null, playerId.toString())
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
        .catch((err: Error) => {
            logger.error(`[${myTime()}] [getStrippedModsWorker] Error: ${err instanceof Error ? err.message : String(err)}`);
        });
}
