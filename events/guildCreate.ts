import { Events, type Guild } from "discord.js";
import logger from "../modules/Logger.ts";

export default {
    name: Events.GuildCreate,
    execute: (guild: Guild) => {
        // Make sure it's not a server outage that's causing it to show as leaving/ re-joining
        if (!guild.available) return;
        logger.log(`[GuildCreate] I joined ${guild.name}(${guild.id})`);
    },
};
