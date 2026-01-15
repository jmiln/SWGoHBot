import { Events, type Guild } from "discord.js";
import type { BotType } from "../types/types.ts";

export default {
    name: Events.GuildCreate,
    execute: (Bot: BotType, guild: Guild) => {
        // Make sure it's not a server outage that's causing it to show as leaving/ re-joining
        if (!guild.available) return;
        Bot.logger.log(`[GuildCreate] I joined ${guild.name}(${guild.id})`);
    },
};
