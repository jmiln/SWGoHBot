const Command = require("../base/slashCommand");
const { ApplicationCommandOptionType, codeBlock } = require("discord.js");
const patreonInfo = require("../data/patreon.js");

class UserConf extends Command {
    constructor(Bot) {
        super(Bot, {
            name: "userconf",
            guildOnly: false,
            options: [
                {
                    name: "allycodes",
                    description: "The ally code of the user you want to see",
                    type: ApplicationCommandOptionType.SubcommandGroup,
                    // Need add, remove, makeprimary
                    options: [
                        {
                            name: "add",
                            type: ApplicationCommandOptionType.Subcommand,
                            description: "Add an allycode",
                            options: [
                                {
                                    name: "allycode",
                                    description: "The ally code of the user you want to see",
                                    type: ApplicationCommandOptionType.String,
                                    required: true,
                                },
                            ],
                        },
                        {
                            name: "remove",
                            type: ApplicationCommandOptionType.Subcommand,
                            description: "Remove an allycode",
                            options: [
                                {
                                    name: "allycode",
                                    description: "The ally code of the user you want to see",
                                    type: ApplicationCommandOptionType.String,
                                    required: true,
                                },
                            ],
                        },
                        {
                            name: "make_primary",
                            type: ApplicationCommandOptionType.Subcommand,
                            description: "Set this ally code as the primary one",
                            options: [
                                {
                                    name: "allycode",
                                    description: "The ally code of the user you want to see",
                                    type: ApplicationCommandOptionType.String,
                                    required: true,
                                },
                            ],
                        },
                    ],
                },
                {
                    name: "arenaalert",
                    type: ApplicationCommandOptionType.Subcommand,
                    description: "Set up your arena alerts",
                    options: [
                        // Need enabledms, arena, payoutresult, payoutwarning
                        {
                            name: "enable_dms",
                            description: "Set it to send DMs for various alerts",
                            type: ApplicationCommandOptionType.String,
                            choices: [
                                { name: "all", value: "all" },
                                { name: "primary", value: "primary" },
                                { name: "off", value: "off" },
                            ],
                        },
                        {
                            name: "arena",
                            description: "Choose which arena to watch",
                            type: ApplicationCommandOptionType.String,
                            choices: [
                                { name: "char", value: "char" },
                                { name: "fleet", value: "fleet" },
                                { name: "both", value: "both" },
                                { name: "none", value: "none" },
                            ],
                        },
                        {
                            name: "payout_result",
                            description: "Set it to send you the final rank at your payout",
                            type: ApplicationCommandOptionType.Boolean,
                        },
                        {
                            name: "payout_warning",
                            description: "Set it to warn you before your payout, 1-1440min, 0 to disable",
                            type: ApplicationCommandOptionType.Integer,
                            minValue: 0,
                            maxValue: 1440,
                        },
                    ],
                },
                {
                    name: "lang",
                    type: ApplicationCommandOptionType.Subcommand,
                    description: "Change your language settings",
                    // Need language & swgohlanguage, with the appropriate choices for each
                    options: [
                        {
                            name: "bot_language",
                            description: "Set the language for the bot's text",
                            type: ApplicationCommandOptionType.String,
                            choices: Object.keys(Bot.languages).map((lang) => {
                                return {
                                    name: lang,
                                    value: lang,
                                };
                            }),
                        },
                        {
                            name: "swgoh_language",
                            description: "Set the language for the game's text",
                            type: ApplicationCommandOptionType.String,
                            choices: Bot.swgohLangList.map((lang) => {
                                return {
                                    name: lang,
                                    value: lang,
                                };
                            }),
                        },
                    ],
                },
                {
                    name: "view",
                    type: ApplicationCommandOptionType.Subcommand,
                    description: "View your current settings",
                },
            ],
        });
    }

    async run(Bot, interaction) {
        const subCommandGroup = interaction.options.getSubcommandGroup(false);
        const subCommand = interaction.options.getSubcommand();

        const userID = interaction.user.id;
        const cooldown = await Bot.getPlayerCooldown(userID, interaction?.guild?.id);

        let user = await Bot.userReg.getUser(userID);
        if (!user) {
            // If the user doesn't have a config available, set the default one for embeds
            // This has id, accounts, arenaAlert, and lang
            user = JSON.parse(JSON.stringify(Bot.config.defaultUserConf));
            user.id = userID;
        }

        if (subCommandGroup) {
            // This means the user is working with the allycode, so go from there

            let allycode = interaction.options.getString("allycode");
            if (!Bot.isAllyCode(allycode)) {
                return super.error(interaction, `${allycode} is not a valid ally code, please double check your digits.`);
            }
            allycode = allycode.replace(/[^\d]*/g, "");

            switch (subCommand) {
                case "add": {
                    // Add an ally code to the user's list
                    // Make sure it's not in there already, then stick it in.
                    if (user.accounts.includes(allycode)) {
                        // Make sure the specified code is not already registered
                        return super.error(interaction, interaction.language.get("COMMAND_USERCONF_ALLYCODE_ALREADY_REGISTERED"));
                    }
                    if (user.accounts.length >= 10) {
                        // Cap the personal codes to 10
                        return super.error(interaction, interaction.language.get("COMMAND_USERCONF_ALLYCODE_TOO_MANY"));
                    }
                    try {
                        let player = await Bot.swgohAPI.unitStats(allycode, cooldown);
                        if (Array.isArray(player)) player = player[0];
                        if (!player) {
                            super.error(interaction, interaction.language.get("COMMAND_REGISTER_FAILURE"));
                        } else {
                            user.accounts.push({
                                allyCode: allycode,
                                name: player.name,
                                primary: !user.accounts.length,
                            });
                            await Bot.userReg.updateUser(userID, user);
                            return super.success(
                                interaction,
                                codeBlock(
                                    "asciiDoc",
                                    interaction.language.get(
                                        "COMMAND_REGISTER_SUCCESS_DESC",
                                        player,
                                        player.allyCode.toString().match(/\d{3}/g).join("-"),
                                        player.stats.find((s) => s.nameKey === "STAT_GALACTIC_POWER_ACQUIRED_NAME").value.toLocaleString(),
                                    ),
                                ),
                                {
                                    title: interaction.language.get("COMMAND_REGISTER_SUCCESS_HEADER", player.name),
                                },
                            );
                        }
                    } catch (e) {
                        Bot.logger.error(`ERROR[UC AC ADD]: Incorrect Ally Code(${allycode}): ${e}`);
                        return super.error(
                            interaction,
                            `Something broke. Please make sure you've got the correct ally code${codeBlock(e.message)}`,
                        );
                    }
                    break;
                }
                case "remove": {
                    // Remove specified ally code from the list,
                    // - If it was not in the list, let em know
                    // - If the chosen one was the primary, set the 1st
                    const acc = user.accounts.find((a) => a.allyCode === allycode);
                    if (!acc) {
                        return super.error(interaction, interaction.language.get("COMMAND_USERCONF_ALLYCODE_NOT_REGISTERED"));
                    }

                    // Filter out the one(s) that match the specified allycode
                    user.accounts = user.accounts.filter((a) => a.allyCode !== acc.allyCode);
                    // If none of the remaining accounts are marked as primary, mark the first one as such
                    if (user.accounts.length && !user.accounts.find((a) => a.primary)) {
                        user.accounts[0].primary = true;
                    }
                    await Bot.userReg.updateUser(userID, user);
                    return super.success(
                        interaction,
                        interaction.language.get("COMMAND_USERCONF_ALLYCODE_REMOVED_SUCCESS", acc.name, acc.allyCode),
                    );
                }
                case "make_primary": {
                    // Set the specified ally code to be the primary one
                    const acc = user.accounts.find((a) => a.allyCode === allycode);
                    const prim = user.accounts.find((a) => a.primary);
                    if (!acc) {
                        return super.error(interaction, interaction.language.get("COMMAND_USERCONF_ALLYCODE_NOT_REGISTERED"));
                    }
                    if (acc.primary) {
                        return super.error(interaction, interaction.language.get("COMMAND_USERCONF_ALLYCODE_ALREADY_PRIMARY"));
                    }
                    user.accounts = user.accounts.map((a) => {
                        if (a.primary) a.primary = false;
                        if (a.allyCode === allycode) a.primary = true;
                        return a;
                    });
                    await Bot.userReg.updateUser(userID, user);
                    return super.success(
                        interaction,
                        interaction.language.get("COMMAND_USERCONF_ALLYCODE_NEW_PRIMARY", prim.name, prim.allyCode, acc.name, acc.allyCode),
                    );
                }
            }
        } else {
            // They're not trying to work with the ally codes, so do other stuff
            switch (subCommand) {
                case "arena_alert": {
                    // Work through enabledms, arena, payout result/ warning
                    const updateLog = [];

                    // isEnabled: all, primary, off
                    const enableDMs = interaction.options.getString("enable_dms");
                    if (enableDMs) {
                        user.arenaAlert.enabledms = enableDMs;
                        updateLog.push(`Changed EnableDMS to ${enableDMs}`);
                    }

                    // arena: char, fleet, both, none
                    const arena = interaction.options.getString("arena");
                    if (arena) {
                        user.arenaAlert.arena = arena;
                        updateLog.push(`Changed Arena to ${arena}`);
                    }

                    // payoutResult: true/ false
                    const payoutResult = interaction.options.getBoolean("payout_result");
                    if (payoutResult !== null) {
                        user.arenaAlert.payoutResult = payoutResult;
                        updateLog.push(`Changed PayoutResult to ${payoutResult}`);
                    }

                    // payoutWarning: int between 1 & 1440 (1 min to 1 day)
                    const payoutWarning = interaction.options.getInteger("payout_warning");
                    if (payoutWarning < 0 || payoutWarning > 1440) {
                        return super.error(interaction, interaction.language.get("COMMAND_USERCONF_ARENA_INVALID_NUMBER"));
                    }
                    if (payoutWarning !== null) {
                        user.arenaAlert.payoutWarning = payoutWarning;
                        updateLog.push(`Changed PayoutWarning to ${payoutWarning}`);
                    }

                    if (updateLog.length) {
                        await Bot.userReg.updateUser(userID, user);
                        return super.success(
                            interaction,
                            `Updated the following:\n ${codeBlock("asciiDoc", updateLog.map((update) => ` * ${update}`).join("\n"))}`,
                        );
                    }
                    return super.error(interaction, "Nothing was updated. \nPlease make sure you choose one of the options to change.");
                }
                case "lang": {
                    // Work through bot_language & swgoh_language
                    const botLanguage = interaction.options.getString("bot_language");
                    const swgohLanguage = interaction.options.getString("swgoh_language");

                    // Make sure it exists before trying to set stuff to it
                    if (!user.lang) user.lang = {};

                    const updateLog = [];
                    if (botLanguage) {
                        user.lang.language = botLanguage;
                        updateLog.push(`Updated the bot's language to ${botLanguage}`);
                    }
                    if (swgohLanguage) {
                        user.lang.swgohLanguage = swgohLanguage;
                        updateLog.push(`Updated the game data language to ${swgohLanguage}`);
                    }

                    if (updateLog.length) {
                        await Bot.userReg.updateUser(userID, user);
                        return super.success(
                            interaction,
                            `Updated the following:\n ${codeBlock("asciiDoc", updateLog.map((update) => ` * ${update}`).join("\n"))}`,
                        );
                    }
                    return super.error(interaction, "Nothing was updated. \nPlease make sure you choose one of the options to change.");
                }
                case "view": {
                    // Just display all the valid info here
                    if (!user) {
                        return super.error(interaction, interaction.language.get("COMMAND_USERCONF_VIEW_NO_CONFIG"));
                    }
                    const fields = [];
                    const MAX_ALLYCODES = 20;
                    let codeTable = user.accounts
                        .slice(0, MAX_ALLYCODES)
                        .map((a, ix) => `\`[${ix + 1}] ${a.allyCode}\`: ${a.primary ? `**${a.name}**` : a.name}`)
                        .join("\n");
                    if (user.accounts.length > MAX_ALLYCODES)
                        codeTable += `\n* _Not displaying ${user.accounts.length - MAX_ALLYCODES} codes_`;
                    fields.push({
                        name: interaction.language.get("COMMAND_USERCONF_VIEW_ALLYCODES_HEADER"),
                        value: `>>> ${
                            user.accounts.length
                                ? interaction.language.get("COMMAND_USERCONF_VIEW_ALLYCODES_PRIMARY") + codeTable
                                : interaction.language.get("COMMAND_USERCONF_VIEW_ALLYCODES_NO_AC")
                        }`,
                    });
                    fields.push({
                        name: interaction.language.get("COMMAND_USERCONF_VIEW_LANG_HEADER"),
                        value: [
                            `>>> Language: **${user.lang ? (user.lang.language ? user.lang.language : "N/A") : "N/A"}**`,
                            `swgohLanguage: **${
                                user.lang ? (user.lang.swgohLanguage ? user.lang.swgohLanguage.toUpperCase() : "N/A") : "N/A"
                            }**`,
                        ].join("\n"),
                    });

                    const pat = await Bot.getPatronUser(interaction.user.id);
                    if (!pat || pat.amount_cents < 100) {
                        // If the user will not have any of the following settings, don't bother showing everything/ tell em what's available
                        const patreonValue = [
                            ">>> If you subscribe on [Patreon](https://patreon.com/swgohbot), this will show settings for those parts of the bot as well. https://patreon.com/swgohbot",
                        ];
                        for (const cmd of Object.keys(patreonInfo.commands)) {
                            patreonValue.push(...["", `**__${cmd}__**`, patreonInfo.commands[cmd]]);
                        }
                        fields.push({
                            name: "Patreon settings",
                            value: patreonValue.join("\n"),
                        });
                    } else {
                        // Arena Alert settings
                        fields.push({
                            name: interaction.language.get("COMMAND_USERCONF_VIEW_ARENA_HEADER"),
                            value: [
                                `>>> ${interaction.language.get("COMMAND_USERCONF_VIEW_ARENA_DM")}: **${
                                    user.arenaAlert.enableRankDMs ? user.arenaAlert.enableRankDMs : "N/A"
                                }**`,
                                `${interaction.language.get("COMMAND_USERCONF_VIEW_ARENA_SHOW")}: **${user.arenaAlert.arena}**`,
                                `${interaction.language.get("COMMAND_USERCONF_VIEW_ARENA_WARNING")}: **${
                                    user.arenaAlert.payoutWarning ? `${user.arenaAlert.payoutWarning} min` : "disabled"
                                }**`,
                                `${interaction.language.get("COMMAND_USERCONF_VIEW_ARENA_RESULT")}: **${
                                    user.arenaAlert.enablePayoutResult ? "ON" : "OFF"
                                }**`,
                            ].join("\n"),
                        });

                        // General AW settings
                        const uAW = user.arenaWatch;
                        if (uAW && Object.keys(uAW)?.length) {
                            fields.push({
                                name: "Arenawatch",
                                value: [
                                    `>>> Enabled: **${uAW.enabled ? "ON" : "OFF"}**`,
                                    `Channel: **${uAW.channel ? `<#${uAW.channel}>` : "N/A"}**`,
                                    `Emotes in log: **${uAW.useEmotesInLog ? "ON" : "OFF"}**`,
                                    `Marks in log: **${uAW.useMarksInLog ? "ON" : "OFF"}**`,
                                    `Report: **${uAW.report ? "ON" : "OFF"}**`,
                                    `ShowVS: **${uAW.showvs ? "ON" : "OFF"}**`,
                                    "",
                                    `Fleet Enabled: **${uAW.arena.fleet.enabled ? "ON" : "OFF"}**`,
                                    `Fleet Channel: **${uAW.arena.fleet.channel ? `<#${uAW.arena.fleet.channel}>` : "N/A"}**`,
                                    "",
                                    `Char Enabled: **${uAW.arena.char.enabled ? "ON" : "OFF"}**`,
                                    `Char Channel: **${uAW.arena.char.channel ? `<#${uAW.arena.char.channel}>` : "N/A"}**`,
                                ].join("\n"),
                            });

                            // AW Allycodes
                            fields.push({
                                name: "Arenawatch Allycodes",
                                value: `\`\`\`${user.arenaWatch.allycodes
                                    .sort((a, b) => (a.name.toLowerCase() > b.name.toLowerCase() ? 1 : -1))
                                    .map((ac) => `${ac.allyCode} | ${ac.name}`)
                                    .join("\n")}\`\`\``,
                            });

                            // The AW payout stuff
                            const po = user.arenaWatch.payout;
                            fields.push({
                                name: "Arenawatch Payouts",
                                value: [
                                    `>>> Fleet Enabled: **${po.fleet.enabled ? "ON" : "OFF"}**`,
                                    `Fleet Channel: **${po.fleet.channel ? `<#${po.fleet.channel}>` : "N/A"}**`,
                                    "",
                                    `Char Enabled: **${po.char.enabled ? "ON" : "OFF"}**`,
                                    `Char Channel: **${po.char.channel ? `<#${po.char.channel}>` : "N/A"}**`,
                                ].join("\n"),
                            });
                        }

                        // Guild Update settings
                        if (user.guildUpdate && Object.keys(user.guildUpdate)?.length) {
                            fields.push({
                                name: "Guild Updates",
                                value: [
                                    `>>> Enabled:  **${user.guildUpdate.enabled ? "ON" : "OFF"}**`,
                                    `Channel:  ${user.guildUpdate.channel ? `<#${user.guildUpdate.channel}>` : "N/A"}`,
                                    `Allycode: **${user.guildUpdate.allyCode || "N/A"}**`,
                                    `SortBy:   **${user.guildUpdate.sortBy || "N/A"}**`,
                                ].join("\n"),
                            });
                        }

                        // Guild Tickets settings
                        if (user.guildTickets && Object.keys(user.guildTickets)?.length) {
                            fields.push({
                                name: "Guild Tickets",
                                value: [
                                    `>>> Enabled:  **${user.guildTickets.enabled ? "ON" : "OFF"}**`,
                                    `Channel:  ${user.guildTickets.channel ? `<#${user.guildTickets.channel}>` : "N/A"}`,
                                    `Allycode: **${user.guildTickets.allyCode || "N/A"}**`,
                                    `SortBy:   **${user.guildTickets.sortBy || "N/A"}**`,
                                ].join("\n"),
                            });
                        }
                    }

                    const u = await interaction.client.users.fetch(userID);
                    return interaction.reply({
                        embeds: [
                            {
                                author: { name: u.username },
                                fields: fields,
                            },
                        ],
                    });
                }
            }
        }
    }
}

module.exports = UserConf;
