import {
    type APIEmbedField,
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
import arenaPlayerRegistry from "../modules/arenaPlayerRegistry.ts";
import { getCachedAllyCodeChoices } from "../modules/autocompleteCache.ts";
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

        let user: UserConfig | null = await userReg.getUser(userID);
        if (!user) {
            // If the user doesn't have a config available, set the default one for embeds
            // This has id, accounts, arenaAlert, and lang
            user = structuredClone(constants.defaultUserConf) as unknown as UserConfig;
            user.id = userID;
        }

        if (subCommandGroup) {
            // This means the user is working with the allycode, so go from there

            let allyCode = interaction.options.getString("allycode");
            if (!allyCode || !isAllyCode(allyCode)) {
                return super.error(interaction, language.get("BASE_INVALID_ALLY_CODE_AC", allyCode ?? ""));
            }
            allyCode = allyCode.replace(/[^\d]*/g, "");

            switch (subCommand) {
                case "add": {
                    // Add an ally code to the user's list
                    // Make sure it's not in there already, then stick it in.
                    const cooldown = await patreonFuncs.getPlayerCooldown(userID, interaction?.guild?.id);
                    if (user.accounts.includes(Number.parseInt(allyCode, 10))) {
                        // Make sure the specified code is not already registered
                        return super.error(interaction, language.get("COMMAND_USERCONF_ALLYCODE_ALREADY_REGISTERED"));
                    }
                    if (user.accounts.length >= 10) {
                        // Cap the personal codes to 10
                        return super.error(interaction, language.get("COMMAND_USERCONF_ALLYCODE_TOO_MANY"));
                    }
                    try {
                        // Acknowledge before the game-API lookup below, which can exceed Discord's 3s
                        // reply window and otherwise leave every later reply failing with "Unknown interaction".
                        await interaction.deferReply();
                        const playerRes = await swgohAPI.unitStats(Number(allyCode), cooldown);
                        const player = playerRes?.[0] || null;
                        if (!player) {
                            return super.error(interaction, language.get("BASE_REGISTRATION_FAILURE"));
                        }
                        const parsedCode = Number.parseInt(allyCode, 10);
                        user.accounts.push(parsedCode);
                        if (!user.primaryAllyCode) user.primaryAllyCode = parsedCode;
                        await arenaPlayerRegistry.upsertPlayer({ allyCode: parsedCode, name: player.name });
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
                    const parsedCode = Number.parseInt(allyCode, 10);
                    if (!user.accounts.includes(parsedCode)) {
                        return super.error(interaction, language.get("COMMAND_USERCONF_ALLYCODE_NOT_REGISTERED"));
                    }
                    const playerDoc = await arenaPlayerRegistry.getPlayer(parsedCode);
                    const playerName = playerDoc?.name ?? String(parsedCode);

                    // removeAllyCode filters the code out and reassigns primary if needed
                    await userReg.removeAllyCode(userID, parsedCode);
                    return super.success(interaction, language.get("COMMAND_USERCONF_ALLYCODE_REMOVED_SUCCESS", playerName, parsedCode));
                }
                case "make_primary": {
                    // Set the specified ally code to be the primary one
                    const parsedCode = Number.parseInt(allyCode, 10);
                    if (!user.accounts.includes(parsedCode)) {
                        return super.error(interaction, language.get("COMMAND_USERCONF_ALLYCODE_NOT_REGISTERED"));
                    }
                    if (user.primaryAllyCode === parsedCode) {
                        return super.error(interaction, language.get("COMMAND_USERCONF_ALLYCODE_ALREADY_PRIMARY"));
                    }
                    const prevPrimary = user.primaryAllyCode ?? null;
                    user.primaryAllyCode = parsedCode;
                    await userReg.updateUser(userID, user);
                    const [prevDoc, newDoc] = await Promise.all([
                        prevPrimary ? arenaPlayerRegistry.getPlayer(prevPrimary) : Promise.resolve(null),
                        arenaPlayerRegistry.getPlayer(parsedCode),
                    ]);
                    return super.success(
                        interaction,
                        language.get(
                            "COMMAND_USERCONF_ALLYCODE_NEW_PRIMARY",
                            prevDoc?.name ?? "",
                            prevPrimary ?? "",
                            newDoc?.name ?? "",
                            parsedCode,
                        ),
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

                    const updateLog: string[] = [];
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

                    const fields: APIEmbedField[] = [];

                    // Ally codes — fetch names for both accounts and arenaWatch entries in one call
                    const awCodes = user.arenaWatch?.allyCodes?.map((ac) => ac.allyCode) ?? [];
                    const playerMap = await arenaPlayerRegistry.batchGet([...new Set([...user.accounts, ...awCodes])]);
                    const MAX_ALLYCODES = 20;
                    let codeTable = user.accounts
                        .slice(0, MAX_ALLYCODES)
                        .map((ac, ix) => {
                            const name = playerMap.get(ac)?.name ?? String(ac);
                            const isPrimary = ac === user.primaryAllyCode;
                            return `\`[${ix + 1}] ${ac}\`: ${isPrimary ? `**${name}**` : name}`;
                        })
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
                                `-# ${language.get("COMMAND_USERCONF_VIEW_CONFIGURE_WITH", "arenaalert")}`,
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
                                    `-# ${language.get("COMMAND_USERCONF_VIEW_CONFIGURE_WITH", "arenawatch")}`,
                                    `Channel: **${uAW.channel ? `<#${uAW.channel}>` : "N/A"}**`,
                                    `Emotes in log: **${uAW.useEmotesInLog ? "ON" : "OFF"}**`,
                                    `Marks in log: **${uAW.useMarksInLog ? "ON" : "OFF"}**`,
                                    `Report: **${uAW.report ? "ON" : "OFF"}**`,
                                    `ShowVS: **${uAW.showvs ? "ON" : "OFF"}**`,
                                    "",
                                    `Fleet Enabled: **${uAW.arena.fleet?.enabled ? "ON" : "OFF"}**`,
                                    `Fleet Channel: **${uAW.arena.fleet?.channel ? `<#${uAW.arena.fleet.channel}>` : "N/A"}**`,
                                    "",
                                    `Char Enabled: **${uAW.arena.char?.enabled ? "ON" : "OFF"}**`,
                                    `Char Channel: **${uAW.arena.char?.channel ? `<#${uAW.arena.char.channel}>` : "N/A"}**`,
                                ].join("\n"),
                            });

                            fields.push({
                                name: language.get("COMMAND_USERCONF_VIEW_AW_ALLYCODES_HEADER"),
                                value: `\`\`\`${user.arenaWatch.allyCodes
                                    .sort((a, b) => {
                                        const nameA = playerMap.get(a.allyCode)?.name?.toLowerCase() ?? String(a.allyCode);
                                        const nameB = playerMap.get(b.allyCode)?.name?.toLowerCase() ?? String(b.allyCode);
                                        return nameA > nameB ? 1 : -1;
                                    })
                                    .map((ac) => `${ac.allyCode} | ${playerMap.get(ac.allyCode)?.name ?? ac.allyCode}`)
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
                                    `-# ${language.get("COMMAND_USERCONF_VIEW_CONFIGURE_WITH", "guildupdate")}`,
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
                                    `-# ${language.get("COMMAND_USERCONF_VIEW_CONFIGURE_WITH", "guildtickets")}`,
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
                        const tier = patreonInfo.tiers[tierNum as keyof typeof patreonInfo.tiers];
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
                            patreonValue.push(...["", `**__${cmd}__**`, patreonInfo.commands[cmd as keyof typeof patreonInfo.commands]]);
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

            // Served from a short-TTL cache so only the first keystroke hits the DB
            const choices = await getCachedAllyCodeChoices(interaction.user.id, searchKey);
            await interaction.respond(choices.slice(0, 24)); // Discord's autocomplete limit
        }
    }
}
