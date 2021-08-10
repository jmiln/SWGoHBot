const {inspect} = require("util");
module.exports = async (Bot, client, interaction) => {
    // If it's not a command, don't bother trying to do anything
    if (!interaction.isCommand()) return;

    // If it's a bot trying to use it, don't bother
    if (interaction.user.bot) return;

    // Grab the command data from the client.slashcmds Collection
    const cmd = client.slashcmds.get(interaction.commandName);

    // If that command doesn't exist, silently exit and do nothing
    if (!cmd) return;

    // Grab the settings for this server
    // If there is no guild, get default conf (DMs)
    let guildSettings;
    if (!interaction.guild) {
        guildSettings = Bot.config.defaultSettings;
    } else {
        guildSettings = await Bot.getGuildConf(interaction.guild.id);
    }

    // Attach the guildsettings to the interaction to make it easier to grab later
    interaction.guildSettings = guildSettings;

    // Get the user or member's permission level from the elevation
    const level = Bot.permlevel(interaction);

    // // Load the language file for whatever language they have set
    const user = await Bot.userReg.getUser(interaction.user.id);
    if (user && user.lang) {
        if (user.lang.language) {
            interaction.guildSettings.language = user.lang.language || Bot.config.defaultSettings.language;
        }
        if (user.lang.swgohLanguage) {
            interaction.guildSettings.swgohLanguage = user.lang.swgohLanguage || Bot.config.defaultSettings.swgohLanguage;
        }
    }
    interaction.language = Bot.languages[interaction.guildSettings.language] || Bot.languages[Bot.config.defaultSettings.language];
    interaction.swgohLanguage = interaction.guildSettings.swgohLanguage || Bot.config.defaultSettings.swgohLanguage;

    // Run the command
    if (cmd && level >= cmd.commandData.permLevel) {
        try {
            await cmd.run(Bot, interaction, { level: level });
        } catch (err) {
            if (cmd.commandData.name === "test") {
                console.log(`ERROR(inter) I broke with ${cmd.commandData.name}: \nContent: ${interaction.content} \n${inspect(err)}`, true);
            } else {
                Bot.logger.error(`ERROR(inter) I broke with ${cmd.commandData.name}: \nContent: ${interaction.content} \n${inspect(err)}`, true);
            }

        }
    } else {
        return interaction.reply("Sorry, but you don't have permission to run that command.");
    }
};
