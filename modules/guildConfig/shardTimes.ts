import config from "../../config.js";
import type { BotCache } from "../../types/cache_types.ts";
import type { GuildConfigShardTimes } from "../../types/guildConfig_types.ts";

export async function getGuildShardTimes({ cache, guildId }: { cache: BotCache; guildId: string }): Promise<GuildConfigShardTimes[]> {
    const res = await cache.getOne(config.mongodb.swgohbotdb, "guildConfigs", { guildId: guildId }, { shardtimes: 1 });
    return (res?.shardtimes || []) as GuildConfigShardTimes[];
}

export async function setGuildShardTimes({ cache, guildId, stOut }: { cache: BotCache; guildId: string; stOut: GuildConfigShardTimes[] }) {
    if (!Array.isArray(stOut)) throw new Error("[guildConfig/shardTimes/setGuildShardTimes] Somehow have a non-array stOut");
    return await cache.put(config.mongodb.swgohbotdb, "guildConfigs", { guildId: guildId }, { shardtimes: stOut }, false);
}
