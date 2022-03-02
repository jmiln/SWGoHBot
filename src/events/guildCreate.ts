import { Guild } from "discord.js";

module.exports = async (Bot: {}, guild: Guild) => {
    // Get the default config settings
    const defSet = Bot.config.defaultSettings;

    // Make sure it's not a server outage that's causing it to show as leaving/ re-joining
    if (!guild.available) return;

    const exists = await Bot.hasGuildConf(guild.id);

    if (!exists) {
        // Adding a new row to the DB
        Bot.database.models.settings.create({
            guildID: guild.id,
            adminRole: defSet.adminRole,
            enableWelcome: defSet.enableWelcome,
            welcomeMessage: defSet.welcomeMessage,
            useEmbeds: defSet.useEmbeds,
            timezone: defSet.timezone,
            announceChan: defSet.announceChan,
            useEventPages: defSet.useEventPages,
            language: defSet.language
        })
            .then(() => {
                // Log that it joined another guild
                Bot.logger.log(`[GuildCreate] I joined ${guild.name}(${guild.id})`);
            })
            .catch((error: Error) => { Bot.logger.error(error, guild.id); });
    } else {
        // Log that it joined another guild (Again)
        // Bot.log("GuildCreate", `I re-joined ${guild.name}(${guild.id})`, {color: Bot.constants.colors.green});
    }
};
