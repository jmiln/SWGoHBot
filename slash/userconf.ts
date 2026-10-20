import {
    type APIEmbedField,
    ApplicationCommandOptionType,
    type AutocompleteFocusedOption,
    type AutocompleteInteraction,
    type ChatInputCommandInteraction,
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
import type { ArenaPlayer, BotLanguage, CommandContext, UserConfig } from "../types/types.ts";

const MAX_ALLYCODES = 20;

export default class UserConf extends Command {
    static readonly metadata = {
        name: "userconf",
        description: "Change your personal settings with the bot (allycode, view alerts, etc.)",
        category: "General",
        contexts: [InteractionContextType.Guild, InteractionContextType.BotDM],
        options: [
            {
                name: "allycodes",
                description: "Manage your linked ally codes",
                type: ApplicationCommandOptionType.SubcommandGroup,
                // Need add, remove, makeprimary
                options: [
                    {
                        name: "add",
                        type: ApplicationCommandOptionType.Subcommand,
                        description: "Add an ally code",
                        options: [
                            {
                                name: "allycode",
                                description: "The ally code to add",
                                type: ApplicationCommandOptionType.String,
                                required: true,
                            },
                        ],
                    },
                    {
                        name: "remove",
                        type: ApplicationCommandOptionType.Subcommand,
                        description: "Remove an ally code",
                        options: [
                            {
                                name: "allycode",
                                description: "The ally code to remove",
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
                                description: "The ally code to make your primary",
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

            const allyCode = interaction.options.getString("allycode");
            if (!allyCode || !isAllyCode(allyCode)) {
                return super.error(interaction, language.get("BASE_INVALID_ALLY_CODE_AC", allyCode ?? ""));
            }
            const parsedCode = Number.parseInt(allyCode.replace(/[^\d]*/g, ""), 10);

            switch (subCommand) {
                case "add":
                    return this.addAllyCode(interaction, language, user, parsedCode);
                case "remove":
                    return this.removeAllyCode(interaction, language, user, parsedCode);
                case "make_primary":
                    return this.makePrimaryAllyCode(interaction, language, user, parsedCode);
            }
        }

        // They're not trying to work with the ally codes, so do other stuff
        switch (subCommand) {
            case "lang":
                return this.setLang(interaction, language, user);
            case "view":
                return this.view(interaction, language, user);
        }
    }

    private async addAllyCode(interaction: ChatInputCommandInteraction, language: Language, user: UserConfig, allyCode: number) {
        const cooldown = await patreonFuncs.getPlayerCooldown(user.id, interaction?.guild?.id);
        if (user.accounts.includes(allyCode)) {
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
            const playerRes = await swgohAPI.unitStats(allyCode, cooldown);
            const player = playerRes?.[0] || null;
            if (!player) {
                return super.error(interaction, language.get("BASE_REGISTRATION_FAILURE"));
            }
            user.accounts.push(allyCode);
            if (!user.primaryAllyCode) user.primaryAllyCode = allyCode;
            await arenaPlayerRegistry.upsertPlayer({ allyCode, name: player.name });
            await userReg.updateUser(user.id, user);
            return super.success(
                interaction,
                codeBlock(
                    "asciiDoc",
                    language.get(
                        "COMMAND_REGISTER_SUCCESS_DESC",
                        player,
                        player.allyCode.toString().match(/\d{3}/g)?.join("-") ?? player.allyCode.toString(),
                        player.stats.find((s) => s.nameKey === "STAT_GALACTIC_POWER_ACQUIRED_NAME")?.value?.toLocaleString() ?? "0",
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
                `Something broke. Please make sure you've got the correct ally code${codeBlock(e instanceof Error ? e.message : String(e))}`,
            );
        }
    }

    private async removeAllyCode(interaction: ChatInputCommandInteraction, language: Language, user: UserConfig, allyCode: number) {
        if (!user.accounts.includes(allyCode)) {
            return super.error(interaction, language.get("COMMAND_USERCONF_ALLYCODE_NOT_REGISTERED"));
        }
        const playerDoc = await arenaPlayerRegistry.getPlayer(allyCode);
        const playerName = playerDoc?.name ?? String(allyCode);

        // removeAllyCode filters the code out and reassigns primary if needed
        await userReg.removeAllyCode(user.id, allyCode);
        return super.success(interaction, language.get("COMMAND_USERCONF_ALLYCODE_REMOVED_SUCCESS", playerName, allyCode));
    }

    private async makePrimaryAllyCode(interaction: ChatInputCommandInteraction, language: Language, user: UserConfig, allyCode: number) {
        if (!user.accounts.includes(allyCode)) {
            return super.error(interaction, language.get("COMMAND_USERCONF_ALLYCODE_NOT_REGISTERED"));
        }
        if (user.primaryAllyCode === allyCode) {
            return super.error(interaction, language.get("COMMAND_USERCONF_ALLYCODE_ALREADY_PRIMARY"));
        }
        const prevPrimary = user.primaryAllyCode ?? null;
        user.primaryAllyCode = allyCode;
        await userReg.updateUser(user.id, user);
        const [prevDoc, newDoc] = await Promise.all([
            prevPrimary ? arenaPlayerRegistry.getPlayer(prevPrimary) : Promise.resolve(null),
            arenaPlayerRegistry.getPlayer(allyCode),
        ]);
        return super.success(
            interaction,
            language.get("COMMAND_USERCONF_ALLYCODE_NEW_PRIMARY", prevDoc?.name ?? "", prevPrimary ?? "", newDoc?.name ?? "", allyCode),
        );
    }

    private async setLang(interaction: ChatInputCommandInteraction, language: Language, user: UserConfig) {
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
            await userReg.updateUser(user.id, user);
            return super.success(
                interaction,
                `Updated the following:\n ${codeBlock("asciiDoc", updateLog.map((update) => ` * ${update}`).join("\n"))}`,
            );
        }
        return super.error(interaction, language.get("COMMAND_USERCONF_NOTHING_UPDATED"));
    }

    private async view(interaction: ChatInputCommandInteraction, language: Language, user: UserConfig) {
        const pat = await patreonFuncs.getPatronUser(interaction.user.id);

        // Ally codes - fetch names for both accounts and arenaWatch entries in one call
        const awCodes = user.arenaWatch?.allyCodes?.map((ac) => ac.allyCode) ?? [];
        const playerMap = await arenaPlayerRegistry.batchGet([...new Set([...user.accounts, ...awCodes])]);

        const fields: APIEmbedField[] = [allyCodesField(user, playerMap, language), langField(user, language)];
        if (pat && pat.amount_cents >= 100) {
            const bonusGuildName = user.bonusServer
                ? (interaction.client.guilds.cache.get(user.bonusServer)?.name ?? user.bonusServer)
                : language.get("COMMAND_USERCONF_VIEW_PATREON_NONE_SET");
            fields.push(
                arenaAlertField(user, language),
                ...arenaWatchFields(user, playerMap, language),
                ...guildUpdateFields(user, language),
                ...guildTicketsFields(user, language),
                patreonTierField(pat.amount_cents, bonusGuildName, language),
            );
        } else {
            fields.push(patreonPromoField(language));
        }

        const u = await interaction.client.users.fetch(user.id);
        return interaction.reply({
            embeds: [
                {
                    author: { name: u.username },
                    fields: fields,
                },
            ],
        });
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

function allyCodesField(user: UserConfig, playerMap: Map<number, ArenaPlayer>, language: Language): APIEmbedField {
    let codeTable = user.accounts
        .slice(0, MAX_ALLYCODES)
        .map((ac, ix) => {
            const name = playerMap.get(ac)?.name ?? String(ac);
            const isPrimary = ac === user.primaryAllyCode;
            return `\`[${ix + 1}] ${ac}\`: ${isPrimary ? `**${name}**` : name}`;
        })
        .join("\n");
    if (user.accounts.length > MAX_ALLYCODES) codeTable += `\n* _Not displaying ${user.accounts.length - MAX_ALLYCODES} codes_`;
    return {
        name: language.get("COMMAND_USERCONF_VIEW_ALLYCODES_HEADER"),
        value: `>>> ${
            user.accounts.length
                ? language.get("COMMAND_USERCONF_VIEW_ALLYCODES_PRIMARY") + codeTable
                : language.get("COMMAND_USERCONF_VIEW_ALLYCODES_NO_AC")
        }`,
    };
}

function langField(user: UserConfig, language: Language): APIEmbedField {
    return {
        name: language.get("COMMAND_USERCONF_VIEW_LANG_HEADER"),
        value: [
            `>>> Language: **${user.lang?.language ?? "N/A"}**`,
            `swgohLanguage: **${user.lang?.swgohLanguage?.toUpperCase() ?? "N/A"}**`,
        ].join("\n"),
    };
}

// Arena Alert - read-only display; configure via /arenaalert
function arenaAlertField(user: UserConfig, language: Language): APIEmbedField {
    return {
        name: language.get("BASE_ARENA_VIEW_HEADER"),
        value: [
            `-# ${language.get("COMMAND_USERCONF_VIEW_CONFIGURE_WITH", "arenaalert")}`,
            `>>> ${language.get("BASE_ARENA_VIEW_DM")}: **${user.arenaAlert.enableRankDMs || "N/A"}**`,
            `${language.get("BASE_ARENA_VIEW_SHOW")}: **${user.arenaAlert.arena}**`,
            `${language.get("BASE_ARENA_VIEW_WARNING")}: **${user.arenaAlert.payoutWarning ? `${user.arenaAlert.payoutWarning} min` : "disabled"}**`,
            `${language.get("BASE_ARENA_VIEW_RESULT")}: **${user.arenaAlert.enablePayoutResult ? "ON" : "OFF"}**`,
        ].join("\n"),
    };
}

function arenaWatchFields(user: UserConfig, playerMap: Map<number, ArenaPlayer>, language: Language): APIEmbedField[] {
    const uAW = user.arenaWatch;
    if (!uAW || !Object.keys(uAW).length) return [];

    const po = uAW.payout;
    return [
        {
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
        },
        {
            name: language.get("COMMAND_USERCONF_VIEW_AW_ALLYCODES_HEADER"),
            value: `\`\`\`${uAW.allyCodes
                .sort((a, b) => {
                    const nameA = playerMap.get(a.allyCode)?.name?.toLowerCase() ?? String(a.allyCode);
                    const nameB = playerMap.get(b.allyCode)?.name?.toLowerCase() ?? String(b.allyCode);
                    return nameA > nameB ? 1 : -1;
                })
                .map((ac) => `${ac.allyCode} | ${playerMap.get(ac.allyCode)?.name ?? ac.allyCode}`)
                .join("\n")}\`\`\``,
        },
        {
            name: language.get("COMMAND_USERCONF_VIEW_AW_PAYOUTS_HEADER"),
            value: [
                `>>> Fleet Enabled: **${po.fleet.enabled ? "ON" : "OFF"}**`,
                `Fleet Channel: **${po.fleet.channel ? `<#${po.fleet.channel}>` : "N/A"}**`,
                "",
                `Char Enabled: **${po.char.enabled ? "ON" : "OFF"}**`,
                `Char Channel: **${po.char.channel ? `<#${po.char.channel}>` : "N/A"}**`,
            ].join("\n"),
        },
    ];
}

function guildUpdateFields(user: UserConfig, language: Language): APIEmbedField[] {
    const gu = user.guildUpdate;
    if (!gu || !Object.keys(gu).length) return [];
    return [
        {
            name: language.get("COMMAND_USERCONF_VIEW_GU_HEADER"),
            value: [
                `-# ${language.get("COMMAND_USERCONF_VIEW_CONFIGURE_WITH", "guildupdate")}`,
                `>>> Enabled:  **${gu.enabled ? "ON" : "OFF"}**`,
                `Channel:  ${gu.channel ? `<#${gu.channel}>` : "N/A"}`,
                `Allycode: **${gu.allyCode || "N/A"}**`,
            ].join("\n"),
        },
    ];
}

function guildTicketsFields(user: UserConfig, language: Language): APIEmbedField[] {
    const gt = user.guildTickets;
    if (!gt || !Object.keys(gt).length) return [];
    return [
        {
            name: language.get("COMMAND_USERCONF_VIEW_GT_HEADER"),
            value: [
                `-# ${language.get("COMMAND_USERCONF_VIEW_CONFIGURE_WITH", "guildtickets")}`,
                `>>> Enabled:  **${gt.enabled ? "ON" : "OFF"}**`,
                `Channel:  ${gt.channel ? `<#${gt.channel}>` : "N/A"}`,
                `Allycode: **${gt.allyCode || "N/A"}**`,
                `SortBy:   **${gt.sortBy || "N/A"}**`,
            ].join("\n"),
        },
    ];
}

// Patreon status for subscribers
function patreonTierField(amountCents: number, bonusGuildName: string, language: Language): APIEmbedField {
    const tierThresholds = Object.keys(patreonInfo.tiers)
        .map(Number)
        .filter((t) => t > 0);
    const tierNum = tierThresholds.filter((t) => amountCents / 100 >= t).reduce((a, b) => Math.max(a, b), 0);
    const tier = patreonInfo.tiers[tierNum as keyof typeof patreonInfo.tiers];
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
    return { name: language.get("COMMAND_USERCONF_VIEW_PATREON_HEADER"), value: patreonLines.join("\n") };
}

// Non-subscriber: show promo in the Patreon section
function patreonPromoField(language: Language): APIEmbedField {
    const patreonValue = [
        ">>> If you subscribe on [Patreon](https://patreon.com/swgohbot), this will show settings for those parts of the bot as well. https://patreon.com/swgohbot",
    ];
    for (const cmd of Object.keys(patreonInfo.commands)) {
        patreonValue.push(...["", `**__${cmd}__**`, patreonInfo.commands[cmd as keyof typeof patreonInfo.commands]]);
    }
    return { name: language.get("COMMAND_USERCONF_VIEW_PATREON_HEADER"), value: patreonValue.join("\n") };
}
