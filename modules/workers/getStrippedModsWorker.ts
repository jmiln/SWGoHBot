import ComlinkStub from "@swgoh-utils/comlink";
import type { ComlinkPlayer } from "../../types/swapi_types.ts";
import { myTime } from "../functions.ts";

interface ModMap {
    [key: string]: {
        pips: number;
        set: string;
        slot: number;
    };
}

export default async function ({ playerId, modMap, clientStub }: { playerId: number; modMap: ModMap; clientStub: string }) {
    const comlinkStub = new ComlinkStub(clientStub);
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
            console.error(`[${myTime()}] [getStrippedModsWorker] Error: ${err}`);
        });
}
