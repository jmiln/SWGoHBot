import { env } from "../../config/config.ts";
import type { GuildConfigShardTimes } from "../../types/guildConfig_types.ts";
import cache from "../cache.ts";

export async function getGuildShardTimes({ guildId }: { guildId: string }): Promise<GuildConfigShardTimes[]> {
    const res = await cache.getOne(env.MONGODB_SWGOHBOT_DB, "guildConfigs", { guildId: guildId }, { shardtimes: 1 });
    return (res?.shardtimes || []) as GuildConfigShardTimes[];
}

export async function setGuildShardTimes({ guildId, stOut }: { guildId: string; stOut: GuildConfigShardTimes[] }) {
    if (!Array.isArray(stOut)) throw new Error("[guildConfig/shardTimes/setGuildShardTimes] Somehow have a non-array stOut");
    return await cache.put(env.MONGODB_SWGOHBOT_DB, "guildConfigs", { guildId: guildId }, { shardtimes: stOut }, false);
}
