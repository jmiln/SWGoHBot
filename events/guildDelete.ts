import { Events, type Guild } from "discord.js";
import { deleteGuildConfig } from "../modules/guildConfig/settings.ts";
import logger from "../modules/Logger.ts";

export default {
    name: Events.GuildDelete,
    execute: async (guild: Guild) => {
        // Make sure it's not a server outage that's causing it to show as leaving/ re-joining
        if (!guild.available) return;

        // The bot isn't in the server anymore, so get rid of the config
        await deleteGuildConfig({ guildId: guild.id });

        // Log that the bot left
        logger.log(`[GuildDelete] I left ${guild.name}(${guild.id})`);
    },
};
