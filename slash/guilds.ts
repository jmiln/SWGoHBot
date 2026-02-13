import { ApplicationCommandOptionType, codeBlock, InteractionContextType } from "discord.js";
import Command from "../base/slashCommand.ts";
import constants from "../data/constants/constants.ts";
import { characters, raidNames, ships } from "../data/constants/units.ts";
import {
    expandSpaces,
    formatDuration,
    getAllyCode,
    makeTable,
    msgArray,
    shortenNum,
    summarizeCharLevels,
    toProperCase,
    updatedFooterStr,
} from "../modules/functions.ts";
import { getGuildSettings } from "../modules/guildConfig/settings.ts";
import { getFullTWList } from "../modules/guildConfig/twlist.ts";
import logger from "../modules/Logger.ts";
import patreonFuncs from "../modules/patreonFuncs.ts";
import swgohAPI from "../modules/swapi.ts";
import userReg from "../modules/users.ts";
import type { RawGuild, SWAPIGuild, SWAPIGuildMember, SWAPIPlayer } from "../types/swapi_types.ts";
import type { CommandContext, TWList } from "../types/types.ts";

export default class Guilds extends Command {
    static readonly metadata = {
        name: "guilds",
        category: "Gamedata",
        description: "View information about a specified guild",
        guildOnly: false,
        contexts: [InteractionContextType.Guild, InteractionContextType.BotDM],
        usage: [
            "**gear** [allycode] [sort]",
            "**mods** [allycode] [sort]",
            "**relics** [allycode]",
            "**roster** [allycode] [registered]",
            "  [show_allycode] [sort] [show_side]",
            "  [split_types]",
            "**tickets** [allycode] [sort]",
            "**twsummary** [allycode] [expand]",
            "**view** [allycode]",
        ],
        options: [
            {
                name: "gear",
                description: "Show an overview of the guild's gear levels",
                type: ApplicationCommandOptionType.Subcommand,
                options: [
                    {
                        name: "allycode",
                        description: "The ally code of the guild you want to check.",
                        type: ApplicationCommandOptionType.String,
                        autocomplete: true,
                    },
                    {
                        name: "sort",
                        description: "Which gear level you'd like it sorted by (9-13)",
                        type: ApplicationCommandOptionType.Integer,
                        minValue: 9,
                        maxValue: 13,
                    },
                ],
            },
            {
                name: "mods",
                description: "Show an overview of the guild's mod stats",
                type: ApplicationCommandOptionType.Subcommand,
                options: [
                    {
                        name: "allycode",
                        description: "The ally code of the guild you want to check.",
                        type: ApplicationCommandOptionType.String,
                        autocomplete: true,
                    },
                    {
                        name: "sort",
                        description: "Choose how you want the results sorted",
                        type: ApplicationCommandOptionType.String,
                        choices: [
                            {
                                name: "name",
                                value: "name",
                            },
                            {
                                name: "offense",
                                value: "offense",
                            },
                            {
                                name: "six pip/ 6*",
                                value: "6",
                            },
                            {
                                name: "speed",
                                value: "speed",
                            },
                        ],
                    },
                ],
            },
            {
                name: "relics",
                description: "Show an overview of the guild's relic counts",
                type: ApplicationCommandOptionType.Subcommand,
                options: [
                    {
                        name: "allycode",
                        description: "The ally code of the guild you want to check.",
                        type: ApplicationCommandOptionType.String,
                        autocomplete: true,
                    },
                ],
            },
            {
                name: "roster",
                description: "View the guild's roster, showing ally codes, gp, etc.",
                type: ApplicationCommandOptionType.Subcommand,
                options: [
                    {
                        name: "allycode",
                        description: "The ally code of the guild you want to check.",
                        type: ApplicationCommandOptionType.String,
                        autocomplete: true,
                    },
                    {
                        name: "registered",
                        description: "Show the discord names of anyone registered & on the server next to their name.",
                        type: ApplicationCommandOptionType.Boolean,
                    },
                    {
                        name: "show_allycode",
                        description: "Show user's ally codes instead of their gp",
                        type: ApplicationCommandOptionType.Boolean,
                    },
                    {
                        name: "sort",
                        description: "Choose what the list is sorted by.",
                        type: ApplicationCommandOptionType.String,
                        choices: [
                            {
                                name: "name",
                                value: "name",
                            },
                            {
                                name: "rank",
                                value: "rank",
                            },
                            {
                                name: "gp",
                                value: "gp",
                            },
                        ],
                    },
                    {
                        name: "show_side",
                        description: "Display just light side or dark side GP",
                        type: ApplicationCommandOptionType.String,
                        choices: [
                            {
                                name: "Light Side",
                                value: "light",
                            },
                            {
                                name: "Dark Side",
                                value: "dark",
                            },
                        ],
                    },
                    {
                        name: "split_types",
                        description: "Display chacters and ships as different columns",
                        type: ApplicationCommandOptionType.Boolean,
                    },
                ],
            },
            {
                name: "tickets",
                description: "Show how many event tickets each guild member has aquired for the day",
                type: ApplicationCommandOptionType.Subcommand,
                options: [
                    {
                        name: "allycode",
                        description: "The ally code of the guild you want to check.",
                        type: ApplicationCommandOptionType.String,
                        autocomplete: true,
                    },
                    {
                        name: "sort",
                        description: "Choose what the list is sorted by.",
                        type: ApplicationCommandOptionType.String,
                        choices: [
                            {
                                name: "tickets",
                                value: "tickets",
                            },
                            {
                                name: "name",
                                value: "name",
                            },
                        ],
                    },
                    {
                        name: "show_all",
                        description: "Show all members, or just the ones that need more tickets",
                        type: ApplicationCommandOptionType.Boolean,
                    },
                ],
            },
            {
                name: "tw_summary",
                description: "Show an overview of stats for your guild that could be useful for territory wars",
                type: ApplicationCommandOptionType.Subcommand,
                options: [
                    {
                        name: "allycode",
                        description: "The ally code of the guild you want to check.",
                        type: ApplicationCommandOptionType.String,
                        autocomplete: true,
                    },
                    {
                        name: "expand",
                        description: "Expand some of the fields to show all options",
                        type: ApplicationCommandOptionType.Boolean,
                    },
                ],
            },
            {
                name: "view",
                description: "Show an overview of the guild's stats",
                type: ApplicationCommandOptionType.Subcommand,
                options: [
                    {
                        name: "allycode",
                        description: "The ally code of the guild you want to check.",
                        type: ApplicationCommandOptionType.String,
                        autocomplete: true,
                    },
                ],
            },
        ],
    };
    constructor() {
        super(Guilds.metadata);
    }

    async run({ interaction, language }: CommandContext) {
        await interaction.reply({ content: language.get("COMMAND_GUILDS_PLEASE_WAIT") as string });

        const subCommand = interaction.options.getSubcommand();
        if (!subCommand) {
            logger.error("[slash/guilds] Somehow missing subCommand");
            return;
        }

        const allycode = interaction.options.getString("allycode");
        const showSide = interaction.options.getString("show_side");
        const userAC = await getAllyCode(interaction, allycode, true);

        // If it hasn't found a valid ally code, grumble at the user, since that's required
        if (!userAC) {
            return super.error(
                interaction,
                "No valid ally code found. Please make sure that you have a registered ally code via the `userconf` command, or have entered a valid ally code",
            );
        }

        const cooldown = await patreonFuncs.getPlayerCooldown(interaction.user.id, interaction?.guild?.id);
        const guildConf = await getGuildSettings({ guildId: interaction.guild?.id || null });

        // Take care of the tickets now if needed, since it doesn't need bits ahead
        if (subCommand === "tickets") {
            const user = await userReg.getUser(interaction.user.id);
            const showAll = interaction.options.getBoolean("show_all") || false;
            const maxTickets = user?.guildTickets?.tickets || 600;
            return await guildTickets(Number.parseInt(userAC, 10), maxTickets, showAll);
        }

        let guild: SWAPIGuild;
        try {
            // Grab the guild's info from the DB
            guild = await swgohAPI.guild(Number.parseInt(userAC, 10), cooldown);

            // Filter out any members that aren't in the guild
            guild.roster = guild.roster.filter((mem: SWAPIGuildMember) => mem.guildMemberLevel > 1);

            // Filter out members with null allycodes (failed to fetch from API)
            const oldLen = guild.roster.length;
            guild.roster = guild.roster.filter((m) => m.allyCode !== null);
            if (guild.roster.length !== oldLen) {
                logger.log(`[Guilds] Filtered ${oldLen - guild.roster.length} members with null allycodes`);
            }
        } catch (e) {
            const errorMessage = e instanceof Error ? e.message : String(e);
            logger.error(`[Guilds] Failed to get guild: ${errorMessage}`);
            return super.error(
                interaction,
                "Sorry, I couldn't fetch guild data right now. Please make sure you have a valid ally code and try again later.",
            );
        }

        if (!guild) {
            return super.error(interaction, `Couldn't get guild. ${language.get("COMMAND_GUILDS_NO_GUILD")}`);
        }

        // Switch out depending on the subcommand
        switch (subCommand) {
            case "gear": {
                // Gear Overview
                try {
                    return await guildGear();
                } catch (err) {
                    const errorMessage = err instanceof Error ? err.message : String(err);
                    return super.error(interaction, `Issue with guildGear: ${errorMessage}`);
                }
            }
            case "mods": {
                // Mods overview
                try {
                    return await guildMods();
                } catch (err) {
                    const errorMessage = err instanceof Error ? err.message : String(err);
                    return super.error(interaction, `Issue with guildMods: ${errorMessage}`);
                }
            }
            case "relics": {
                // Relics overview
                try {
                    return await guildRelics();
                } catch (err) {
                    const errorMessage = err instanceof Error ? err.message : String(err);
                    return super.error(interaction, `Issue with guildRelics: ${errorMessage}`);
                }
            }
            case "roster": {
                // Display the roster with gp etc
                try {
                    if (!showSide) {
                        try {
                            return await guildRoster();
                        } catch (err) {
                            const errorMessage = err instanceof Error ? err.message : String(err);
                            logger.error(`[slash/guilds] guildRoster error: ${errorMessage}`);
                            return super.error(interaction, `Issue with guildRoster: ${errorMessage}`);
                        }
                    } else {
                        return await guildSidedGP();
                    }
                } catch (err) {
                    const errorMessage = err instanceof Error ? err.message : String(err);
                    return super.error(interaction, `Issue with guildRoster 2: ${errorMessage}`);
                }
            }
            case "tw_summary": {
                // Spit out a general summary of guild characters and such related to tw
                try {
                    return await twSummary();
                } catch (err) {
                    const errorMessage = err instanceof Error ? err.message : String(err);
                    return super.error(interaction, `Issue with twSummary: ${errorMessage}`);
                }
            }
            default: {
                // Show basic stats/ info about the guild
                await baseGuild();
            }
        }

        async function guildGear() {
            // List an overview of the guild's upper geared characters
            const gears = [10, 11, 12, 13];
            const sortBy = interaction.options.getInteger("sort");
            if (sortBy && (sortBy > 13 || sortBy < 9)) {
                return interaction.editReply({
                    content: language.get("COMMAND_GUILDSEARCH_INVALID_SORT", gears.join(",")) as string,
                });
            }
            const gRoster = guild.roster.sort((a, b) => (a.name.toLowerCase() > b.name.toLowerCase() ? 1 : -1)).map((m) => m.allyCode);

            if (!gRoster.length) {
                return interaction.editReply({ content: "I can't find any players in the requested guild." });
            }
            let guildGG: SWAPIPlayer[];
            try {
                guildGG = await swgohAPI.unitStats(gRoster, cooldown);
            } catch (e) {
                const errorMessage = e instanceof Error ? e.message : String(e);
                logger.error(`ERROR(GS_GEAR) getting guild (${guild.id}): ${errorMessage}`);
                return interaction.editReply({
                    content: null,
                    embeds: [
                        {
                            description: codeBlock(errorMessage),
                            title: "Something Broke while getting your guild's characters",
                            footer: { text: "Please try again in a bit" },
                            color: constants.colors.red,
                        },
                    ],
                });
            }

            const gearOut = {};

            for (const player of guildGG) {
                if (!player.roster) continue;
                for (const char of player.roster) {
                    gearOut[player.name] = gearOut[player.name] || {};
                    if (char.gear < 10) continue;
                    if (gearOut[player.name][char.gear]) {
                        gearOut[player.name][char.gear] += 1;
                    } else {
                        gearOut[player.name][char.gear] = 1;
                    }
                }
            }

            let tableIn = Object.keys(gearOut).map((k) => {
                return {
                    10: gearOut[k][10] || 0,
                    11: gearOut[k][11] || 0,
                    12: gearOut[k][12] || 0,
                    13: gearOut[k][13] || 0,
                    name: k,
                };
            });

            if (sortBy) {
                tableIn = tableIn.sort((a, b) => (a[sortBy] < b[sortBy] ? 1 : -1));
            } else {
                tableIn = tableIn.sort((a, b) => (a.name.toLowerCase() > b.name.toLowerCase() ? 1 : -1));
            }

            const tableFormat = {
                10: { value: "g10", startWith: "`[", endWith: "|", align: "right" },
                11: { value: "g11", endWith: "|", align: "right" },
                12: { value: "g12", endWith: "|", align: "right" },
                13: { value: "g13", endWith: "]`", align: "right" },
                name: { value: "", align: "left" },
            };

            const tableOut = makeTable(tableFormat, tableIn);
            return interaction.editReply({
                content: null,
                embeds: [
                    {
                        author: {
                            name: `${guild.name} ${language.get("COMMAND_GUILDSEARCH_GEAR_SUM")}`,
                        },
                        description: tableOut.length ? tableOut.join("\n") : "No users found in guild",
                        fields: [
                            {
                                name: constants.zws,
                                value: updatedFooterStr(guild.updated, language),
                            },
                        ],
                    },
                ],
            });
        }

        async function guildMods() {
            // Give a general overview of important mods (6*, +15, +20 speed, +100 offense?)
            let guildGG: SWAPIPlayer[];
            try {
                guildGG = await swgohAPI.unitStats(
                    guild.roster.map((m) => m.allyCode),
                    cooldown,
                );
            } catch (err) {
                return interaction.editReply({
                    content: null,
                    embeds: [
                        {
                            title: "Something Broke while getting your guild's characters",
                            description: ` ${codeBlock(err)}`,
                            footer: { text: "Please try again in a bit" },
                        },
                    ],
                });
            }
            guildGG = guildGG.sort((a, b) => (a.name.toLowerCase() > b.name.toLowerCase() ? 1 : -1));
            let output = [];
            for (const player of guildGG) {
                const mods = {
                    sixPip: 0,
                    spd15: 0,
                    spd20: 0,
                    off100: 0,
                    name: player.name,
                };

                for (const ch of player.roster) {
                    if (ch.mods) {
                        const six = ch.mods.filter((p) => p.pips === 6);
                        if (six.length) {
                            mods.sixPip += six.length;
                        }
                        for (const m of ch.mods) {
                            const spd = m.secondaryStat.find((s) => (s.unitStat === 5 || s.unitStat === "UNITSTATSPEED") && s.value >= 15);
                            const off = m.secondaryStat.find(
                                (o) => (o.unitStat === 41 || o.unitStat === "UNITSTATOFFENSE") && o.value >= 100,
                            );

                            if (spd) {
                                if (spd.value >= 20) {
                                    mods.spd20 += 1;
                                } else {
                                    mods.spd15 += 1;
                                }
                            }
                            if (off) mods.off100 += 1;
                        }
                    }
                }
                output.push(mods);
            }

            // Sort by speed mods, offense mods, or 6* mods
            const sortBy = interaction.options.getString("sort");
            if (sortBy === "offense") {
                // Sort by # of good offense mods (descending)
                output = output.sort((m, n) => n.off100 - m.off100);
            } else if (sortBy === "speed") {
                // Sort by # of good speed mods (descending)
                output = output.sort((m, n) => n.spd20 - m.spd20);
            } else if (sortBy === "6") {
                // Sort by # of 6* mods (descending)
                output = output.sort((m, n) => n.sixPip - m.sixPip);
            }

            const table = makeTable(
                {
                    sixPip: { value: "6*", startWith: "`" },
                    spd15: { value: "15+" },
                    spd20: { value: "20+" },
                    off100: { value: "100+", endWith: "`" },
                    name: { value: "", align: "left" },
                },
                output,
            );
            const header = [expandSpaces("`     ┏╸ Spd ┓  Off ┓`")];

            const fields = msgArray(header.concat(table), "\n", 700).map((m) => {
                if (!m?.length) return null;
                return { name: "-", value: m };
            });

            const embed = {
                author: {
                    name: language.get("COMMAND_GUILDSEARCH_MODS_HEADER", guild.name) as string,
                },
                fields: fields,
            };
            try {
                return interaction.editReply({ content: null, embeds: [embed] });
            } catch (err) {
                const errorMessage = err instanceof Error ? err.message : String(err);
                logger.error(`ERROR(Guilds/guildMods) sending embed: ${errorMessage}`);
                if (interaction.channel) {
                    try {
                        return interaction.channel.send({ content: null, embeds: [embed] });
                    } catch (channelErr) {
                        const channelError = channelErr instanceof Error ? channelErr.message : String(channelErr);
                        logger.error(`ERROR(Guilds/guildMods) Failed to send to channel: ${channelError}`);
                    }
                }
            }
        }

        async function guildRelics() {
            const members = [];

            // Make sure the guild roster exists, and grab all the ally codes
            if (!guild || !guild.roster || !guild.roster.length) {
                throw new Error(
                    "I cannot find any players in that guild.\n Please make sure you have the name or ally code correct and try again.",
                );
            }
            interaction.editReply({ content: `Found guild \`${guild.name}\`!` });
            const gRosterCodes = guild.roster.map((m) => m.allyCode);

            // Use the ally codes to get all the other info for the guild
            let guildMembers: SWAPIPlayer[];
            try {
                guildMembers = await swgohAPI.unitStats(gRosterCodes, cooldown);
            } catch (e) {
                const errorMessage = e instanceof Error ? e.message : String(e);
                logger.error(`ERROR(Guilds/guildRelics) getting guild: ${errorMessage}`);
                return interaction.editReply({
                    content: null,
                    embeds: [
                        {
                            title: "Something Broke while getting your guild's characters",
                            description: codeBlock(errorMessage),
                            footer: { text: "Please try again in a bit." },
                        },
                    ],
                });
            }

            for (const member of guildMembers) {
                const memberRoster = {
                    // Just the name
                    name: member.name,

                    // The gear levels
                    g1: 0,
                    g2: 0,
                    g3: 0,
                    g4: 0,
                    g5: 0,
                    g6: 0,
                    g7: 0,
                    g8: 0,
                    g9: 0,
                    g10: 0,
                    g11: 0,
                    g12: 0,

                    // The relics
                    "r0-4": 0,
                    "r5-8": 0,
                    r9: 0,
                    "r10+": 0,
                };
                for (const char of member.roster) {
                    if (char.gear === 13 && char?.relic?.currentTier - 2 >= 0) {
                        // If it's a g13 with a relic, check for the relic
                        const rel = char.relic.currentTier - 2;
                        if (rel <= 4) {
                            memberRoster["r0-4"] += 1;
                        } else if (rel <= 8) {
                            memberRoster["r5-8"] += 1;
                        } else if (rel === 9) {
                            memberRoster.r9 += 1;
                        } else {
                            memberRoster["r10+"] += 1;
                        }
                    } else {
                        // If it's not already there, then stick it in
                        memberRoster[`g${char.gear}`] += 1;
                    }
                }
                members.push(memberRoster);
            }

            // See what the top 4 tiers of gear/ relic are available for these members
            let firstViableTier = null;
            if (members.length === 0) {
                return interaction.editReply({
                    content: null,
                    embeds: [
                        {
                            title: "Error",
                            description: "No member data available to display gear/relic summary.",
                            color: constants.colors.red,
                        },
                    ],
                });
            }
            const tierKeys = Object.keys(members[0]).reverse();
            for (const tier in tierKeys) {
                if (members.filter((mem) => mem[tierKeys[tier]] > 0).length) {
                    firstViableTier = tier;
                    break;
                }
            }

            // Set up the formats for the table maker
            const viableTiers = tierKeys
                .slice(Number.parseInt(firstViableTier || "0", 10), Number.parseInt(firstViableTier || "0", 10) + 4)
                .reverse();
            const tierFormat = {
                [viableTiers[0]]: { value: viableTiers[0], startWith: "`[", endWith: "|", align: "right" },
                [viableTiers[1]]: { value: viableTiers[1], endWith: "|", align: "right" },
                [viableTiers[2]]: { value: viableTiers[2], endWith: "|", align: "right" },
                [viableTiers[3]]: { value: viableTiers[3], endWith: "]`", align: "right" },
                name: { value: "", align: "left" },
            };

            // Format all the output, then send it on
            const memOut = makeTable(
                tierFormat,
                members.sort((a, b) => (a.name.toLowerCase() > b.name.toLowerCase() ? 1 : -1)),
            );

            // Get the totals for each column
            const tierTotals = {
                [viableTiers[0]]: 0,
                [viableTiers[1]]: 0,
                [viableTiers[2]]: 0,
                [viableTiers[3]]: 0,
            };

            const totalsFormat = {
                [viableTiers[0]]: { value: viableTiers[0], startWith: "`[", endWith: "|", align: "right" },
                [viableTiers[1]]: { value: viableTiers[1], endWith: "|", align: "right" },
                [viableTiers[2]]: { value: viableTiers[2], endWith: "|", align: "right" },
                [viableTiers[3]]: { value: viableTiers[3], endWith: "]`", align: "right" },
            };
            for (const member of members) {
                for (const key of Object.keys(tierTotals)) {
                    tierTotals[key] += member[key];
                }
            }
            const totalOut = makeTable(totalsFormat, [tierTotals]);

            // Chunk the info into sections so it'll fit in the embed fields
            const fields = [];
            const fieldVals = msgArray(memOut, "\n", 1000);

            // Stick the formatted bits into the fields
            for (const fieldVal of fieldVals) {
                if (!fieldVal?.length) continue;
                fields.push({
                    name: "-",
                    value: fieldVal,
                });
            }
            fields.push({
                name: "TOTALS",
                value: totalOut.join("\n"),
            });

            // Send the formatted info
            return interaction.editReply({
                content: null,
                embeds: [
                    {
                        title: `${guild.name}'s Gear/ Relic summary`,
                        fields: fields,
                    },
                ],
            });
        }

        async function guildTickets(userAC: number, maxTickets: number, showAll = false) {
            const sortBy = interaction.options.getString("sort");

            let rawGuild: RawGuild;
            try {
                rawGuild = await swgohAPI.getRawGuild(userAC);
            } catch (err) {
                return interaction.editReply({ content: err.toString() });
            }

            if (!rawGuild) return interaction.editReply({ content: `Sorry, but I could not find a guild to match with ${userAC}` });

            const out = [];
            const fullOut = [];
            let roster = null;
            if (sortBy === "tickets") {
                roster = rawGuild.roster.sort((a, b) =>
                    Number.parseInt(a.memberContribution[2]?.currentValue, 10) > Number.parseInt(b.memberContribution[2]?.currentValue, 10)
                        ? 1
                        : -1,
                );
            } else {
                roster = rawGuild.roster.sort((a, b) => (a.playerName.toLowerCase() > b.playerName.toLowerCase() ? 1 : -1));
            }

            const dayMS = 86400000;
            let timeUntilReset = null;
            const chaTime = Number.parseInt(rawGuild.nextChallengesRefresh, 10) * 1000;
            const nowTime = Date.now();
            if (chaTime > nowTime) {
                // It's in the future
                timeUntilReset = formatDuration(chaTime - nowTime, language);
            } else {
                // It's in the past, so calculate the next time
                const dur = chaTime + dayMS - nowTime;
                timeUntilReset = formatDuration(dur, language);
            }

            let maxed = 0;
            for (const member of roster) {
                const tickets = member.memberContribution["2"].currentValue;
                if (tickets < maxTickets) {
                    out.push(expandSpaces(`\`${tickets.toString().padStart(3)}\` - ${`**${member.playerName}**`}`));
                } else {
                    maxed += 1;
                    if (showAll) fullOut.push(expandSpaces(`\`${tickets.toString().padStart(3)}\` - ${`**${member.playerName}**`}`));
                }
            }

            if (fullOut?.length && showAll) {
                out.push("\n**__Members with full tickets:__**");
                out.push(...fullOut);
            }
            const footerStr = updatedFooterStr(rawGuild.updated, language);
            const timeTilString = `***Time until reset: ${timeUntilReset}***\n\n`;
            const maxedString = maxed > 0 ? `**${maxed}** members with ${maxTickets} tickets\n\n` : "";
            return interaction.editReply({
                content: null,
                embeds: [
                    {
                        author: {
                            name: `${rawGuild.profile.name}'s Ticket Counts`,
                        },
                        description: `${timeTilString}${maxedString}${out.join("\n")}\n${footerStr}`,
                    },
                ],
            });
        }

        async function baseGuild() {
            const fields = [];
            let desc = guild.desc ? `**${language.get("COMMAND_GUILDS_DESC")}:**\n\`${guild.desc}\`\n` : "";
            desc += guild.message?.length ? `**${language.get("COMMAND_GUILDS_MSG")}:**\n\`${guild.message}\`` : "";

            const raidHeaderStr = language.get("COMMAND_GUILDS_RAID_HEADER");
            const raidArr = [];
            let raids = "";

            if (guild.raid && Object.keys(guild.raid).length) {
                const localRaidNames: { [key: string]: string } = raidNames[guildConf.swgohLanguage.toLowerCase()];
                const maxRaidLen = Math.max(
                    ...Object.values(localRaidNames)
                        .filter((r) => !!r)
                        .map((r) => r.length),
                );
                for (const r in guild.raid) {
                    let thisRaidName: string;
                    if (localRaidNames[r]) {
                        // Use the localized name from raidNames.json
                        thisRaidName = expandSpaces(toProperCase(localRaidNames[r].padEnd(maxRaidLen + 1, " ")));
                    } else {
                        // Raid not in raidNames.json - format the raw ID nicely as fallback
                        logger.warn(`[slash/guilds] Unknown raid ID: ${r} (not in raidNames.json)`);
                        // Format: "speederbike_v2" -> "Speederbike V2" or "newraid" -> "Newraid"
                        const formatted = r
                            .split("_")
                            .map((part) => toProperCase(part))
                            .join(" ");
                        thisRaidName = expandSpaces(`${formatted}`.padEnd(maxRaidLen + 1, " "));
                    }

                    const raidTier = guild.raid[r]?.diffId.includes("HEROIC")
                        ? toProperCase(localRaidNames.heroic || "Heroic")
                        : guild.raid[r]?.diffId.replace("DIFF0", "T");
                    raidArr.push(`${thisRaidName} | ${raidTier}`);
                }
                raids = raidArr.sort((a, b) => (a.toLowerCase() > b.toLowerCase() ? 1 : -1)).join("\n");
            } else {
                raids = "No raids available";
            }

            if (raids) {
                fields.push({
                    name: raidHeaderStr || "Raids",
                    value: codeBlock(raids) || "N/A",
                    inline: true,
                });
            }

            let guildCharGP = 0;
            let guildShipGP = 0;
            for (const mem of guild.roster) {
                guildCharGP += mem.gpChar;
                guildShipGP += mem.gpShip;
            }
            const stats = language.get(
                "COMMAND_GUILDS_STAT_STRINGS",
                guild.roster.length,
                guild.required,
                guild.gp.toLocaleString(),
                guildCharGP.toLocaleString(),
                guildShipGP.toLocaleString(),
            );
            fields.push({
                name: language.get("COMMAND_GUILDS_STAT_HEADER"),
                value: codeBlock(stats) || "N/A",
                inline: true,
            });

            fields.push({
                name: "-",
                value:
                    language.get("COMMAND_GUILDS_FOOTER") ||
                    "`/guilds roster` for a list of your guild members and their gp.\n`/guilds roster show_allycode: true` for a list with their ally codes instead.",
            });

            if (guild.warnings?.length) {
                fields.push({
                    name: "Warnings",
                    value: guild.warnings.join("\n"),
                });
            }

            const footerStr = updatedFooterStr(guild.updated, language);
            fields.push({
                name: constants.zws,
                value: footerStr,
            });
            return interaction.editReply({
                content: null,
                embeds: [
                    {
                        author: {
                            name: guild.name,
                        },
                        description: desc.length ? desc : "",
                        fields: fields.length ? fields : null,
                    },
                ],
            });
        }

        async function guildSidedGP() {
            const showSide = interaction.options.getString("show_side");
            if (!showSide) {
                throw new Error("You must have a side chosen.");
            }

            // Make sure the guild roster exists, and grab all the ally codes
            if (!guild || !guild.roster || !guild.roster.length) {
                throw new Error(
                    "I cannot find any players in that guild.\n Please make sure you have the name or ally code correct and try again.",
                );
            }
            interaction.editReply({ content: `Found guild \`${guild.name}\`!` });
            const gRosterACs = guild.roster.map((m) => m.allyCode);

            // Use the ally codes to get all the other info for the guild
            let guildMembers: SWAPIPlayer[];
            try {
                guildMembers = await swgohAPI.unitStats(gRosterACs, cooldown);
            } catch (e) {
                const errorMessage = e instanceof Error ? e.message : String(e);
                logger.error(`ERROR(Guilds/guildSidedGP) getting guild: ${errorMessage}`);
                return interaction.editReply({
                    content: null,
                    embeds: [
                        {
                            title: "Something Broke while getting your guild's characters",
                            description: codeBlock(errorMessage),
                            footer: { text: "Please try again in a bit." },
                        },
                    ],
                });
            }

            let charList = [];
            let shipList = [];
            const users = [];
            if (showSide) {
                charList = characters.filter((ch) => ch.side === showSide);
                shipList = ships.filter((ch) => ch.side === showSide);
            }

            guildMembers = guildMembers.sort((a, b) => (a.name.toLowerCase() > b.name.toLowerCase() ? 1 : -1));

            for (const member of guildMembers) {
                // Go through each member's stuff
                if (!member?.roster) continue;

                let shipTotal = 0;
                let charTotal = 0;
                for (const unit of charList) {
                    const thisChar = member.roster.find((ch) => ch.defId === unit.uniqueName);
                    if (!thisChar) continue;
                    charTotal += thisChar.gp;
                }
                for (const unit of shipList) {
                    const thisShip = member.roster.find((ch) => ch.defId === unit.uniqueName);
                    if (!thisShip) continue;
                    shipTotal += thisShip.gp;
                }
                if (member.inGuild) {
                    users.push(
                        `\`[ ${shortenNum(charTotal, 2)} | ${shortenNum(shipTotal, 2)} | ${shortenNum(
                            charTotal + shipTotal,
                        )} ]\` - **${member.name}**`,
                    );
                } else {
                    users.push(
                        `\`[ ${shortenNum(charTotal, 2)} | ${shortenNum(shipTotal, 2)} | ${shortenNum(
                            charTotal + shipTotal,
                        )} ]\` - ${member.name}`,
                    );
                }
            }

            const fields = [];
            const header = "**`[ Char  | Ship  | Total ]`**";
            const msgArr = msgArray([header, ...users], "\n", 1000);
            msgArr.forEach((m, ix) => {
                fields.push({
                    name: language.get("COMMAND_GUILDS_ROSTER_HEADER", ix + 1, msgArr.length),
                    value: m,
                });
            });
            if (guild.warnings) {
                fields.push({
                    name: "Warnings",
                    value: guild.warnings.join("\n"),
                });
            }
            const footerStr = updatedFooterStr(guild.updated, language);
            fields.push({
                name: constants.zws,
                value: footerStr,
            });
            return interaction.editReply({
                content: null,
                embeds: [
                    {
                        author: {
                            name: `${toProperCase(showSide)} side GP`,
                        },
                        fields: fields,
                    },
                ],
            });
        }

        async function guildRoster() {
            const showAC = interaction.options.getBoolean("show_allycode");
            const showReg = interaction.options.getBoolean("registered");
            const sortBy = interaction.options.getString("sort");

            if (!guild?.roster?.length) {
                throw new Error("I cannot find that guild. \nPlease make sure the name or ally code is correct.");
            }

            let sortedGuild: SWAPIGuildMember[];
            if (showAC || (sortBy && ["name", "rank"].includes(sortBy))) {
                // Sort em by name
                sortedGuild = guild.roster.sort((p, c) => (p.name.toLowerCase() > c.name.toLowerCase() ? 1 : -1));
                if (sortBy === "rank") {
                    // Sort em by rank
                    sortedGuild = sortedGuild.sort((p, c) => (p.guildMemberLevel > c.guildMemberLevel ? -1 : 1));
                }
            } else {
                // Sort em by GP
                sortedGuild = guild.roster.sort((p, c) => c.gp - p.gp);
            }

            let badCount = 0;
            const gRanks = {
                2: "M", // Member
                3: "O", // Officer
                4: "L", // Leader
            };
            for (const p of sortedGuild) {
                // If there's a missing ally code, add to the count and move along
                if (!p.allyCode) {
                    badCount += 1;
                    continue;
                }

                // Add in a letter for their rank in the guild ([M]ember, [O]fficer, [L]eader)
                p.memberLvl = p.guildMemberLevel ? gRanks[p.guildMemberLevel] : null;

                // Check if the player is registered, then bold the name if so
                const codes = await userReg.getUsersFromAlly(p.allyCode.toString());
                if (!codes?.length) continue;
                for (const c of codes) {
                    // Make sure they're in the same server
                    const mem = await interaction.guild?.members.fetch(c.id).catch((err: unknown) => {
                        // Member might have left guild or permissions issue
                        const message = err instanceof Error ? err.message : String(err);
                        logger.error(`Failed to fetch member ${c.id} in guild ${interaction.guild?.id}: ${message}`);
                        return null;
                    });
                    if (interaction.guild && mem) {
                        p.inGuild = true;
                        p.dID = c.id;
                        break;
                    }
                }
            }

            const users = [];
            // Format the strings for each member
            const maxLen = sortedGuild.length > 0 ? Math.max(...sortedGuild.map((mem) => mem.gp.toLocaleString().length)) : 0;
            for (const p of sortedGuild) {
                // The name, bold if they're in the server with the bot
                const nameStr = p.inGuild ? `**${p.name}**` : p.name;

                // A mention for the user if they're in the guild, blank if not
                const regStr = showReg && p.dID ? `(<@!${p.dID}>)` : "";

                // The ally code or the GP string
                const numStr = showAC ? p.allyCode : `${" ".repeat(maxLen - p.gp.toLocaleString().length) + p.gp.toLocaleString()} GP`;

                // Finally, the output string with everything together
                users.push(`\`[${numStr}]\` - \`[${p.memberLvl ?? "?"}]\` ${nameStr} ${regStr}`);
            }

            const fields = [];
            fields.push({
                name: language.get("COMMAND_GUILDS_GUILD_GP_HEADER"),
                value: codeBlock(
                    language.get(
                        "COMMAND_GUILDS_GUILD_GP",
                        guild.gp.toLocaleString(),
                        Math.floor(guild.gp / users.length).toLocaleString(),
                    ),
                ),
            });
            if (badCount > 0) {
                guild.warnings = guild.warnings || [];
                guild.warnings.push(`Missing ${badCount} guild members`);
            }
            if (guild.warnings) {
                fields.push({
                    name: "Warnings",
                    value: guild.warnings.join("\n"),
                });
            }
            const footerStr = updatedFooterStr(guild.updated, language);
            fields.push({
                name: constants.zws,
                value: footerStr,
            });
            return interaction.editReply({
                content: null,
                embeds: [
                    {
                        author: {
                            name: language.get("COMMAND_GUILDS_USERS_IN_GUILD", users.length, guild.name),
                        },
                        description: users?.length ? users.join("\n") : language.get("BASE_SWGOH_NO_GUILD"),
                        fields: fields,
                    },
                ],
            });
        }

        async function twSummary() {
            const fields = [];
            const doExpand = interaction.options.getBoolean("expand");
            const unitChecklist = await getFullTWList({ guildId: interaction.guild?.id });
            if (!guild || !guild.roster || !guild.roster.length) {
                return interaction.editReply({
                    content: null,
                    embeds: [
                        {
                            title: "Missing Guild",
                            description: language.get("BASE_SWGOH_NO_GUILD"),
                            color: constants.colors.brightred,
                        },
                    ],
                });
            }
            await interaction.editReply({ content: `Found guild \`${guild.name}\`!` });
            const gRosterACs = guild.roster.map((m) => m.allyCode);

            let guildMembers: SWAPIPlayer[];
            try {
                guildMembers = await swgohAPI.unitStats(gRosterACs, cooldown);
            } catch (e) {
                const errorMessage = e instanceof Error ? e.message : String(e);
                logger.error(`ERROR(Guilds/twSummary) getting guild: ${errorMessage}`);
                return interaction.editReply({
                    content: null,
                    embeds: [
                        {
                            description: codeBlock(errorMessage),
                            title: "Something Broke while getting your guild's characters",
                            color: constants.colors.brightred,
                            footer: { text: "Please try again in a bit." },
                        },
                    ],
                });
            }

            // // Get overall stats for the guild
            // const charArenaMembers = guildMembers.filter(m => m?.arena?.char?.rank);
            // const charArenaAVG = (charArenaMembers.reduce((acc, curr) => acc + curr.arena.char.rank, 0) / charArenaMembers.length);
            // const shipArenaMembers = guildMembers.filter(m => m?.arena?.ship?.rank);
            // const shipArenaAVG = (shipArenaMembers.reduce((acc, curr) => acc + curr.arena.ship.rank, 0) / shipArenaMembers.length);

            const membersGP = guild.roster.filter((m) => m?.gp);
            const avgMemberGP = membersGP.reduce((acc, curr) => acc + curr.gp, 0) / membersGP.length;

            let zetaCount = 0;
            for (const member of guildMembers) {
                const zetaRoster = member.roster.map(
                    (char) =>
                        char?.skills?.filter((s) => (s.isZeta && s.tier === s.tiers) || (s.isOmicron && s.tier >= s.tiers - 1)).length,
                );
                zetaCount += zetaRoster.reduce((acc, curr) => acc + curr, 0);
            }
            fields.push({
                name: "General Stats",
                value: codeBlock(
                    [
                        `Members:        ${guild.roster.length}`,
                        `Total GP:       ${shortenNum(guild.gp)}`,
                        `Average GP:     ${shortenNum(avgMemberGP)}`,
                        // `AVG Char Arena: ${charArenaAVG.toFixed(2)}`,
                        // `AVG Ship Arena: ${shipArenaAVG.toFixed(2)}`,
                        `Zetas:          ${zetaCount.toLocaleString()}`,
                    ].join("\n"),
                ),
            });

            // Get and format the guild's previous match history
            const previousMatches = guild.recentTerritoryWarResult?.sort((a, b) =>
                Number.parseInt(a.endTimeSeconds, 10) < Number.parseInt(b.endTimeSeconds, 10) ? 1 : -1,
            );
            if (previousMatches?.length) {
                const maxLenCompare = Math.max(...previousMatches.map((m) => `${m.score}-${m.opponentScore}`.length));
                const formattedMatches = previousMatches.map((match, ix) => {
                    const ourScore = Number.parseInt(match.score, 10);
                    const opponentScore = Number.parseInt(match.opponentScore, 10);
                    const matchPower = (match.power / 1_000_000).toFixed(1);
                    return `Match ${ix + 1} :: ${ourScore > opponentScore ? constants.emotes.check : constants.emotes.x} ${(`${ourScore}-${opponentScore},`).padEnd(maxLenCompare + 1, " ")} ${matchPower}M`;
                });
                fields.push({
                    name: "Previous Matches",
                    value: codeBlock("asciidoc", formattedMatches.join("\n")),
                });
            }

            // Get the streak of wins for the most recent Matches
            let winStreak = 0;
            for (const match of previousMatches) {
                if (Number.parseInt(match.score, 10) > Number.parseInt(match.opponentScore, 10)) {
                    winStreak++;
                } else {
                    break;
                }
            }
            const wld = previousMatches.reduce(
                (acc, curr) => {
                    const ourScore = Number.parseInt(curr.score, 10);
                    const opponentScore = Number.parseInt(curr.opponentScore, 10);
                    acc.wins += ourScore > opponentScore ? 1 : 0;
                    acc.losses += ourScore < opponentScore ? 1 : 0;
                    acc.draws += ourScore === opponentScore ? 1 : 0;
                    return acc;
                },
                { wins: 0, losses: 0, draws: 0 },
            );

            // Get the range (min to max) for score
            const scoreArr = previousMatches.map((m) => Number.parseInt(m.score, 10));
            const offRangeStr = `${Math.min(...scoreArr)}-${Math.max(...scoreArr)}`;
            const offMean = scoreArr.reduce((acc, curr) => acc + curr, 0) / scoreArr.length;
            const sortedScoreArr = scoreArr.sort((a, b) => a - b);
            const offMedian =
                scoreArr.length % 2 === 0
                    ? (sortedScoreArr[scoreArr.length / 2] + sortedScoreArr[scoreArr.length / 2 - 1]) / 2
                    : sortedScoreArr[Math.floor(scoreArr.length / 2)];

            // Get the range (min to max) for opponent score
            const opponentScoreArr = previousMatches.map((m) => Number.parseInt(m.opponentScore, 10));
            const defRangeStr = `${Math.min(...opponentScoreArr)}-${Math.max(...opponentScoreArr)}`;
            const defMean = opponentScoreArr.reduce((acc, curr) => acc + curr, 0) / opponentScoreArr.length;
            const sortedOpponentScoreArr = opponentScoreArr.sort((a, b) => a - b);
            const defMedian =
                opponentScoreArr.length % 2 === 0
                    ? (sortedOpponentScoreArr[opponentScoreArr.length / 2] + sortedOpponentScoreArr[opponentScoreArr.length / 2 - 1]) / 2
                    : sortedOpponentScoreArr[Math.floor(opponentScoreArr.length / 2)];

            fields.push({
                name: "Previous Matches Stats",
                value: codeBlock(
                    [
                        `Streak     :: ${winStreak} ${constants.emotes.check}`,
                        `W-L-D      :: ${wld.wins}-${wld.losses}-${wld.draws}, (${((wld.wins / previousMatches.length) * 100).toFixed(1)}%)`,
                        `Off range  :: ${offRangeStr}`,
                        `Off mean   :: ${offMean.toFixed(0)}`,
                        `Off median :: ${offMedian.toFixed(0)}`,
                        `Def range  :: ${defRangeStr}`,
                        `Def mean   :: ${defMean.toFixed(0)}`,
                        `Def median :: ${defMedian.toFixed(0)}`,
                    ].join("\n"),
                ),
            });

            // Get the overall gear levels for the guild as a whole
            const [gearLvls, avgGear] = summarizeCharLevels(guildMembers, "gear");
            const formattedGearLvls = Object.keys(gearLvls)
                .slice(doExpand ? 0 : -4)
                .map((g) => `G${g.toString().padEnd(12, " ")}:: ${gearLvls[g].toLocaleString().padStart(7, " ")}`)
                .join("\n");
            fields.push({
                name: "Character Gear Counts",
                value: `*How many characters at each gear level*${codeBlock(
                    `${formattedGearLvls}\nAVG Gear Lvl :: ${avgGear.toString().padStart(7, " ")}`,
                )}`,
            });

            // Get the overall rarity levels for the guild as a whole
            const [rarityLvls, avgRarity] = summarizeCharLevels(guildMembers, "rarity");
            const formattedRarityLvls = `${Object.keys(rarityLvls)
                .slice(doExpand ? 0 : -4)
                .map((g) => `${g}*           :: ${rarityLvls[g].toLocaleString().padStart(7, " ")}`)
                .join("\n")}\nAVG Star Lvl :: ${avgRarity.toString().padStart(7, " ")}`;
            fields.push({
                name: "Character Rarity Counts",
                value: `*How many characters at each star level*${codeBlock(`${formattedRarityLvls}`)}`,
            });

            // Get the overall relic levels for the guild as a whole
            const relicLvls = {};
            const MAX_RELIC = 8;
            for (let ix = MAX_RELIC; ix >= 1; ix--) {
                let relicCount = 0;
                for (const member of guildMembers) {
                    relicCount += member.roster.filter((c) => c && c.combatType === 1 && c.relic?.currentTier - 2 === ix).length;
                }
                if (relicCount > 0) {
                    relicLvls[ix] = relicCount;
                }
            }
            const tieredRelic = Object.keys(relicLvls).reduce((acc, curr) => acc + relicLvls[curr] * Number.parseInt(curr, 10), 0);
            const totalRelic = Object.keys(relicLvls).reduce((acc, curr) => acc + relicLvls[curr], 0);
            const avgRelic = tieredRelic / totalRelic;
            const formattedRelicLvls = `${Object.keys(relicLvls)
                .slice(doExpand ? 0 : -4)
                .map((g) => `R${g}            :: ${relicLvls[g].toLocaleString().padStart(7, " ")}`)
                .join("\n")}\nAVG Relic Lvl :: ${avgRelic.toFixed(2).toString().padStart(7, " ")}`;
            fields.push({
                name: "Character Relic Counts",
                value: `*How many characters at each relic tier*${codeBlock(`${formattedRelicLvls}`)}`,
            });

            // Get general stats on how many of certain characters the guild has and at what gear
            // Possibly put this in the guildConf so guilds can have custom lists?
            const charOut = twCategoryFormat(unitChecklist, gearLvls, 19, guildMembers, false);
            fields.push(
                ...charOut.map((char) => {
                    return {
                        name: toProperCase(char.name),
                        value: char.value,
                    };
                }),
            );

            const shipOut = twCategoryFormat(unitChecklist, gearLvls, 8, guildMembers, true);
            fields.push(
                ...shipOut.map((ship) => {
                    return {
                        name: toProperCase(ship.name),
                        value: ship.value,
                    };
                }),
            );

            const footerStr = updatedFooterStr(Math.min(...guildMembers.map((m) => m.updated)), language);
            fields.push({
                name: constants.zws,
                value: footerStr,
            });
            const embed = {
                author: {
                    name: language.get("COMMAND_GUILDS_TWS_HEADER", guild.name),
                },
                fields: fields,
            };
            try {
                return interaction.editReply({ content: null, embeds: [embed] });
            } catch (err) {
                const errorMessage = err instanceof Error ? err.message : String(err);
                logger.error(`ERROR(Guilds/twSummary) sending embed: ${errorMessage}`);
                if (interaction.channel) {
                    try {
                        return interaction.channel.send({ content: null, embeds: [embed] });
                    } catch (channelErr) {
                        const channelError = channelErr instanceof Error ? channelErr.message : String(channelErr);
                        logger.error(`ERROR(Guilds/twSummary) Failed to send to channel: ${channelError}`);
                    }
                }
            }
        }

        function twCategoryFormat(
            unitObj: TWList,
            gearLvls: { [key: string]: number },
            divLen: number,
            guildMembers: SWAPIPlayer[],
            isShips = false,
        ) {
            const catToFormat = isShips ? ["Ships", "Capital Ships"] : ["Galactic Legends", "Light Side", "Dark Side"];
            const fieldsOut = [];
            const [gear1, gear2] = Object.keys(gearLvls)
                .map((num) => Number.parseInt(num, 10))
                .sort((a, b) => b - a);

            for (const category of catToFormat) {
                const unitOut = [];
                const unitListMap = unitObj?.[category];
                if (!unitListMap || !Object.keys(unitListMap)?.length) continue;
                for (const [defId, name] of Object.entries(unitListMap)) {
                    let nameOut =
                        name || characters.find((c) => c.uniqueName === defId)?.name || ships.find((c) => c.uniqueName === defId)?.name;
                    if (!nameOut) nameOut = defId;
                    unitListMap[defId] = nameOut;
                }
                const longest = Object.values(unitListMap).reduce((acc, curr) => Math.max(acc, curr.length), 0);
                const divider = `**\`${"=".repeat(divLen + longest)}\`**`;
                if (isShips) {
                    unitOut.push(`**\`${"Name".padEnd(longest - 4)}Total 7*\`**`);
                } else {
                    if (category === "Galactic Legends") {
                        unitOut.push(`**\`${"Name".padEnd(longest - 4)}Total G${gear1}  G${gear2}  Ult\`**`);
                    } else {
                        unitOut.push(`**\`${"Name".padEnd(longest - 4)}Total G${gear1}  G${gear2}   7*\`**`);
                    }
                }
                unitOut.push(divider);

                for (const [defId, name] of Object.entries(unitListMap)) {
                    const roster = guildMembers
                        .filter((p) => p.roster.find((c) => c.defId === defId))
                        .map((p) => p.roster.find((c) => c.defId === defId));

                    let total = 0;
                    let g1 = 0;
                    let g2 = 0;
                    let ult = 0;
                    let sevenStar = 0;
                    if (roster?.length) {
                        total = roster.length;
                        if (category === "Galactic Legends") {
                            ult = roster.filter((c) => c?.purchasedAbilityId.length).length;
                        } else {
                            sevenStar = roster.filter((c) => c && c.rarity === 7).length;
                        }
                        if (!isShips) {
                            g1 = roster.filter((c) => c && c.gear === gear1).length;
                            g2 = roster.filter((c) => c && c.gear === gear2).length;
                        }
                    }
                    if (category === "Galactic Legends") {
                        unitOut.push(
                            `\`${name + " ".repeat(longest - name.length)}  ${" ".repeat(2 - total.toString().length) + total}   ${
                                " ".repeat(2 - g1.toString().length) + g1
                            }   ${" ".repeat(2 - g2.toString().length) + g2}   ${" ".repeat(2 - ult.toString().length) + ult}\``,
                        );
                    } else if (isShips) {
                        unitOut.push(
                            `\`${name + " ".repeat(longest - name.length)}  ${" ".repeat(2 - total.toString().length) + total}  ${
                                " ".repeat(2 - sevenStar.toString().length) + sevenStar
                            }\``,
                        );
                    } else {
                        unitOut.push(
                            `\`${name + " ".repeat(longest - name.length)}  ${" ".repeat(2 - total.toString().length) + total}   ${
                                " ".repeat(2 - g1.toString().length) + g1
                            }   ${" ".repeat(2 - g2.toString().length) + g2}   ${" ".repeat(2 - sevenStar.toString().length) + sevenStar}\``,
                        );
                    }
                }
                fieldsOut.push({
                    name: category,
                    value: unitOut.join("\n"),
                });
            }
            return fieldsOut;
        }
    }
}
