const {inspect} = require("util");
const ignoreArr = [
    "DiscordAPIError: Missing Access",
    "HTTPError [AbortError]: The user aborted a request.",
    "Internal Server Error",                // Something on Discord's end
    "The user aborted a request",           // Pretty sure this is also on Discord's end
    "Cannot send messages to this user",    // A user probably has the bot blocked or doesn't allow DMs (No way to check for that)
    "Unknown interaction",                  // Not sure, but seems to happen when someone deletes an interaction that the bot is trying to reply to?
    "Unknown message"                       // Not sure, but seems to happen when someone deletes a message that the bot is trying to reply to?
];

module.exports = async (Bot, client, interaction) => {
    // If it's not a command, don't bother trying to do anything
    if (
        !interaction?.isChatInputCommand() &&
        !interaction.isAutocomplete()
    ) return;

    // If it's a bot trying to use it, don't bother
    if (interaction.user.bot) return;

    if (interaction.isChatInputCommand()) {
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

        // Run the command
        try {
            await cmd.run(Bot, interaction, { level: level });
            // console.log(`[interCreate] Trying to run: ${cmd.commandData.name}\n - Options: ${inspect(interaction.options, {depth: 5})}`);
        } catch (err) {
            if (cmd.commandData.name === "test") {
                return console.log(`ERROR(inter) (user: ${interaction.user.id}) I broke with ${cmd.commandData.name}: \nOptions: ${inspect(interaction.options, {depth: 5})} \n${inspect(err, {depth: 5})}`, true);
            }

            if (ignoreArr.some(str => err.toString().includes(str))) {
                // Don't bother spitting out the whole mess.
                // Log which command broke, and the first line of the error
                logErr(`ERROR(inter) (user: ${interaction.user.id}) I broke with ${cmd.commandData.name}: \n${err.toString().split("\n")[0]}`);
            } else {
                logErr(`ERROR(inter) (user: ${interaction.user.id}) I broke with ${cmd.commandData.name}: \nOptions: ${inspect(interaction.options, {depth: 5})} \n${inspect(err, {depth: 5})}`, true);
            }

            const replyObj = {content: `It looks like something broke when trying to run that command. If this error continues, please report it here: ${Bot.constants.invite}`, ephemeral: true};
            if (interaction.replied) {
                return interaction.followUp(replyObj)
                    .catch(e => logErr(`[cmd:${cmd.commandData.name}] Error trying to send followUp error message: \n${e}`));
            } else if (interaction.deferred) {
                return interaction.editReply(replyObj)
                    .catch(e => logErr(`[cmd:${cmd.commandData.name}] Error trying to send editReply error message: \n${e}`));
            } else {
                return interaction.reply(replyObj)
                    .catch(e => logErr(`[cmd:${cmd.commandData.name}] Error trying to send reply error message: \n${e}`));
            }
        }
    } else if (interaction.isAutocomplete()) {
        // Process the autocomplete inputs
        const focusedOption = interaction.options.getFocused(true);
        let filtered = [];

        if (interaction.commandName === "panic") {
            // Process the autocompletions for the /panic command
            filtered = Bot.journeyNames
                .filter(unit => unit?.name.toLowerCase().startsWith(focusedOption.value?.toLowerCase()))
                .map(unit => {
                    return {
                        name: unit.name,
                        value: unit.defId
                    };
                });
        } else {
            if (focusedOption.name === "character") {
                filtered = Bot.CharacterNames.filter(char => char.name.toLowerCase().startsWith(focusedOption.value?.toLowerCase())).map(char => char.name);
                if (!filtered?.length) {
                    filtered = Bot.CharacterNames.filter(char => char.name.toLowerCase().includes(focusedOption.value?.toLowerCase())).map(char => char.name);
                }
            } else if (focusedOption.name === "ship") {
                filtered = Bot.ShipNames.filter(ship => ship.name.toLowerCase().startsWith(focusedOption.value?.toLowerCase())).map(ship => ship.name);
                if (!filtered?.length) {
                    filtered = Bot.ShipNames.filter(ship => ship.name.toLowerCase().includes(focusedOption.value?.toLowerCase())).map(ship => ship.name);
                }
            } else if (focusedOption.name === "command") {
                filtered = Bot.commandList.filter(cmdName => cmdName.toLowerCase().startsWith(focusedOption.value?.toLowerCase()));
            }
        }
        try {
            await interaction.respond(
                filtered.map(choice => ({
                    name: choice?.name || choice,
                    value: choice?.value || choice
                })).slice(0, 24)
            );
        } catch (err) {
            // If it's an unknown interaction error, just move on, nothing that I can do about it
            if (err.toString().toLowerCase().includes("unknown interaction")) return;

            // Otherwise, print out what I can about it
            if (typeof err !== "string") {
                logErr(`[interactionCreate, autocomplete, cmd=${interaction.commandName}] Missing error.`);
                console.error(interaction);
                console.error(err);
            } else {
                logErr(err);
            }
        }
    }

    function logErr(errStr, useWebhook=false) {
        if (ignoreArr.some(str => errStr.toString().includes(str))) return;
        Bot.logger.error(errStr, useWebhook);
    }
};




