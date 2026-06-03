import {
    ApplicationCommandOptionType,
    type AutocompleteFocusedOption,
    type AutocompleteInteraction,
    codeBlock,
    InteractionContextType,
} from "discord.js";
import Language from "../base/Language.ts";
import Command from "../base/slashCommand.ts";
import constants from "../data/constants/constants.ts";
import patreonInfo from "../data/patreon.ts";
import { isAllyCode } from "../modules/functions.ts";
import logger from "../modules/Logger.ts";
import patreonFuncs from "../modules/patreonFuncs.ts";
import swgohAPI from "../modules/swapi.ts";
import userReg from "../modules/users.ts";
import type { SWAPILang } from "../types/swapi_types.ts";
import type { BotLanguage, CommandContext, UserConfig } from "../types/types.ts";

export default class UserConf extends Command {
    static readonly metadata = {
        name: "userconf",
        description: "Change your personal settings with the bot (allycode, view alerts, etc.)",
        category: "General",
        contexts: [InteractionContextType.Guild, InteractionContextType.BotDM],
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
                                autocomplete: true,
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
                                autocomplete: true,
                            },
                        ],
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
                        choices: Object.keys(Language.getLanguages()).map((lang) => {
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
                        choices: constants.swgohLangList.map((lang) => {
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
    };
    constructor() {
        super(UserConf.metadata);
    }

    async run({ interaction, language }: CommandContext) {
        const subCommandGroup = interaction.options.getSubcommandGroup(false);
        const subCommand = interaction.options.getSubcommand();

        const userID = interaction.user.id;

        let user: UserConfig = await userReg.getUser(userID);
        if (!user) {
            // If the user doesn't have a config available, set the default one for embeds
            // This has id, accounts, arenaAlert, and lang
            user = structuredClone(constants.defaultUserConf) as Partial<UserConfig> as UserConfig;
            user.id = userID;
        }

        if (subCommandGroup) {
            // This means the user is working with the allycode, so go from there

            let allyCode = interaction.options.getString("allycode");
            if (!isAllyCode(allyCode)) {
                return super.error(interaction, language.get("BASE_INVALID_ALLY_CODE_AC", allyCode));
            }
            allyCode = allyCode.replace(/[^\d]*/g, "");

            switch (subCommand) {
                case "add": {
                    // Add an ally code to the user's list
                    // Make sure it's not in there already, then stick it in.
                    const cooldown = await patreonFuncs.getPlayerCooldown(userID, interaction?.guild?.id);
                    if (user.accounts.map((a) => a.allyCode).includes(Number.parseInt(allyCode, 10))) {
                        // Make sure the specified code is not already registered
                        return super.error(interaction, language.get("COMMAND_USERCONF_ALLYCODE_ALREADY_REGISTERED"));
                    }
                    if (user.accounts.length >= 10) {
                        // Cap the personal codes to 10
                        return super.error(interaction, language.get("COMMAND_USERCONF_ALLYCODE_TOO_MANY"));
                    }
                    try {
                        const playerRes = await swgohAPI.unitStats(Number(allyCode), cooldown);
                        const player = playerRes?.[0] || null;
                        if (!player) {
                            return super.error(interaction, language.get("BASE_REGISTRATION_FAILURE"));
                        }
                        user.accounts.push({
                            allyCode: Number.parseInt(allyCode, 10),
                            name: player.name,
                            primary: !user.accounts.length,
                        });
                        await userReg.updateUser(userID, user);
                        return super.success(
                            interaction,
                            codeBlock(
                                "asciiDoc",
                                language.get(
                                    "COMMAND_REGISTER_SUCCESS_DESC",
                                    player,
                                    player.allyCode.toString().match(/\d{3}/g)?.join("-") ?? player.allyCode.toString(),
                                    player.stats.find((s) => s.nameKey === "STAT_GALACTIC_POWER_ACQUIRED_NAME")?.value?.toLocaleString() ??
                                        "0",
                                ),
                            ),
                            {
                                title: language.get("BASE_REGISTRATION_SUCCESS", player.name),
                            },
                        );
                    } catch (e) {
                        logger.error(`ERROR[UC AC ADD]: Incorrect Ally Code(${allyCode}): ${e}`);
                        return super.error(
                            interaction,
                            `Something broke. Please make sure you've got the correct ally code${codeBlock(e.message)}`,
                        );
                    }
                }
                case "remove": {
                    // Remove specified ally code from the list,
                    // - If it was not in the list, let em know
                    // - If the chosen one was the primary, set the 1st
                    const acc = user.accounts.find((a) => a.allyCode === Number.parseInt(allyCode, 10));
                    if (!acc) {
                        return super.error(interaction, language.get("COMMAND_USERCONF_ALLYCODE_NOT_REGISTERED"));
                    }

                    // Filter out the one(s) that match the specified ally code
                    user.accounts = user.accounts.filter((a) => a.allyCode !== acc.allyCode);
                    // If none of the remaining accounts are marked as primary, mark the first one as such
                    if (user.accounts.length && !user.accounts.find((a) => a.primary)) {
                        user.accounts[0].primary = true;
                    }
                    await userReg.updateUser(userID, user);
                    return super.success(interaction, language.get("COMMAND_USERCONF_ALLYCODE_REMOVED_SUCCESS", acc.name, acc.allyCode));
                }
                case "make_primary": {
                    // Set the specified ally code to be the primary one
                    const acc = user.accounts.find((a) => a.allyCode === Number.parseInt(allyCode, 10));
                    if (!acc) {
                        return super.error(interaction, language.get("COMMAND_USERCONF_ALLYCODE_NOT_REGISTERED"));
                    }
                    if (acc.primary) {
                        return super.error(interaction, language.get("COMMAND_USERCONF_ALLYCODE_ALREADY_PRIMARY"));
                    }
                    const prim = user.accounts.find((a) => a.primary);
                    user.accounts = user.accounts.map((a) => {
                        if (a.primary) a.primary = false;
                        if (a.allyCode === Number.parseInt(allyCode, 10)) a.primary = true;
                        return a;
                    });
                    await userReg.updateUser(userID, user);
                    return super.success(
                        interaction,
                        language.get("COMMAND_USERCONF_ALLYCODE_NEW_PRIMARY", prim?.name, prim?.allyCode, acc.name, acc.allyCode),
                    );
                }
            }
        } else {
            // They're not trying to work with the ally codes, so do other stuff
            switch (subCommand) {
                case "lang": {
                    // Work through bot_language & swgoh_language
                    const botLanguage = interaction.options.getString("bot_language") as BotLanguage;
                    const swgohLanguage = interaction.options.getString("swgoh_language") as SWAPILang;

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
                        await userReg.updateUser(userID, user);
                        return super.success(
                            interaction,
                            `Updated the following:\n ${codeBlock("asciiDoc", updateLog.map((update) => ` * ${update}`).join("\n"))}`,
                        );
                    }
                    return super.error(interaction, language.get("COMMAND_USERCONF_NOTHING_UPDATED"));
                }
                case "view": {
                    const pat = await patreonFuncs.getPatronUser(interaction.user.id);
                    const isPatron = pat && pat.amount_cents >= 100;

                    const fields = [];

                    // Ally codes
                    const MAX_ALLYCODES = 20;
                    let codeTable = user.accounts
                        .slice(0, MAX_ALLYCODES)
                        .map((a, ix) => `\`[${ix + 1}] ${a.allyCode}\`: ${a.primary ? `**${a.name}**` : a.name}`)
                        .join("\n");
                    if (user.accounts.length > MAX_ALLYCODES)
                        codeTable += `\n* _Not displaying ${user.accounts.length - MAX_ALLYCODES} codes_`;
                    fields.push({
                        name: language.get("COMMAND_USERCONF_VIEW_ALLYCODES_HEADER"),
                        value: `>>> ${
                            user.accounts.length
                                ? language.get("COMMAND_USERCONF_VIEW_ALLYCODES_PRIMARY") + codeTable
                                : language.get("COMMAND_USERCONF_VIEW_ALLYCODES_NO_AC")
                        }`,
                    });

                    // Language settings
                    fields.push({
                        name: language.get("COMMAND_USERCONF_VIEW_LANG_HEADER"),
                        value: [
                            `>>> Language: **${user.lang?.language ?? "N/A"}**`,
                            `swgohLanguage: **${user.lang?.swgohLanguage?.toUpperCase() ?? "N/A"}**`,
                        ].join("\n"),
                    });

                    if (isPatron) {
                        // Arena Alert — read-only display; configure via /arenaalert
                        fields.push({
                            name: language.get("BASE_ARENA_VIEW_HEADER"),
                            value: [
                                `-# ${language.get("COMMAND_USERCONF_VIEW_ARENA_ALERT_CONFIGURE")}`,
                                `>>> ${language.get("BASE_ARENA_VIEW_DM")}: **${user.arenaAlert.enableRankDMs || "N/A"}**`,
                                `${language.get("BASE_ARENA_VIEW_SHOW")}: **${user.arenaAlert.arena}**`,
                                `${language.get("BASE_ARENA_VIEW_WARNING")}: **${user.arenaAlert.payoutWarning ? `${user.arenaAlert.payoutWarning} min` : "disabled"}**`,
                                `${language.get("BASE_ARENA_VIEW_RESULT")}: **${user.arenaAlert.enablePayoutResult ? "ON" : "OFF"}**`,
                            ].join("\n"),
                        });

                        // ArenaWatch
                        const uAW = user.arenaWatch;
                        if (uAW && Object.keys(uAW).length) {
                            fields.push({
                                name: language.get("COMMAND_USERCONF_VIEW_AW_HEADER"),
                                value: [
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

                            fields.push({
                                name: language.get("COMMAND_USERCONF_VIEW_AW_ALLYCODES_HEADER"),
                                value: `\`\`\`${user.arenaWatch.allyCodes
                                    .sort((a, b) => (a.name.toLowerCase() > b.name.toLowerCase() ? 1 : -1))
                                    .map((ac) => `${ac.allyCode} | ${ac.name}`)
                                    .join("\n")}\`\`\``,
                            });

                            const po = user.arenaWatch.payout;
                            fields.push({
                                name: language.get("COMMAND_USERCONF_VIEW_AW_PAYOUTS_HEADER"),
                                value: [
                                    `>>> Fleet Enabled: **${po.fleet.enabled ? "ON" : "OFF"}**`,
                                    `Fleet Channel: **${po.fleet.channel ? `<#${po.fleet.channel}>` : "N/A"}**`,
                                    "",
                                    `Char Enabled: **${po.char.enabled ? "ON" : "OFF"}**`,
                                    `Char Channel: **${po.char.channel ? `<#${po.char.channel}>` : "N/A"}**`,
                                ].join("\n"),
                            });
                        }

                        // Guild Updates
                        if (user.guildUpdate && Object.keys(user.guildUpdate).length) {
                            fields.push({
                                name: language.get("COMMAND_USERCONF_VIEW_GU_HEADER"),
                                value: [
                                    `>>> Enabled:  **${user.guildUpdate.enabled ? "ON" : "OFF"}**`,
                                    `Channel:  ${user.guildUpdate.channel ? `<#${user.guildUpdate.channel}>` : "N/A"}`,
                                    `Allycode: **${user.guildUpdate.allyCode || "N/A"}**`,
                                ].join("\n"),
                            });
                        }

                        // Guild Tickets
                        if (user.guildTickets && Object.keys(user.guildTickets).length) {
                            fields.push({
                                name: language.get("COMMAND_USERCONF_VIEW_GT_HEADER"),
                                value: [
                                    `>>> Enabled:  **${user.guildTickets.enabled ? "ON" : "OFF"}**`,
                                    `Channel:  ${user.guildTickets.channel ? `<#${user.guildTickets.channel}>` : "N/A"}`,
                                    `Allycode: **${user.guildTickets.allyCode || "N/A"}**`,
                                    `SortBy:   **${user.guildTickets.sortBy || "N/A"}**`,
                                ].join("\n"),
                            });
                        }

                        // Patreon status for subscribers
                        const tierThresholds = Object.keys(patreonInfo.tiers)
                            .map(Number)
                            .filter((t) => t > 0);
                        const tierNum = tierThresholds.filter((t) => pat.amount_cents / 100 >= t).reduce((a, b) => Math.max(a, b), 0);
                        const tier = patreonInfo.tiers[tierNum];
                        const bonusGuildName = user.bonusServer
                            ? (interaction.client.guilds.cache.get(user.bonusServer)?.name ?? user.bonusServer)
                            : language.get("COMMAND_USERCONF_VIEW_PATREON_NONE_SET");
                        const patreonLines = [
                            `>>> ${language.get("COMMAND_USERCONF_VIEW_PATREON_TIER", tier.name, tierNum)}`,
                            language.get("COMMAND_USERCONF_VIEW_PATREON_BONUS_SERVER", bonusGuildName),
                        ];
                        if (tier.benefits) {
                            patreonLines.push("", language.get("COMMAND_USERCONF_VIEW_PATREON_BENEFITS_HEADER"));
                            for (const [name, desc] of Object.entries(tier.benefits)) {
                                patreonLines.push(`**${name}**: ${desc}`);
                            }
                        }
                        fields.push({ name: language.get("COMMAND_USERCONF_VIEW_PATREON_HEADER"), value: patreonLines.join("\n") });
                    } else {
                        // Non-subscriber: show promo in the Patreon section
                        const patreonValue = [
                            ">>> If you subscribe on [Patreon](https://patreon.com/swgohbot), this will show settings for those parts of the bot as well. https://patreon.com/swgohbot",
                        ];
                        for (const cmd of Object.keys(patreonInfo.commands)) {
                            patreonValue.push(...["", `**__${cmd}__**`, patreonInfo.commands[cmd]]);
                        }
                        fields.push({ name: language.get("COMMAND_USERCONF_VIEW_PATREON_HEADER"), value: patreonValue.join("\n") });
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

    async autocomplete(interaction: AutocompleteInteraction, focusedOption: AutocompleteFocusedOption) {
        const subCommandGroup = interaction.options.getSubcommandGroup(false);
        const subCommand = interaction.options.getSubcommand();

        // Only handle autocomplete for the make_primary or remove subcommand's ally code option
        if (subCommandGroup === "allycodes" && ["make_primary", "remove"].includes(subCommand) && focusedOption.name === "allycode") {
            const searchKey = focusedOption.value?.trim().toLowerCase() || "";

            // Fetch the user's registered accounts
            const user = await userReg.getUser(interaction.user.id);
            if (!user?.accounts || user.accounts.length === 0) {
                // No registered accounts, return empty array
                return await interaction.respond([]);
            }

            // Filter accounts based on search term (match both name and allycode)
            const outArr = user.accounts
                .filter((account) => {
                    const nameMatch = account.name.toLowerCase().includes(searchKey);
                    const codeMatch = account.allyCode.toString().includes(searchKey);
                    return nameMatch || codeMatch;
                })
                .map((account) => ({
                    name: `${account.name} - ${account.allyCode}`,
                    value: account.allyCode,
                }))
                .slice(0, 24); // Discord's autocomplete limit

            await interaction.respond(outArr);
        }
    }
}
