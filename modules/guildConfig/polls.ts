import config from "../../config.js";
import type { GuildConfigPoll } from "../../types/guildConfig_types.ts";

export async function getGuildPolls({ cache, guildId }): Promise<GuildConfigPoll[]> {
    if (!guildId) return [];
    const resArr = await cache.get(config.mongodb.swgohbotdb, "guildConfigs", { guildId: guildId }, { polls: 1 });
    return resArr[0]?.polls || [];
}

export async function setGuildPolls({ cache, guildId, pollsOut }): Promise<GuildConfigPoll[]> {
    // Filter out any settings that are the same as the defaults
    if (!Array.isArray(pollsOut)) throw new Error("[/poll setPolls] Somehow have a non-array pollsOut");
    return await cache.put(config.mongodb.swgohbotdb, "guildConfigs", { guildId: guildId }, { polls: pollsOut }, false);
}
