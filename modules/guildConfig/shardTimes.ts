import type { GuildConfigShardTimes } from "../../types/guildConfig_types.ts";
import { guildConfigDB } from "./db.ts";

export async function getGuildShardTimes({ guildId }: { guildId: string }): Promise<GuildConfigShardTimes[]> {
    const res = await guildConfigDB.getOne({ guildId: guildId }, { shardtimes: 1 });
    return (res?.shardtimes || []) as GuildConfigShardTimes[];
}

export async function setGuildShardTimes({ guildId, stOut }: { guildId: string; stOut: GuildConfigShardTimes[] }) {
    if (!Array.isArray(stOut)) throw new Error("[guildConfig/shardTimes/setGuildShardTimes] Somehow have a non-array stOut");
    return await guildConfigDB.put({ guildId: guildId }, { shardtimes: stOut }, false);
}
