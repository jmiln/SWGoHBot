import config from "../../config.ts";
import type { GuildAlias } from "../../types/types.ts";
import cache from "../cache.ts";
import logger from "../Logger.ts";

export async function getGuildAliases({ guildId }: { guildId: string }): Promise<GuildAlias[]> {
    if (!guildId) return [];
    const res = await cache.getOne(config.mongodb.swgohbotdb, "guildConfigs", { guildId: guildId }, { aliases: 1 });
    return (res?.aliases || []) as GuildAlias[];
}

export async function setGuildAliases({
    guildId,
    aliasesOut,
}: {
    guildId: string;
    aliasesOut: GuildAlias[];
}): Promise<{ success: boolean; error: string | null }> {
    // Filter out any settings that are the same as the defaults
    if (!Array.isArray(aliasesOut)) throw new Error("[guildConfigs/aliases] Somehow have a non-array aliasesOut");
    aliasesOut = aliasesOut.sort((a, b) => (a.alias > b.alias ? 1 : -1));
    const res = await cache
        .put(config.mongodb.swgohbotdb, "guildConfigs", { guildId }, { aliases: aliasesOut }, false)
        .then(() => {
            return { success: true, error: null };
        })
        .catch((error: Error) => {
            logger.error(`[guildConfig/aliases/setGuildAliases] Error: ${error.message}`);
            return { success: false, error: error.toString() };
        });
    return res;
}
