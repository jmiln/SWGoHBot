const Command = require("../base/slashCommand");
const { ApplicationCommandOptionType, codeBlock } = require("discord.js");

const { charChecklist, shipChecklist } = require("../data/unitChecklist");
const { getGuildSettings } = require("../modules/guildConfig/settings.js");

class Guilds extends Command {
    constructor(Bot) {
        super(Bot, {
            name: "guilds",
            guildOnly: false,
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
                        },
                    ],
                },
            ],
        });
    }

    async run(Bot, interaction) {
        await interaction.reply({ content: interaction.language.get("COMMAND_GUILDS_PLEASE_WAIT") });

        const subCommand = interaction.options.getSubcommand();
        if (!subCommand) return console.error("[slash/guilds] Somehow missing subCommand");

        const allycode = interaction.options.getString("allycode");
        const showSide = interaction.options.getString("show_side");
        const userAC = await Bot.getAllyCode(interaction, allycode, true);

        // If it hasn't found a valid ally code, grumble at the user, since that's required
        if (!userAC) {
            return super.error(
                interaction,
                "No valid ally code found. Please make sure that you have a registered ally code via the `userconf` command, or have entered a valid ally code",
            );
        }

        const cooldown = await Bot.getPlayerCooldown(interaction.user.id, interaction?.guild?.id);
        const guildConf = await getGuildSettings({ cache: Bot.cache, guildId: interaction.guild?.id || null });

        // Take care of the tickets now if needed, since it doesn't need bits ahead
        if (subCommand === "tickets") {
            const user = await Bot.userReg.getUser(interaction.user.id);
            const maxTickets = user?.guildTickets?.tickets || 600;
            return await guildTickets(userAC, maxTickets);
        }

        let guild = null;
        try {
            // Grab the guild's info from the DB
            guild = await Bot.swgohAPI.guild(userAC, cooldown);

            // Filter out any members that aren't in the guild
            guild.roster = guild.roster.filter((mem) => mem.guildMemberLevel > 1);
        } catch (e) {
            console.log(e);
            return super.error(interaction, `Issue getting guild: ${codeBlock(e)}`);
        }

        if (!guild) {
            return super.error(interaction, `Couldn't get guild${interaction.language.get("COMMAND_GUILDS_NO_GUILD")}`);
        }

        // Switch out depending on the subcommand
        switch (subCommand) {
            case "gear": {
                // Gear Overview
                try {
                    return await guildGear();
                } catch (err) {
                    return super.error(interaction, `Issue with guildGear: ${err.message}`);
                }
            }
            case "mods": {
                // Mods overview
                try {
                    return await guildMods();
                } catch (err) {
                    return super.error(interaction, `Issue with guildMods: ${err.message}`);
                }
            }
            case "relics": {
                // Relics overview
                try {
                    return await guildRelics();
                } catch (err) {
                    return super.error(interaction, `Issue with guildRelics: ${err.message}`);
                }
            }
            case "roster": {
                // Display the roster with gp etc
                try {
                    if (!showSide) {
                        try {
                            return await guildRoster();
                        } catch (err) {
                            console.log(err.message);
                            return super.error(interaction, `Issue with guildRoster: ${err.message}`);
                        }
                    } else {
                        return await guildSidedGP();
                    }
                } catch (err) {
                    return super.error(interaction, `Issue with guildRoster 2: ${err.message}`);
                }
            }
            case "tw_summary": {
                // Spit out a general summary of guild characters and such related to tw
                try {
                    return await twSummary();
                } catch (err) {
                    return super.error(interaction, `Issue with twSummary: ${err.message}`);
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
            if (sortBy && (sortBy > 13 || sortBy < 1)) {
                return interaction.editReply({ content: interaction.language.get("COMMAND_GUILDSEARCH_INVALID_SORT", gears.join(",")) });
            }
            const gRoster = guild.roster.sort((a, b) => (a.name.toLowerCase() > b.name.toLowerCase() ? 1 : -1)).map((m) => m.allyCode);

            if (!gRoster.length) {
                return interaction.editReply({ content: "I can't find any players in the requested guild." });
            }
            let guildGG;
            try {
                guildGG = await Bot.swgohAPI.unitStats(gRoster, cooldown);
            } catch (e) {
                Bot.logger.error(`ERROR(GS_GEAR) getting guild: ${e}`);
                // Spit out the gId so I can go check on why it's breaking
                Bot.logger.error(`GuildID: ${guild.id}`);
                return interaction.editReply({
                    content: null,
                    embeds: [
                        {
                            description: codeBlock(e),
                            title: "Something Broke while getting your guild's characters",
                            footer: "Please try again in a bit",
                            color: Bot.constants.colors.red,
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
                    10: gearOut[k]["10"] || 0,
                    11: gearOut[k]["11"] || 0,
                    12: gearOut[k]["12"] || 0,
                    13: gearOut[k]["13"] || 0,
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

            const tableOut = Bot.makeTable(tableFormat, tableIn);

            const outMsgArr = Bot.msgArray(tableOut, "\n", 700);
            const fields = [];
            for (const m of outMsgArr) {
                if (!m?.length) continue;
                fields.push({
                    name: "-",
                    value: m,
                });
            }

            const footerStr = Bot.updatedFooterStr(guild.updated, interaction);
            fields.push({
                name: Bot.constants.zws,
                value: footerStr,
            });
            return interaction.editReply({
                content: null,
                embeds: [
                    {
                        author: {
                            name: `${guild.name} ${interaction.language.get("COMMAND_GUILDSEARCH_GEAR_SUM")}`,
                        },
                        fields: fields,
                    },
                ],
            });
        }

        async function guildMods() {
            // Give a general overview of important mods (6*, +15, +20 speed, +100 offense?)
            let guildGG;
            try {
                guildGG = await Bot.swgohAPI.unitStats(
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
                            footer: "Please try again in a bit",
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
                for (const k of Object.keys(mods)) {
                    if (mods[k] === 0) mods[k] = "0";
                }
                output.push(mods);
            }

            // Sort by speed mods, offense mods, or 6* mods
            const sortBy = interaction.options.getString("sort");
            if (sortBy === "offense") {
                // Sort by # of good offense mods
                output = output.sort((m, n) => m.off100 - n.off100);
            } else if (sortBy === "speed") {
                // Sort by # of good speed mods
                output = output.sort((m, n) => m.spd20 - n.spd20);
            } else if (sortBy === "6") {
                // Sort by # of 6* mods
                output = output.sort((m, n) => m.sixPip - n.sixPip);
            }

            const table = Bot.makeTable(
                {
                    sixPip: { value: "6*", startWith: "`" },
                    spd15: { value: "15+" },
                    spd20: { value: "20+" },
                    off100: { value: "100+", endWith: "`" },
                    name: { value: "", align: "left" },
                },
                output,
            );
            const header = [Bot.expandSpaces("`     ┏╸ Spd ┓  Off ​`")];

            const fields = Bot.msgArray(header.concat(table), "\n", 700).map((m) => {
                if (!m?.length) return;
                return { name: "-", value: m };
            });

            return interaction.editReply({
                content: null,
                embeds: [
                    {
                        author: {
                            name: interaction.language.get("COMMAND_GUILDSEARCH_MODS_HEADER", guild.name),
                        },
                        fields: fields,
                    },
                ],
            });
        }

        async function guildRelics() {
            const members = [];

            // Make sure the guild roster exists, and grab all the ally codes
            let gRoster;
            if (!guild || !guild.roster || !guild.roster.length) {
                throw new Error(
                    "I cannot find any players in that guild.\n Please make sure you have the name or ally code correct and try again.",
                );
            }
            interaction.editReply({ content: `Found guild \`${guild.name}\`!` });
            gRoster = guild.roster.map((m) => m.allyCode);

            // Use the ally codes to get all the other info for the guild
            let guildMembers;
            try {
                guildMembers = await Bot.swgohAPI.unitStats(gRoster, cooldown);
            } catch (e) {
                Bot.logger.error(`ERROR(GS) getting guild: ${e}`);
                return interaction.editReply({
                    content: null,
                    embeds: [
                        {
                            title: "Something Broke while getting your guild's characters",
                            description: codeBlock(e),
                            footer: "Please try again in a bit.",
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
                    "r5-7": 0,
                    r8: 0,
                    "r9+": 0,
                };
                for (const char of member.roster) {
                    if (char.gear === 13 && char?.relic?.currentTier - 2 >= 0) {
                        // If it's a g13 with a relic, check for the relic
                        const rel = char.relic.currentTier - 2;
                        if (rel <= 4) {
                            memberRoster["r0-4"] += 1;
                        } else if (rel <= 7) {
                            memberRoster["r5-7"] += 1;
                        } else if (rel === 8) {
                            memberRoster.r8 += 1;
                        } else {
                            memberRoster["r9+"] += 1;
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
            const memOut = Bot.makeTable(
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
            const totalOut = Bot.makeTable(totalsFormat, [tierTotals]);

            // Chunk the info into sections so it'll fit in the embed fields
            const fields = [];
            const fieldVals = Bot.msgArray(memOut, "\n", 1000);

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

        async function guildTickets(userAC, maxTickets) {
            const sortBy = interaction.options.getString("sort");

            let rawGuild;
            try {
                rawGuild = await Bot.swgohAPI.getRawGuild(userAC);
            } catch (err) {
                return interaction.editReply({ content: err.toString() });
            }

            if (!rawGuild) return interaction.editReply({ content: `Sorry, but I could not find a guild to match with ${userAC}` });

            const out = [];
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
            const chaTime = rawGuild.nextChallengesRefresh * 1000;
            const nowTime = new Date().getTime();
            if (chaTime > nowTime) {
                // It's in the future
                timeUntilReset = Bot.formatDuration(chaTime - nowTime);
            } else {
                // It's in the past, so calculate the next time
                const dur = Number.parseInt(chaTime, 10) + dayMS - nowTime;
                timeUntilReset = Bot.formatDuration(dur);
            }

            let maxed = 0;
            for (const member of roster) {
                const tickets = member.memberContribution["2"].currentValue;
                if (tickets < maxTickets) {
                    out.push(Bot.expandSpaces(`\`${tickets.toString().padStart(3)}\` - ${`**${member.playerName}**`}`));
                } else {
                    maxed += 1;
                }
            }
            const footerStr = Bot.updatedFooterStr(rawGuild.updated, interaction);
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
            let desc = guild.desc ? `**${interaction.language.get("COMMAND_GUILDS_DESC")}:**\n\`${guild.desc}\`\n` : "";
            desc += guild.message?.length ? `**${interaction.language.get("COMMAND_GUILDS_MSG")}:**\n\`${guild.message}\`` : "";

            const raidStr = interaction.language.get("COMMAND_GUILDS_RAID_STRINGS");
            const raidArr = [];
            let raids = "";

            if (guild.raid && Object.keys(guild.raid).length) {
                const raidNames = Bot.raidNames[guildConf.swgohLanguage.toLowerCase()];
                const maxRaidLen = Math.max(
                    ...Object.values(raidNames)
                        .filter((r) => !!r)
                        .map((r) => r.length),
                );
                for (const r in guild.raid) {
                    const thisRaidName = Bot.expandSpaces(Bot.toProperCase(raidNames[r].padEnd(maxRaidLen + 1, " ")));
                    const raidTier = guild.raid[r]?.diffId.includes("HEROIC")
                        ? Bot.toProperCase(raidNames.heroic)
                        : guild.raid[r]?.diffId.replace("DIFF0", "T");
                    raidArr.push(`${thisRaidName} | ${raidTier}`);
                }
                raids = raidArr.sort((a, b) => (a.toLowerCase() > b.toLowerCase() ? 1 : -1)).join("\n");
            } else {
                raids = "No raids available";
            }

            if (raids) {
                fields.push({
                    name: raidStr.header || "Raids",
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
            const stats = interaction.language.get(
                "COMMAND_GUILDS_STAT_STRINGS",
                guild.roster.length,
                guild.required,
                guild.gp.toLocaleString(),
                guildCharGP.toLocaleString(),
                guildShipGP.toLocaleString(),
            );
            fields.push({
                name: interaction.language.get("COMMAND_GUILDS_STAT_HEADER"),
                value: codeBlock(stats) || "N/A",
                inline: true,
            });

            fields.push({
                name: "-",
                value:
                    interaction.language.get("COMMAND_GUILDS_FOOTER") ||
                    "`/guilds roster` for a list of your guild members and their gp.\n`/guilds roster show_allycode: true` for a list with their ally codes instead.",
            });

            if (guild.warnings?.length) {
                fields.push({
                    name: "Warnings",
                    value: guild.warnings.join("\n"),
                });
            }

            const footerStr = Bot.updatedFooterStr(guild.updated, interaction);
            fields.push({
                name: Bot.constants.zws,
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
            let gRoster;
            if (!guild || !guild.roster || !guild.roster.length) {
                throw new Error(
                    "I cannot find any players in that guild.\n Please make sure you have the name or ally code correct and try again.",
                );
            }
            interaction.editReply({ content: `Found guild \`${guild.name}\`!` });
            gRoster = guild.roster.map((m) => m.allyCode);

            // Use the ally codes to get all the other info for the guild
            let guildMembers;
            try {
                guildMembers = await Bot.swgohAPI.unitStats(gRoster, cooldown);
            } catch (e) {
                Bot.logger.error(`ERROR(GS) getting guild: ${e}`);
                return interaction.editReply({
                    content: null,
                    embeds: [
                        {
                            title: "Something Broke while getting your guild's characters",
                            description: codeBlock(e),
                            footer: "Please try again in a bit.",
                        },
                    ],
                });
            }

            let charList = [];
            let shipList = [];
            const users = [];
            if (showSide) {
                charList = Bot.characters.filter((ch) => ch.side === showSide);
                shipList = Bot.ships.filter((ch) => ch.side === showSide);
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
                        `\`[ ${Bot.shortenNum(charTotal, 2)} | ${Bot.shortenNum(shipTotal, 2)} | ${Bot.shortenNum(
                            charTotal + shipTotal,
                        )} ]\` - **${member.name}**`,
                    );
                } else {
                    users.push(
                        `\`[ ${Bot.shortenNum(charTotal, 2)} | ${Bot.shortenNum(shipTotal, 2)} | ${Bot.shortenNum(
                            charTotal + shipTotal,
                        )} ]\` - ${member.name}`,
                    );
                }
            }

            const fields = [];
            const header = "**`[ Char  | Ship  | Total ]`**";
            const msgArr = Bot.msgArray([header, ...users], "\n", 1000);
            msgArr.forEach((m, ix) => {
                fields.push({
                    name: interaction.language.get("COMMAND_GUILDS_ROSTER_HEADER", ix + 1, msgArr.length),
                    value: m,
                });
            });
            if (guild.warnings) {
                fields.push({
                    name: "Warnings",
                    value: guild.warnings.join("\n"),
                });
            }
            const footerStr = Bot.updatedFooterStr(guild.updated, interaction);
            fields.push({
                name: Bot.constants.zws,
                value: footerStr,
            });
            return interaction.editReply({
                content: null,
                embeds: [
                    {
                        author: {
                            name: `${Bot.toProperCase(showSide)} side GP`,
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

            let sortedGuild;
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
                const codes = await Bot.userReg.getUsersFromAlly(p.allyCode);
                if (!codes?.length) continue;
                for (const c of codes) {
                    // Make sure they're in the same server
                    const mem = await interaction.guild?.members.fetch(c.id).catch(() => {});
                    if (interaction.guild && mem) {
                        p.inGuild = true;
                        p.dID = c.id;
                        break;
                    }
                }
            }

            const users = [];
            // Format the strings for each member
            const maxLen = Math.max(...sortedGuild.map((mem) => mem.gp.toLocaleString().length));
            for (const p of sortedGuild) {
                // The name, bold if they're in the server with the bot
                const nameStr = p.inGuild ? `**${p.name}**` : p.name;

                // A mention for the user if they're in the guild, blank if not
                const regStr = showReg && p.dID ? `(<@!${p.dID}>)` : "";

                // The ally code or the GP string
                const numStr = showAC ? p.allyCode : `${" ".repeat(maxLen - p.gp.toLocaleString().length) + p.gp.toLocaleString()} GP`;

                // Finally, the output string with everything together
                users.push(`\`[${numStr}]\` - \`[${p.memberLvl}]\` ${nameStr} ${regStr}`);
            }

            const fields = [];
            const msgArr = Bot.msgArray(users, "\n", 1000);
            msgArr.forEach((m, ix) => {
                fields.push({
                    name: interaction.language.get("COMMAND_GUILDS_ROSTER_HEADER", ix + 1, msgArr.length),
                    value: m,
                });
            });
            fields.push({
                name: interaction.language.get("COMMAND_GUILDS_GUILD_GP_HEADER"),
                value: codeBlock(
                    interaction.language.get(
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
            const footerStr = Bot.updatedFooterStr(guild.updated, interaction);
            fields.push({
                name: Bot.constants.zws,
                value: footerStr,
            });
            return interaction.editReply({
                content: null,
                embeds: [
                    {
                        author: {
                            name: interaction.language.get("COMMAND_GUILDS_USERS_IN_GUILD", users.length, guild.name),
                        },
                        fields: fields,
                    },
                ],
            });
        }

        async function twSummary() {
            const fields = [];
            const doExpand = interaction.options.getBoolean("expand");
            let gRoster;
            if (!guild || !guild.roster || !guild.roster.length) {
                return interaction.editReply({
                    content: null,
                    embeds: [
                        {
                            title: "Missing Guild",
                            description: interaction.language.get("BASE_SWGOH_NO_GUILD"),
                            color: Bot.constants.colors.brightred,
                        },
                    ],
                });
            }
            await interaction.editReply({ content: `Found guild \`${guild.name}\`!` });
            gRoster = guild.roster.map((m) => m.allyCode);

            let guildMembers;
            try {
                guildMembers = await Bot.swgohAPI.unitStats(gRoster, cooldown);
            } catch (e) {
                Bot.logger.error(`ERROR(GS) getting guild: ${e}`);
                return interaction.editReply({
                    content: null,
                    embeds: [
                        {
                            description: codeBlock(e),
                            title: "Something Broke while getting your guild's characters",
                            color: Bot.constants.colors.brightred,
                            footer: "Please try again in a bit.",
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
                        `Total GP:       ${Bot.shortenNum(guild.gp)}`,
                        `Average GP:     ${Bot.shortenNum(avgMemberGP)}`,
                        // `AVG Char Arena: ${charArenaAVG.toFixed(2)}`,
                        // `AVG Ship Arena: ${shipArenaAVG.toFixed(2)}`,
                        `Zetas:          ${zetaCount.toLocaleString()}`,
                    ].join("\n"),
                ),
            });

            // Get the overall gear levels for the guild as a whole
            const [gearLvls, avgGear] = Bot.summarizeCharLevels(guildMembers, "gear");
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
            const [rarityLvls, avgRarity] = Bot.summarizeCharLevels(guildMembers, "rarity");
            const formattedRarityLvls = `${Object.keys(rarityLvls)
                .splice(doExpand ? 0 : -4)
                .map((g) => `${g}*           :: ${rarityLvls[g].toLocaleString().padStart(7, " ")}`)
                .join("\n")}\nAVG Star Lvl :: ${avgRarity.padStart(7, " ")}`;
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
                .splice(doExpand ? 0 : -4)
                .map((g) => `R${g}            :: ${relicLvls[g].toLocaleString().padStart(7, " ")}`)
                .join("\n")}\nAVG Relic Lvl :: ${avgRelic.toFixed(2).toString().padStart(7, " ")}`;
            fields.push({
                name: "Character Relic Counts",
                value: `*How many characters at each relic tier*${codeBlock(`${formattedRelicLvls}`)}`,
            });

            // Get general stats on how many of certain characters the guild has and at what gear
            // Possibly put this in the guildConf so guilds can have custom lists?
            const charOut = twCategoryFormat(charChecklist, gearLvls, 19, guildMembers, false);
            fields.push(
                ...charOut.map((char) => {
                    return {
                        name: Bot.toProperCase(char.name),
                        value: char.value,
                    };
                }),
            );

            const shipOut = twCategoryFormat(shipChecklist, gearLvls, 8, guildMembers, true);
            fields.push(
                ...shipOut.map((ship) => {
                    return {
                        name: Bot.toProperCase(ship.name),
                        value: ship.value,
                    };
                }),
            );

            if (guildMembers.warnings) {
                fields.push({
                    name: "Warnings",
                    value: guildMembers.warnings.join("\n"),
                });
            }

            const footerStr = Bot.updatedFooterStr(Math.min(...guildMembers.map((m) => m.updated)), interaction);
            fields.push({
                name: Bot.constants.zws,
                value: footerStr,
            });
            return interaction.editReply({
                content: null,
                embeds: [
                    {
                        author: {
                            name: interaction.language.get("COMMAND_GUILDS_TWS_HEADER", guild.name),
                        },
                        fields: fields,
                    },
                ],
            });
        }
    }
}

function twCategoryFormat(unitObj, gearLvls, divLen, guildMembers, ships = false) {
    const fieldsOut = [];
    const [gear1, gear2] = Object.keys(gearLvls)
        .map((num) => Number.parseInt(num, 10))
        .sort((a, b) => b - a);

    for (const category of Object.keys(unitObj)) {
        const unitOut = [];
        const unitListArray = unitObj[category];
        const longest = unitListArray.reduce((acc, curr) => Math.max(acc, curr[1].length), 0);
        const divider = `**\`${"=".repeat(divLen + longest)}\`**`;
        if (ships) {
            unitOut.push(`**\`${`Name${" ".repeat(longest - 4)}`}Total 7*\`**`);
        } else {
            if (category === "Galactic Legends") {
                unitOut.push(`**\`${`Name${" ".repeat(longest - 4)}`}Total G${gear1}  G${gear2}  Ult\`**`);
            } else {
                unitOut.push(`**\`${`Name${" ".repeat(longest - 4)}`}Total G${gear1}  G${gear2}   7*\`**`);
            }
        }
        unitOut.push(divider);

        for (const unit of unitListArray) {
            const defId = unit[0];
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
                if (!ships) {
                    g1 = roster.filter((c) => c && c.gear === gear1).length;
                    g2 = roster.filter((c) => c && c.gear === gear2).length;
                }
            }
            const name = unit[1];
            if (category === "Galactic Legends") {
                unitOut.push(
                    `\`${name + " ".repeat(longest - name.length)}  ${" ".repeat(2 - total.toString().length) + total}   ${
                        " ".repeat(2 - g1.toString().length) + g1
                    }   ${" ".repeat(2 - g2.toString().length) + g2}   ${" ".repeat(2 - ult.toString().length) + ult}\``,
                );
            } else if (ships) {
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

module.exports = Guilds;
