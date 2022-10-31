const {inspect} = require("util");
const ignoreArr = [
    "DiscordAPIError: Missing Access",
    "DiscordAPIError: Unknown interaction",
    "DiscordAPIError: Unknown Message",
    "HTTPError [AbortError]: The user aborted a request.",
    "Internal Server Error",                // Something on Discord's end
    "The user aborted a request",           // Pretty sure this is also on Discord's end
    "Cannot send messages to this user",    // A user probably has the bot blocked or doesn't allow DMs (No way to check for that)
    "Unknown interaction"                   // Not sure, but seems to happen when someone deletes a message that the bot is trying to reply to?
];

module.exports = async (Bot, client, interaction) => {
    // If it's not a command, don't bother trying to do anything
    if (!interaction?.isChatInputCommand() && !interaction.isAutocomplete()) return;

    // If it's a bot trying to use it, don't bother
    if (interaction.user.bot) return;

    // Grab the command data from the client.slashcmds Collection
    const cmd = client.slashcmds.get(interaction.commandName);

    // If that command doesn't exist, silently exit and do nothing
    if (!cmd) return;

    // Grab the settings for this server, and if there's no guild, just give it the defaults
    // Attach the guildsettings to the interaction to make it easier to grab later
    interaction.guildSettings = await Bot.getGuildSettings(interaction?.guild?.id);

    // Get the user or member's permission level from the elevation
    const level = await Bot.permLevel(interaction);

    // Make sure the user has the correct perms to run the command
    if (level < cmd.commandData.permLevel) {
        return interaction.reply({content: "Sorry, but you don't have permission to run that command.", ephemeral: true});
    }

    // Load the language file for whatever language they have set
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

    if (interaction.isChatInputCommand()) {
        // Run the command
        try {
            await cmd.run(Bot, interaction, { level: level });
            // console.log(`[interCreate] Trying to run: ${cmd.commandData.name}\n - Options: ${inspect(interaction.options, {depth: 5})}`);
        } catch (err) {
            if (cmd.commandData.name === "test") {
                return console.log(`ERROR(inter) I broke with ${cmd.commandData.name}: \nOptions: ${inspect(interaction.options, {depth: 5})} \n${inspect(err, {depth: 5})}`, true);
            }

            if (ignoreArr.some(str => err.toString().includes(str))) {
                // Don't bother spitting out the whole mess.
                // Log which command broke, and the first line of the error
                logErr(Bot, `ERROR(inter) I broke with ${cmd.commandData.name}: \n${err.toString().split("\n")[0]}`);
            } else {
                logErr(Bot, `ERROR(inter) I broke with ${cmd.commandData.name}: \nOptions: ${inspect(interaction.options, {depth: 5})} \n${inspect(err, {depth: 5})}`, true);
            }

            const replyObj = {content: `It looks like something broke when trying to run that command. If this error continues, please report it here: ${Bot.constants.invite}`, ephemeral: true};
            if (interaction.replied) {
                return interaction.followUp(replyObj)
                    .catch(e => logErr(Bot, `[cmd:${cmd.commandData.name}] Error trying to send followUp error message: \n${e}`));
            } else if (interaction.deferred) {
                return interaction.editReply(replyObj)
                    .catch(e => logErr(Bot, `[cmd:${cmd.commandData.name}] Error trying to send editReply error message: \n${e}`));
            } else {
                return interaction.reply(replyObj)
                    .catch(e => logErr(Bot, `[cmd:${cmd.commandData.name}] Error trying to send reply error message: \n${e}`));
            }
        }
    } else if (interaction.isAutocomplete()) {
        // Process the autocomplete inputs
        const focusedOption = interaction.options.getFocused(true);

        let filtered = [];
        if (focusedOption.name === "character") {
            filtered = Bot.CharacterNames.filter(name => name.toLowerCase().startsWith(focusedOption.value?.toLowerCase()));
            if (!filtered?.length) {
                filtered = Bot.CharacterNames.filter(name => name.toLowerCase().includes(focusedOption.value?.toLowerCase()));
            }
        } else if (focusedOption.name === "ship") {
            filtered = Bot.ShipNames.filter(name => name.toLowerCase().startsWith(focusedOption.value?.toLowerCase()));
            if (!filtered?.length) {
                filtered = Bot.ShipNames.filter(name => name.toLowerCase().includes(focusedOption.value?.toLowerCase()));
            }
        }
        try {
            await interaction.respond(
                filtered.map(choice => ({ name: choice, value: choice })).slice(0, 24)
            );
        } catch (err) {
            console.error(err);
        }
    }
};

function logErr(Bot, errStr, useWebhook=false) {
    if (ignoreArr.some(str => errStr.toString().includes(str))) return;
    Bot.logger.error(errStr, useWebhook);
}




