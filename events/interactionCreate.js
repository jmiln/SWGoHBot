const { inspect } = require("node:util");
const { getGuildSettings } = require("../modules/guildConfig/settings.js");
const { getGuildAliases } = require("../modules/guildConfig/aliases.js");
const { send } = require("node:process");
const ignoreArr = [
    "DiscordAPIError: Missing Access",
    "HTTPError [AbortError]: The user aborted a request.",
    "HTTPError: Service Unavailable",
    "Internal Server Error", // Something on Discord's end
    "The user aborted a request", // Pretty sure this is also on Discord's end
    "Cannot send messages to this user", // A user probably has the bot blocked or doesn't allow DMs (No way to check for that)
    "Unknown interaction", // Not sure, but seems to happen when someone deletes an interaction that the bot is trying to reply to?
    "Unknown message", // Not sure, but seems to happen when someone deletes a message that the bot is trying to reply to?
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

    if (interaction.isChatInputCommand()) {
        // Grab the settings for this server, and if there's no guild, just give it the defaults
        // Attach the guildsettings to the interaction to make it easier to grab later
        interaction.guildSettings = await getGuildSettings({ cache: Bot.cache, guildId: interaction?.guild?.id });

        // Get the user or member's permission level from the elevation
        const level = await Bot.permLevel(interaction);

        // Make sure the user has the correct perms to run the command
        if (level < cmd.commandData.permLevel) {
            return interaction.reply({ content: "Sorry, but you don't have permission to run that command.", ephemeral: true });
        }

        // Load the language file for whatever language they have set
        const user = await Bot.userReg.getUser(interaction.user.id);
        interaction.guildSettings.selectedLanguage = user?.lang?.language || Bot.config.defaultSettings.language;
        interaction.guildSettings.swgohLanguage = user?.lang?.swgohLanguage || Bot.config.defaultSettings.swgohLanguage;

        interaction.language =
            Bot.languages[interaction.guildSettings.selectedLanguage] || Bot.languages[Bot.config.defaultSettings.language];
        interaction.swgohLanguage = interaction.guildSettings.swgohLanguage || Bot.config.defaultSettings.swgohLanguage;

        // Run the command
        try {
            await cmd.run(Bot, interaction, { level: level });
            // console.log(`[interCreate] Trying to run: ${cmd.commandData.name}\n - Options: ${inspect(interaction.options, {depth: 5})}`);
        } catch (err) {
            if (cmd.commandData.name === "test") {
                return console.log(
                    `ERROR(inter) (user: ${interaction.user.id}) I broke with ${cmd.commandData.name}: \nOptions: ${inspect(
                        interaction.options,
                        { depth: 5 },
                    )} \n${inspect(err, { depth: 5 })}`,
                    true,
                );
            }

            if (ignoreArr.some((str) => err.toString().includes(str))) {
                // Don't bother spitting out the whole mess.
                // Log which command broke, and the first line of the error
                logErr(
                    `ERROR(inter) (user: ${interaction.user.id}) I broke with ${cmd.commandData.name}: \n${err.toString().split("\n")[0]}`,
                );
            } else {
                logErr(
                    `ERROR(inter) (user: ${interaction.user.id}) I broke with ${cmd.commandData.name}: \nOptions: ${inspect(
                        interaction.options,
                        { depth: 5 },
                    )} \n${inspect(err, { depth: 5 })}`,
                    true,
                );
            }

            const replyObj = {
                content: `It looks like something broke when trying to run that command. If this error continues, please report it here: ${Bot.constants.invite}`,
                ephemeral: true,
            };
            if (interaction.replied) {
                return interaction
                    .followUp(replyObj)
                    .catch((e) => logErr(`[cmd:${cmd.commandData.name}] Error trying to send followUp error message: \n${e}`));
            }
            if (interaction.deferred) {
                return interaction
                    .editReply(replyObj)
                    .catch((e) => logErr(`[cmd:${cmd.commandData.name}] Error trying to send editReply error message: \n${e}`));
            }
            return interaction
                .reply(replyObj)
                .catch((e) => logErr(`[cmd:${cmd.commandData.name}] Error trying to send reply error message: \n${e}`));
        }
    } else if (interaction.isAutocomplete()) {
        // Process the autocomplete inputs
        const focusedOption = interaction.options.getFocused(true);
        let filtered = [];

        if (cmd?.autocomplete && typeof cmd.autocomplete === "function") {
            // As needed, process autocompletes in each file, or just passes the list of options.
            await cmd.autocomplete(Bot, interaction, focusedOption);
        } else if (!filtered?.length) {
            // Process the general ones here, or others that didn't give a proper response
            try {
                // Grab any aliases that the guild has set
                const aliases = await getGuildAliases({ cache: Bot.cache, guildId: interaction?.guild?.id });

                if (interaction.commandName === "panic") {
                    // Process the autocompletions for the /panic command
                    filtered = filterAutocomplete(Bot.journeyNames, focusedOption.value?.toLowerCase());
                    filtered = filtered.map((unit) => ({ name: unit.name, value: unit.defId }));
                } else if (focusedOption.name === "command") {
                    filtered = Bot.commandList.filter((cmdName) => cmdName.toLowerCase().startsWith(focusedOption.value?.toLowerCase()));
                } else {
                    const aliasList = aliases?.map((al) => ({ ...al, isAlias: true })) || [];

                    if (["unit", "character", "ship"].includes(focusedOption.name)) {
                        let unitList = [];
                        if (focusedOption.name === "unit") {
                            unitList = [...aliasList, ...Bot.CharacterNames, ...Bot.ShipNames];
                        } else if (focusedOption.name === "character") {
                            unitList = [
                                ...aliasList.filter((al) => Bot.CharacterNames.find((cn) => cn.defId === al.defId)),
                                ...Bot.CharacterNames,
                            ];
                        } else if (focusedOption.name === "ship") {
                            unitList = [...aliasList.filter((al) => Bot.ShipNames.find((sn) => sn.defId === al.defId)), ...Bot.ShipNames];
                        }
                        filtered = filterAutocomplete(unitList, focusedOption.value?.toLowerCase());
                        filtered = filtered
                            .sort((a, b) => (a.name.toLowerCase() > b.name.toLowerCase() ? 1 : -1))
                            .map((unit) => {
                                if (unit.isAlias) return { name: `${unit.name} (${unit.alias})`, value: unit.defId };
                                return { name: unit.name, value: unit.defId };
                            });
                    }
                }
            } catch (err) {
                logErr(`[interactionCreate, autocomplete, cmd=${interaction.commandName}] Unit name issue.`);
                console.error(interaction);
                console.error(err);
            }
            try {
                await interaction.respond(
                    filtered
                        .map((choice) => ({
                            name: choice?.name || choice,
                            value: choice?.value || choice,
                        }))
                        .slice(0, 24),
                );
            } catch (err) {
                // If it's one of the common errors, just move on, nothing that I can do about it
                const ignoreArr = ["unknown interaction", "bad gateway", "service unavailable"];
                const errStr = ignoreArr.find((elem) => err.toString().toLowerCase().includes(elem));
                if (errStr) return;

                // Otherwise, print out what I can about it
                if (typeof err !== "string") {
                    logErr(`[${Bot.myTime()}] [interactionCreate, autocomplete, cmd=${interaction.commandName}] Missing error.`);
                    console.error(interaction?.options?._hoistedOptions || interaction?.options);
                    console.error(err);
                } else {
                    logErr(err);
                }
            }
        }
    }

    function filterAutocomplete(arrIn, search) {
        const searchTerm = search?.toLowerCase() || "";
        let filtered = arrIn.filter((unit) => {
            if (unit.isAlias) return unit?.alias?.toLowerCase().startsWith(searchTerm);
            return unit?.name?.toLowerCase().startsWith(searchTerm);
        });
        if (!filtered?.length) {
            filtered = arrIn.filter((unit) => unit.name?.toLowerCase().includes(searchTerm));
        }
        if (!filtered?.length) {
            filtered = arrIn.filter((unit) => {
                return unit?.aliases?.map((u) => u.toLowerCase()).includes(searchTerm);
            });
        }

        return filtered;
    }

    function logErr(errStr, useWebhook = false) {
        if (ignoreArr.some((str) => errStr.toString().includes(str))) return;
        Bot.logger.error(errStr, useWebhook);
    }
};
