import { type APIEmbedField, ApplicationCommandOptionType, type ChatInputCommandInteraction, InteractionContextType } from "discord.js";
import type Language from "../base/Language.ts";
import Command from "../base/slashCommand.ts";
import constants from "../data/constants/constants.ts";
import { characters, ships } from "../data/constants/units.ts";
import {
    charListFromSearch,
    expandSpaces,
    findChar,
    getAllyCode,
    getGearStr,
    makeTable,
    msgArray,
    updatedFooterStr,
} from "../modules/functions.ts";
import logger from "../modules/Logger.ts";
import patreonFuncs from "../modules/patreonFuncs.ts";
import swgohAPI, { SwapiUserError } from "../modules/swapi.ts";
import type { RawCharacter, SWAPIGuild, SWAPIUnit, SWAPIUnitStatTypes } from "../types/swapi_types.ts";
import type { BotUnit, CommandContext } from "../types/types.ts";

export default class GuildSearch extends Command {
    static readonly metadata = {
        name: "guildsearch",
        category: "Gamedata",
        description: "Search for stats on your guild's units",
        contexts: [InteractionContextType.Guild, InteractionContextType.BotDM],
        options: [
            {
                name: "character",
                description: "Look for your guild's stats on a character.",
                type: ApplicationCommandOptionType.Subcommand,
                options: [
                    {
                        name: "character",
                        autocomplete: true,
                        description: "The character you want to display",
                        type: ApplicationCommandOptionType.String,
                        required: true,
                    },
                    {
                        name: "allycode",
                        description: "An ally code to determine which guild you're wanting to look up",
                        type: ApplicationCommandOptionType.String,
                    },
                    {
                        name: "sort",
                        description: "Choose what to sort by",
                        type: ApplicationCommandOptionType.String,
                        choices: [
                            { name: "Gear", value: "gear" },
                            { name: "GP", value: "gp" },
                            { name: "Name", value: "name" },
                        ],
                    },
                    {
                        name: "stat",
                        description: "Which stat you want it to show",
                        type: ApplicationCommandOptionType.String,
                        choices: [
                            { name: "Health", value: "Health" },
                            { name: "Protection", value: "Protection" },
                            { name: "Speed", value: "Speed" },
                            { name: "Potency", value: "Potency" },
                            { name: "Physical Critical Chance", value: "Physical Critical Chance" },
                            { name: "Physical Damage", value: "Physical Damage" },
                            { name: "Special Critical Chance", value: "Special Critical Chance" },
                            { name: "Special Damage", value: "Special Damage" },
                            { name: "Critical Damage", value: "Critical Damage" },
                            { name: "Tenacity", value: "Tenacity" },
                            { name: "Accuracy", value: "Accuracy" },
                            { name: "Armor", value: "Armor" },
                            { name: "Resistance", value: "Resistance" },
                        ],
                    },
                    // INTEGER: top, rarity/ stars
                    {
                        name: "top",
                        description: "View only the top x in the list (1-50)",
                        type: ApplicationCommandOptionType.Integer,
                        minValue: 0,
                        maxValue: 50,
                    },
                    {
                        name: "rarity",
                        description: "View only X rarity (Star lvl) and above. (1-7)",
                        type: ApplicationCommandOptionType.Integer,
                        minValue: 0,
                        maxValue: 7,
                    },
                    // BOOL: reverse, zetas
                    {
                        name: "reverse",
                        description: "Reverse the sort order",
                        type: ApplicationCommandOptionType.Boolean,
                    },
                    {
                        name: "omicrons",
                        description: "Show only results that have omicron'd abilities",
                        type: ApplicationCommandOptionType.Boolean,
                    },
                    {
                        name: "zetas",
                        description: "Show only results that have zeta'd abilities",
                        type: ApplicationCommandOptionType.Boolean,
                    },
                ],
            },
            {
                name: "ship",
                description: "Look for your guild's stats on a ship.",
                type: ApplicationCommandOptionType.Subcommand,
                options: [
                    {
                        name: "ship",
                        autocomplete: true,
                        description: "The ship you want to display",
                        type: ApplicationCommandOptionType.String,
                        required: true,
                    },
                    {
                        name: "allycode",
                        description: "An ally code to determine which guild you're wanting to look up",
                        type: ApplicationCommandOptionType.String,
                    },
                    {
                        name: "sort",
                        description: "Choose what to sort by",
                        type: ApplicationCommandOptionType.String,
                        choices: [
                            { name: "GP", value: "gp" },
                            { name: "Name", value: "name" },
                            { name: "Rarity", value: "rarity" },
                        ],
                    },
                    // INTEGER: top, rarity/ stars
                    {
                        name: "top",
                        description: "View only the top x in the list (1-50)",
                        type: ApplicationCommandOptionType.Integer,
                        minValue: 0,
                        maxValue: 50,
                    },
                    {
                        name: "rarity",
                        description: "View only X rarity (Star lvl) and above. (1-7)",
                        type: ApplicationCommandOptionType.Integer,
                        minValue: 0,
                        maxValue: 7,
                    },
                    // BOOL: reverse
                    {
                        name: "reverse",
                        description: "Reverse the sort order",
                        type: ApplicationCommandOptionType.Boolean,
                    },
                ],
            },
        ],
    };
    constructor() {
        super(GuildSearch.metadata);
    }

    async run({ interaction, language }: CommandContext) {
        const searchType = interaction.options.getSubcommand();

        // Get all the string options
        const sort = interaction.options.getString("sort");
        const stat = interaction.options.getString("stat");
        const ac = interaction.options.getString("allycode");

        // If an ally code is supplied, try using it
        // If not, it'll try grabbing the primary registered code of the author
        const allyCode = await getAllyCode(interaction, ac, true);

        if (!allyCode) {
            return super.error(interaction, language.get("BASE_INVALID_ALLY_CODE"));
        }

        // Get the integer options
        const top = interaction.options.getInteger("top");
        const starLvl = interaction.options.getInteger("rarity") || 0;
        const rangeError = integerOptionError(top, starLvl);
        if (rangeError) {
            return super.error(interaction, language.get(rangeError));
        }

        // Get the boolean options
        const doReverse = interaction.options.getBoolean("reverse");
        const doZeta = interaction.options.getBoolean("zetas");
        const doOmicron = interaction.options.getBoolean("omicrons");

        await interaction.reply({ content: language.get("COMMAND_GUILDSEARCH_PLEASE_WAIT") });
        const cooldown = await patreonFuncs.getPlayerCooldown(interaction.user.id, interaction?.guild?.id);

        const isShip = searchType !== "character";
        const searchStr = interaction.options.getString(isShip ? "ship" : "character");
        const unitList: BotUnit[] | null = isShip ? findChar(searchStr ?? "", ships, true) : findChar(searchStr ?? "", characters);

        if (!unitList?.length) {
            // No character found, so error
            return super.error(interaction, language.get("BASE_SWGOH_NO_CHAR_FOUND", searchStr ?? ""));
        }
        if (unitList.length > 1) {
            return super.error(interaction, language.get("BASE_SWGOH_CHAR_LIST_ASCIIDOC", charListFromSearch(unitList)));
        }

        // If there's just one match, use it
        const foundUnit = unitList[0];

        const guildRes = await this.fetchGuild(interaction, language, allyCode, cooldown);
        if (!guildRes) return;
        const { guild } = guildRes;

        if (!guild?.roster?.length) {
            return interaction.editReply({ content: language.get("BASE_SWGOH_NO_GUILD") });
        }
        await interaction.editReply({ content: `Found guild \`${guild.name}\`!\n*Processing...*` });

        const guildChar = await this.fetchGuildUnits(interaction, language, guild, foundUnit, cooldown);
        if (!guildChar) return;

        if (stat) {
            return this.sendStatResults(interaction, language, { guild, guildChar, foundUnit, stat, top, doReverse });
        }
        return this.sendRosterResults(interaction, language, {
            guild,
            guildChar,
            foundUnit,
            isShip,
            sort,
            top,
            starLvl,
            doReverse,
            doZeta,
            doOmicron,
        });
    }

    // Resolves to null once the failure has been reported, so the caller only has to stop
    private async fetchGuild(
        interaction: ChatInputCommandInteraction,
        language: Language,
        allyCode: number,
        cooldown: PlayerCooldown,
    ): Promise<{ guild: SWAPIGuild | null } | null> {
        try {
            return { guild: await swgohAPI.guild(allyCode, cooldown) };
        } catch (e) {
            if (String(e).indexOf("player is not in a guild") > -1) {
                await super.error(interaction, language.get("COMMAND_GUILDSEARCH_NOT_IN_GUILD"));
                return null;
            }
            logger.error(`[GuildSearch] Failed to get guild: ${e instanceof Error ? e.message : String(e)}`);
            await super.error(interaction, e instanceof SwapiUserError ? e.message : language.get("BASE_SWGOH_GUILD_FETCH_FAILED"), {
                title: "Something Broke while getting your guild's roster",
            });
            return null;
        }
    }

    private async fetchGuildUnits(
        interaction: ChatInputCommandInteraction,
        language: Language,
        guild: SWAPIGuild,
        foundUnit: BotUnit,
        cooldown: PlayerCooldown,
    ): Promise<SWAPIUnit[] | null> {
        const guildAllycodes = guild.roster.map((p) => p.allyCode).filter((c): c is number => c != null);
        try {
            return await swgohAPI.guildUnitStats(guildAllycodes, foundUnit.uniqueName, cooldown);
        } catch (e) {
            logger.error(`[GuildSearch] Failed to get guild units: ${e instanceof Error ? e.message : String(e)}`);
            await super.error(interaction, language.get("BASE_SWGOH_GUILD_FETCH_FAILED"), {
                title: "Something Broke while getting your guild's characters",
                footer: "Please try again in a bit",
            });
            return null;
        }
    }

    private async sendStatResults(interaction: ChatInputCommandInteraction, language: Language, search: StatSearch) {
        const { guild, foundUnit, stat, doReverse } = search;
        const outArr = statRows(search.guildChar, stat as keyof SWAPIUnitStatTypes, search.top, doReverse);
        const fields = statFields(outArr, foundUnit, stat, doReverse, language);

        const footerStr = updatedFooterStr(guild.updatedAt, language);
        const embed = {
            author: {
                name: guild.name,
            },
            fields: [...fields, { name: constants.zws, value: footerStr }],
        };
        try {
            await interaction.editReply({ content: null, embeds: [embed] });
        } catch (err) {
            logger.error(`ERROR(GuildSearch) ${err}`);
            if (interaction.channel?.isSendable()) {
                try {
                    await interaction.channel.send({ embeds: [embed] });
                } catch (channelErr) {
                    logger.error(`ERROR(GuildSearch) Failed to send to channel: ${channelErr}`);
                }
            }
        }
    }

    private async sendRosterResults(interaction: ChatInputCommandInteraction, language: Language, search: RosterSearch) {
        const { guild, guildChar, foundUnit } = search;
        // Not looking for stat info
        const sortType = search.sort ? search.sort : search.top ? "gp" : "name";

        const emptyDescription = emptyRosterDescription(search, language);
        if (emptyDescription) {
            const footerStr = updatedFooterStr(guild.updatedAt, language);
            return super.error(interaction, emptyDescription, {
                title: language.get("BASE_SWGOH_NAMECHAR_HEADER", guild.name, foundUnit.name),
                footer: footerStr,
            });
        }

        const totalUnlocked = guildChar.filter((c) => c.rarity > 0).length;

        let apiChar: RawCharacter;
        try {
            apiChar = await swgohAPI.getCharacter(foundUnit.uniqueName);
        } catch (e) {
            return super.error(interaction, `Couldn't get the character - ${e}`);
        }
        const columns = abilityColumns(apiChar, guildChar);

        const sortedGuild = takeTop(sortRoster(guildChar, sortType), search.top, search.doReverse);
        const charOut = groupRosterRows(sortedGuild, columns, search);
        const fields = [...rosterFields(charOut, search, language), ...rosterWarningFields(guild)];

        for (const f of fields) {
            if (f.value.length > 1000) {
                f.value = `${f.value.slice(0, 1000)}...`;
            }
        }

        const maxUpdated = new Date(Math.max(...guildChar.map((ch) => ch.updatedAt?.getTime() ?? Number.NEGATIVE_INFINITY)));
        const footerStr = updatedFooterStr(maxUpdated, language);
        try {
            interaction.editReply({
                content: null,
                embeds: [
                    {
                        author: {
                            name: language.get("BASE_SWGOH_NAMECHAR_HEADER_NUM", guild.name, foundUnit.name, totalUnlocked),
                        },
                        description: searchDescription(search.doZeta, search.doOmicron),
                        fields: [...fields, { name: constants.zws, value: footerStr }],
                    },
                ],
            });
        } catch (e) {
            logger.error(`Error sending message in guildsearch - ${e}`);
            logger.error(fields);
        }
    }
}

type PlayerCooldown = Awaited<ReturnType<typeof patreonFuncs.getPlayerCooldown>>;

interface StatSearch {
    guild: SWAPIGuild;
    guildChar: SWAPIUnit[];
    foundUnit: BotUnit;
    stat: string;
    top: number | null;
    doReverse: boolean | null;
}

interface RosterSearch {
    guild: SWAPIGuild;
    guildChar: SWAPIUnit[];
    foundUnit: BotUnit;
    isShip: boolean;
    sort: string | null;
    top: number | null;
    starLvl: number;
    doReverse: boolean | null;
    doZeta: boolean | null;
    doOmicron: boolean | null;
}

interface AbilityColumns {
    zetas: string[];
    omicrons: string[];
    maxZ: number;
    hasUlt: boolean;
}

const rarityMap = {
    ONESTAR: 1,
    TWOSTAR: 2,
    THREESTAR: 3,
    FOURSTAR: 4,
    FIVESTAR: 5,
    SIXSTAR: 6,
    SEVENSTAR: 7,
};

const checkableStats = {
    Health: { short: "HP" },
    Protection: { short: "Prot" },
    Speed: { short: "Spd" },
    Potency: { short: "Pot" },
    "Physical Critical Chance": { short: "CC" },
    "Physical Damage": { short: "PD" },
    "Special Critical Chance": { short: "CC" },
    "Special Damage": { short: "SD" },
    "Critical Damage": { short: "CD" },
    Tenacity: { short: "Ten" },
    Accuracy: { short: "Acc" },
    Armor: { short: "Arm" },
    Resistance: { short: "Res" },
};

function statRows(guildChar: SWAPIUnit[], statKey: keyof SWAPIUnitStatTypes, top: number | null, doReverse: boolean | null) {
    const outArr: Record<string, string | number>[] = [];
    let sortedMembers = guildChar
        .filter((gChar) => gChar?.gp)
        .sort((a, b) => {
            if (!a.stats?.final) return -1;
            if (!b.stats?.final) return 1;
            if (!a.stats.final[statKey]) a.stats.final[statKey] = 0;
            if (!b.stats.final[statKey]) b.stats.final[statKey] = 0;
            return a.stats.final[statKey] < b.stats.final[statKey] ? 1 : -1;
        });

    if (top) {
        const start = doReverse ? sortedMembers.length - top : 0;
        const end = doReverse ? sortedMembers.length : top;
        sortedMembers = sortedMembers.slice(start, end);
        if (doReverse) {
            sortedMembers = sortedMembers.reverse();
        }
    }

    for (const member of sortedMembers) {
        if (!member.stats?.final) {
            continue;
        }
        outArr.push({
            ...formatStats(member.stats.final),
            player: member.player ?? "",
            gp: member.gp ? member.gp.toLocaleString() : 0,
            gear: member.gear,
        });
    }
    return outArr;
}

function formatStats(finalStats: Partial<SWAPIUnitStatTypes>): Record<string, string | number> {
    const stats: Record<string, string | number> = {
        Protection: "N/A",
    };
    for (const s of Object.keys(finalStats)) {
        const val = finalStats[s as keyof SWAPIUnitStatTypes] ?? 0;
        if (val % 1 !== 0) {
            stats[s] = `${(val * 100).toFixed(2)}%`;
        } else {
            stats[s] = val ? val.toLocaleString() : "N/A";
        }
    }
    return stats;
}

function statFields(
    outArr: Record<string, string | number>[],
    foundUnit: BotUnit,
    stat: string,
    doReverse: boolean | null,
    language: Language,
): APIEmbedField[] {
    if (!outArr.length) {
        return [
            {
                name: foundUnit.name,
                value: language.get("COMMAND_GUILDSEARCH_NO_CHARACTER"),
            },
        ];
    }

    const header = {
        gear: { value: "⚙", startWith: "`[", endWith: "|", align: "right" },
        gp: { value: "GP", endWith: "|", align: "right" },
    };
    (header as Record<string, { value: string; startWith?: string; endWith: string; align: string }>)[stat] = {
        value: checkableStats[stat as keyof typeof checkableStats].short,
        endWith: "]`",
        align: "right",
    };
    const outHeader = { ...header, player: { value: "", align: "left" } };

    const outTable = makeTable(outHeader, outArr);
    if (!outTable.length) {
        return [
            {
                name: "-",
                value: language.get("BASE_SWGOH_GUILD_LOCKED_CHAR"),
            },
        ];
    }
    return msgArray(outTable, "\n", 700).map((m, ix) => ({
        name:
            ix === 0
                ? language.get("COMMAND_GUILDSEARCH_SORTED_BY", foundUnit.name, stat, doReverse ?? false)
                : language.get("BASE_CONT_STRING"),
        value: m,
    }));
}

function emptyRosterDescription({ guildChar, starLvl, doZeta, isShip }: RosterSearch, language: Language): string | null {
    const noZetas = doZeta && !guildChar.filter((c) => (c.zetas?.length ?? 0) > 0).length;
    const noneAtStar = starLvl > 0 && !guildChar.filter((c) => c.rarity >= starLvl).length;
    if (guildChar?.length && !noneAtStar && !noZetas) return null;

    // Go through, and if there's an error, spit it out
    if (noZetas) return language.get("COMMAND_GUILDSEARCH_NO_ZETAS");
    if (isShip && starLvl > 0) return language.get("COMMAND_GUILDSEARCH_NO_SHIP_STAR", starLvl);
    if (starLvl > 0) return language.get("COMMAND_GUILDSEARCH_NO_CHARACTER_STAR", starLvl);
    if (isShip) return language.get("COMMAND_GUILDSEARCH_NO_SHIP");
    return language.get("COMMAND_GUILDSEARCH_NO_CHARACTER");
}

// Can get the order from abilities table => skillReferenceList
function abilityColumns(apiChar: RawCharacter, guildChar: SWAPIUnit[]): AbilityColumns {
    const zetas: string[] = [];
    const omicrons: string[] = [];
    for (const ab of apiChar.skillReferenceList) {
        if (ab.isZeta) zetas.push(ab.skillId);
        if (ab.isOmicron) omicrons.push(ab.skillId);
    }
    return { zetas, omicrons, maxZ: zetas.length, hasUlt: !!guildChar.find((ch) => ch?.purchasedAbilityId?.length) };
}

function sortRoster(guildChar: SWAPIUnit[], sortType: string): SWAPIUnit[] {
    if (sortType === "name") {
        // Sort by name
        return guildChar.sort((p, c) => ((p.player ?? "").toLowerCase() > (c.player ?? "").toLowerCase() ? 1 : -1));
    }
    if (sortType === "gp") {
        // Sort by the GP
        return guildChar.sort((p, c) => ((p.gp ?? 0) > (c.gp ?? 0) ? 1 : -1));
    }
    if (sortType === "gear") {
        // Sort by the gear
        return guildChar.sort((p, c) => {
            if (p.gear === c.gear) {
                // If they're the same gear level, sort it by how many extra pieces they have attached
                return p.equipped?.length > c.equipped?.length ? 1 : -1;
            }
            // If they're different gear levels, it's easy
            return p.gear > c.gear ? 1 : -1;
        });
    }
    return [];
}

function takeTop(sortedGuild: SWAPIUnit[], top: number | null, doReverse: boolean | null): SWAPIUnit[] {
    let out = sortedGuild;
    if (top) {
        const start = !doReverse ? out.length - top : 0;
        const end = !doReverse ? out.length : top;
        out = out.slice(start, end);
    }
    return doReverse ? out.reverse() : out;
}

function groupRosterRows(sortedGuild: SWAPIUnit[], columns: AbilityColumns, search: RosterSearch): Record<string, string[]> {
    const { doZeta, doOmicron } = search;
    const charOut: Record<string, string[]> = {};
    const hasRelic = sortedGuild.filter((mem) => (mem?.relic?.currentTier ?? 0) > 2).length;
    const maxGP = Math.max(...sortedGuild.map((ch) => ch.gp?.toLocaleString().length || 0));
    for (const member of sortedGuild) {
        // If we want just zeta, just omicron, or both, and the player doesn't have a viable character, move along
        if (doZeta && doOmicron && !member.zetas?.length && !member.omicrons?.length) continue;
        if (doZeta && !doOmicron && !member.zetas?.length) continue;
        if (doOmicron && !doZeta && !member.omicrons?.length) continue;

        if (Number.isNaN(member.rarity)) member.rarity = rarityMap[member.rarity as unknown as keyof typeof rarityMap];

        const uStr = expandSpaces(formatRosterRow(member, columns, { hasRelic, maxGP, isShip: search.isShip }));
        if (!charOut[member.rarity]) {
            charOut[member.rarity] = [uStr];
        } else {
            charOut[member.rarity].push(uStr);
        }
    }
    return charOut;
}

function formatRosterRow(
    member: SWAPIUnit,
    { zetas, omicrons, maxZ, hasUlt }: AbilityColumns,
    { hasRelic, maxGP, isShip }: { hasRelic: number; maxGP: number; isShip: boolean },
): string {
    if (!(member.rarity > 0)) return member.player ?? "";

    const marks = abilityMarks(member, { zetas, omicrons, maxZ, hasUlt });
    const gpStr = (member.gp ?? 0).toLocaleString();

    if (isShip) {
        return `**\`[Lvl ${member.level.toString().padStart(2)} | ${gpStr.padStart(maxGP)}${maxZ > 0 ? ` | ${marks}` : ""}]\`** ${member.player}`;
    }
    const gearStr = getGearStr(member, "⚙").padEnd(hasRelic ? 5 : 3);
    return `**\`[${gearStr} | ${gpStr.padStart(maxGP)}${marks.length ? ` | ${marks}` : ""}]\`** ${member.player}`;
}

function abilityMarks(member: SWAPIUnit, { zetas, omicrons, hasUlt }: AbilityColumns): string {
    let marks = "";
    if (hasUlt) {
        marks += member.purchasedAbilityId?.length ? "u" : " ";
    }
    for (const [ix, zeta] of zetas.entries()) {
        marks += member.zetas?.find((pz) => pz.id === zeta) ? (ix + 1).toString() : " ";
    }
    for (const [ix, omicron] of omicrons.entries()) {
        marks += member.omicrons?.find((po) => po.id === omicron) ? (ix + 1).toString() : " ";
    }
    return marks;
}

function integerOptionError(top: number | null, starLvl: number): string | null {
    if (top && (Number.isNaN(top) || top <= 0 || top > 50)) return "COMMAND_GUILDSEARCH_INVALID_TOP";
    if (starLvl < 0 || starLvl > 7) return "COMMAND_GUILDSEARCH_BAD_STAR";
    return null;
}

function rosterFields(charOut: Record<string, string[]>, { starLvl, doReverse }: RosterSearch, language: Language): APIEmbedField[] {
    const fields: APIEmbedField[] = [];
    const outArr = doReverse ? Object.keys(charOut).reverse() : Object.keys(charOut);

    for (const star of outArr) {
        if (Number.parseInt(star, 10) < starLvl) continue;
        const msgArr = msgArray(charOut[star], "\n", 700);
        for (const [ix, msg] of msgArr.entries()) {
            const name =
                Number.parseInt(star, 10) === 0
                    ? language.get("COMMAND_GUILDSEARCH_NOT_ACTIVATED", charOut[star].length)
                    : language.get("COMMAND_GUILDSEARCH_STAR_HEADER", star, charOut[star].length);
            fields.push({
                name: msgArr.length > 1 ? `${name} (${ix + 1}/${msgArr.length})` : name,
                value: msg,
            });
        }
    }
    return fields;
}

function rosterWarningFields(guild: SWAPIGuild): APIEmbedField[] {
    if (!guild.warnings) return [];
    let warn = guild.warnings.join("\n");
    if (warn.length > 1024) {
        warn = `${warn.slice(0, 1000)}...`;
    }
    return [
        {
            name: "Guild Roster Warnings",
            value: warn,
        },
    ];
}

function searchDescription(doZeta: boolean | null, doOmicron: boolean | null): string | undefined {
    if (doZeta && doOmicron) return "Showing characters with both Zeta(s) & Omicron(s)";
    if (doZeta) return "Showing characters with Zeta(s)";
    if (doOmicron) return "Showing characters with Omicron(s)";
    return undefined;
}
