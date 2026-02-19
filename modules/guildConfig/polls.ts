import type { GuildConfigPoll } from "../../types/guildConfig_types.ts";
import { guildConfigDB } from "./db.ts";

export async function getGuildPolls({ guildId }: { guildId: string }): Promise<GuildConfigPoll[]> {
    if (!guildId) return [];
    const res = await guildConfigDB.getOne({ guildId: guildId }, { polls: 1 });
    return (res?.polls || []) as GuildConfigPoll[];
}

export async function setGuildPolls({ guildId, pollsOut }: { guildId: string; pollsOut: GuildConfigPoll[] }) {
    // Filter out any settings that are the same as the defaults
    if (!Array.isArray(pollsOut)) throw new Error("[guildConfig/polls/setGuildPolls] Somehow have a non-array pollsOut");
    return await guildConfigDB.put({ guildId: guildId }, { polls: pollsOut }, false);
}
