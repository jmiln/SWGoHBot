import config from "../../config.js";
import cache from "../cache.ts";
import logger from "../Logger.ts";
import unitChecklist from "../../data/unitChecklist.ts";
import type { GuildConfigTWList } from "../../types/guildConfig_types.ts";

const defaultTWList = {
    "Light Side": [],
    "Dark Side": [],
    "Galactic Legends": [],
    Ships: [],
    "Capital Ships": [],
    Blacklist: [], // List of units to not show in the list output (Can't have units both here and one of the others)
};

export async function getGuildTWList({ guildId }: { guildId: string }): Promise<GuildConfigTWList> {
    if (!guildId) return defaultTWList;
    const res = await cache.getOne(config.mongodb.swgohbotdb, "guildConfigs", { guildId: guildId }, { twList: 1 });
    const outObj = {};
    for (const key of Object.keys(defaultTWList)) {
        outObj[key] = res?.twList?.[key] || [];
    }
    return outObj || defaultTWList;
}

export async function getFullTWList({ guildId }: { guildId: string }) {
    if (!guildId) return unitChecklist;
    const res = await cache.getOne(config.mongodb.swgohbotdb, "guildConfigs", { guildId: guildId }, { twList: 1 });
    const twList: GuildConfigTWList = res?.twList || defaultTWList;

    const twListOut = {};
    for (const unitType of Object.keys(unitChecklist)) {
        if (!twListOut[unitType]) twListOut[unitType] = {};
        for (const defId of twList[unitType]) {
            if (twList.Blacklist.includes(defId)) continue;
            if (!twListOut[unitType][defId]) twListOut[unitType][defId] = "";
        }
        for (const [defId, shortName] of unitChecklist[unitType]) {
            if (twList.Blacklist.includes(defId)) continue;
            if (!twListOut[unitType][defId]) twListOut[unitType][defId] = shortName;
        }
    }
    return twListOut;
}

export async function setGuildTWList({ guildId, twListOut }: { guildId: string; twListOut: GuildConfigTWList }) {
    const res = await cache
        .put(config.mongodb.swgohbotdb, "guildConfigs", { guildId }, { twList: twListOut }, false)
        .then(() => {
            return { success: true, error: null };
        })
        .catch((error: Error) => {
            logger.error(`[guildConfig/twlist/setGuildTWList] Error: ${error.message}`);
            return { success: false, error: error };
        });
    return res;
}
