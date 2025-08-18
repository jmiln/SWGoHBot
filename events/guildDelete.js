import { deleteGuildConfig } from "../modules/guildConfig/settings.js";

export default {
    name: "guildDelete",
    execute: async (Bot, guild) => {
        // Make sure it's not a server outage that's causing it to show as leaving/ re-joining
        if (!guild.available) return;

        // The bot isn't in the server anymore, so get rid of the config
        await deleteGuildConfig({ cache: Bot.cache, guildId: guild.id });

        // Log that the bot left
        Bot.logger.log(`[GuildDelete] I left ${guild.name}(${guild.id})`);
    }
};
