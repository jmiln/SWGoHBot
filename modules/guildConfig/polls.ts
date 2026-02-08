import config from "../../config.js";
import type { GuildConfigPoll } from "../../types/guildConfig_types.ts";
import cache from "../cache.ts";

export async function getGuildPolls({ guildId }: { guildId: string }): Promise<GuildConfigPoll[]> {
    if (!guildId) return [];
    const res = await cache.getOne(config.mongodb.swgohbotdb, "guildConfigs", { guildId: guildId }, { polls: 1 });
    return (res?.polls || []) as GuildConfigPoll[];
}

export async function setGuildPolls({ guildId, pollsOut }: { guildId: string; pollsOut: GuildConfigPoll[] }) {
    // Filter out any settings that are the same as the defaults
    if (!Array.isArray(pollsOut)) throw new Error("[guildConfig/polls/setGuildPolls] Somehow have a non-array pollsOut");
    return await cache.put(config.mongodb.swgohbotdb, "guildConfigs", { guildId: guildId }, { polls: pollsOut }, false);
}
