const Command = require("../base/slashCommand");
const moment = require("moment-timezone");
const {charChecklist, shipChecklist} = require("../data/unitChecklist");

class Guilds extends Command {
    constructor(Bot) {
        super(Bot, {
            name: "guilds",
            guildOnly: false,
            category: "SWGoH",
            aliases: ["guild", "g"],
            permissions: ["EMBED_LINKS"],
            options: [
                {
                    name: "gear",
                    description: "Show an overview of the guild's gear levels",
                    type: "SUB_COMMAND",
                    options: [
                        {
                            name: "allycode",
                            description: "The ally code of the guild you want to check.",
                            type: "STRING"
                        },
                        {
                            name: "sort",
                            description: "Which gear level you'd like it sorted by (9-13)",
                            type: "INTEGER"
                        }
                    ]
                },
                {
                    name: "mods",
                    description: "Show an overview of the guild's mod stats",
                    type: "SUB_COMMAND",
                    options: [
                        {
                            name: "allycode",
                            description: "The ally code of the guild you want to check.",
                            type: "STRING"
                        },
                        {
                            name: "sort",
                            description: "Choose how you want the results sorted",
                            type: "STRING",
                            choices: [
                                {
                                    name: "name",
                                    value: "name"
                                },
                                {
                                    name: "offense",
                                    value: "offense"
                                },
                                {
                                    name: "six pip/ 6*",
                                    value: "6"
                                },
                                {
                                    name: "speed",
                                    value: "speed"
                                }
                            ]
                        }
                    ]
                },
                {
                    name: "relics",
                    description: "Show an overview of the guild's relic counts",
                    type: "SUB_COMMAND",
                    options: [
                        {
                            name: "allycode",
                            description: "The ally code of the guild you want to check.",
                            type: "STRING"
                        },
                    ]
                },
                {
                    name: "roster",
                    description: "View the guild's roster, showing ally codes, gp, etc.",
                    type: "SUB_COMMAND",
                    options: [
                        {
                            name: "allycode",
                            description: "The ally code of the guild you want to check.",
                            type: "STRING"
                        },
                        {
                            name: "registered",
                            description: "Show the discord names of anyone registered & on the server next to their name.",
                            type: "BOOLEAN"
                        },
                        {
                            name: "show_allycode",
                            description: "Show user's ally codes instead of their gp",
                            type: "BOOLEAN"
                        },
                        {
                            name: "sort",
                            description: "Choose what the list is sorted by.",
                            type: "STRING",
                            choices: [
                                {
                                    name: "name",
                                    value: "name"
                                },
                                {
                                    name: "rank",
                                    value: "rank"
                                },
                                {
                                    name: "gp",
                                    value: "gp"
                                }
                            ]
                        },
                    ]
                },
                {
                    name: "tickets",
                    description: "Show how many event tickets each guild member has aquired for the day",
                    type: "SUB_COMMAND",
                    options: [
                        {
                            name: "allycode",
                            description: "The ally code of the guild you want to check.",
                            type: "STRING"
                        },
                        {
                            name: "sort",
                            description: "Choose what the list is sorted by.",
                            type: "STRING",
                            choices: [
                                {
                                    name: "tickets",
                                    value: "tickets"
                                },
                                {
                                    name: "name",
                                    value: "name"
                                }
                            ]
                        },
                    ]
                },
                {
                    name: "tw_summary",
                    description: "Show an overview of stats for your guild that could be useful for territory wars",
                    type: "SUB_COMMAND",
                    options: [
                        {
                            name: "allycode",
                            description: "The ally code of the guild you want to check.",
                            type: "STRING"
                        },
                        {
                            name: "expand",
                            description: "Expand some of the fields to show all options",
                            type: "BOOLEAN",
                        },
                    ]
                },
                {
                    name: "view",
                    description: "Show an overview of the guild's stats",
                    type: "SUB_COMMAND",
                    options: [
                        {
                            name: "allycode",
                            description: "The ally code of the guild you want to check.",
                            type: "STRING"
                        },
                    ]
                }
            ]
        });
    }

    async run(Bot, interaction) { // eslint-disable-line no-unused-vars
        // Basic, with no args, shows the top ## guilds (Based on how many have registered)
        // <allyCode | mention | guildName >

        // Shows your guild's total GP, average GP, and a list of your members
        // Not trying to get any specific guild, show em the top ones

        const subCommand = interaction.options.getSubcommand();
        const allycode = interaction.options.getString("allycode");
        const userID = await Bot.getAllyCode(interaction, allycode, true);

        // If it hasn't found a valid ally code, grumble at the user, since that's required
        if (!userID) {
            return super.error(interaction, "No valid ally code found. Please make sure that you have a registered ally code via the `userconf` command, or have entered a valid ally code");
        }

        await interaction.reply({content: interaction.language.get("COMMAND_GUILDS_PLEASE_WAIT")});

        const cooldown = await Bot.getPlayerCooldown(interaction.user.id);

        // Take care of the tickets now if needed, since it doesn't need bits ahead
        if (subCommand === "tickets") {
            return await guildTickets(userID);
        }

        let guild = null;
        try {
            guild = await Bot.swgohAPI.guild(userID, null, cooldown);
        } catch (e) {
            return super.error(interaction, Bot.codeBlock(e));
        }

        if (!guild) {
            return super.error(interaction, interaction.language.get("COMMAND_GUILDS_NO_GUILD"));
        }

        // Switch out depending on the subcommand
        switch (subCommand) {
            case "gear": {
                // Gear Overview
                try {
                    return await guildGear();
                } catch (err) {
                    return super.error(interaction, err);
                }
            }
            case "mods": {
                // Mods overview
                try {
                    return await guildMods();
                } catch (err) {
                    return super.error(interaction, err);
                }
            }
            case "relics": {
                // Relics overview
                try {
                    return await guildRelics();
                } catch (err) {
                    return super.error(interaction, err);
                }
            }
            case "roster": {
                // Display the roster with gp etc
                try {
                    return await guildRoster();
                } catch (err) {
                    return super.error(interaction, err);
                }
            }
            case "tw_summary": {
                // Spit out a general summary of guild characters and such related to tw
                try {
                    return await twSummary();
                } catch (err) {
                    return super.error(interaction, err);
                }
            }
            case "view":
            default: {
                // Show basic stats/ info about the guild
                await baseGuild();
            }
        }

        async function guildGear() {
            // List an overview of the guild's upper geared characters
            const gears = [10,11,12,13];
            const sortBy = interaction.options.getInteger("sort");
            if (sortBy && (sortBy > 13 || sortBy < 1)) {
                return interaction.editReply({content: interaction.language.get("COMMAND_GUILDSEARCH_INVALID_SORT", gears.join(","))});
            }
            const gRoster = guild.roster.sort((a, b) => a.name.toLowerCase() > b.name.toLowerCase() ? 1 : -1).map(m => m.allyCode);

            if (!gRoster.length) {
                return interaction.editReply({content: "I can't find any players in the requested guild."});
            }
            let guildGG;
            try {
                guildGG = await Bot.swgohAPI.unitStats(gRoster, cooldown);
            } catch (e) {
                Bot.logger.error("ERROR(GS_GEAR) getting guild: " + e);
                // Spit out the gId so I can go check on why it's breaking
                Bot.logger.error("GuildID: " + guild.id);
                return interaction.editReply({content: null, embeds: [{
                    description: Bot.codeBlock(e),
                    title: "Something Broke while getting your guild's characters",
                    footer: "Please try again in a bit",
                    color: "#FF0000"
                }]});
            }

            const gearOut = {};

            guildGG.forEach(player => {
                if (!player.roster) return;
                player.roster.forEach(char => {
                    gearOut[player.name] = gearOut[player.name] || {};
                    if (char.gear < 10) return;
                    if (gearOut[player.name][char.gear]) {
                        gearOut[player.name][char.gear] += 1;
                    } else {
                        gearOut[player.name][char.gear] = 1;
                    }
                });
            });

            let tableIn = Object.keys(gearOut).map(k => {
                return {
                    "10": gearOut[k]["10"] || 0,
                    "11": gearOut[k]["11"] || 0,
                    "12": gearOut[k]["12"] || 0,
                    "13": gearOut[k]["13"] || 0,
                    name: k
                };
            });

            if (sortBy) {
                tableIn = tableIn.sort((a, b) => a[sortBy] < b[sortBy] ? 1 : -1);
            } else {
                tableIn = tableIn.sort((a, b) => a.name.toLowerCase() > b.name.toLowerCase() ? 1 : -1);
            }

            const tableFormat = {
                "10": {value: "g10", startWith: "`[", endWith: "|",  align: "right"},
                "11": {value: "g11",                  endWith: "|",  align: "right"},
                "12": {value: "g12",                  endWith: "|",  align: "right"},
                "13": {value: "g13",                  endWith: "]`", align: "right"},
                name: {value: "",                                    align: "left"}
            };

            const tableOut = Bot.makeTable(tableFormat, tableIn);

            const outMsgArr = Bot.msgArray(tableOut, "\n", 700);
            const fields = [];
            outMsgArr.forEach(m => {
                fields.push({
                    name: "-",
                    value: m
                });
            });

            const footer = Bot.updatedFooter(guild.updated, interaction, "guild", cooldown);
            return interaction.editReply({content: null, embeds: [{
                author: {
                    name: `${guild.name} ${interaction.language.get("COMMAND_GUILDSEARCH_GEAR_SUM")}`
                },
                fields: fields,
                footer: footer
            }]});
        }

        async function guildMods() {
            // Give a general overview of important mods (6*, +15, +20 speed, +100 offense?)
            let guildGG;
            try {
                guildGG = await Bot.swgohAPI.unitStats(guild.roster.map(m => m.allyCode), cooldown);
            } catch (err) {
                return interaction.editReply({
                    content: null,
                    embeds: [{
                        title: "Something Broke while getting your guild's characters",
                        description: " " +Bot.codeBlock(err),
                        footer: "Please try again in a bit"
                    }]
                });
            }
            guildGG = guildGG.sort((a, b) => a.name.toLowerCase() > b.name.toLowerCase() ? 1 : -1);
            let output = [];
            for (const player of guildGG) {
                const mods = {
                    sixPip: 0,
                    spd15: 0,
                    spd20: 0,
                    off100: 0,
                    name: player.name
                };

                player.roster.forEach(c => {
                    if (c.mods) {
                        const six = c.mods.filter(p => p.pips === 6);
                        if (six.length) {
                            mods.sixPip += six.length;
                        }
                        c.mods.forEach(m => {
                            const spd = m.secondaryStat.find(s => (s.unitStat === 5  || s.unitStat === "UNITSTATSPEED")  && s.value >= 15);
                            const off = m.secondaryStat.find(o => (o.unitStat === 41 || o.unitStat === "UNITSTATOFFENSE") && o.value >= 100);

                            if (spd) {
                                if (spd.value >= 20) {
                                    mods.spd20 += 1;
                                } else {
                                    mods.spd15 += 1;
                                }                             }
                            if (off) mods.off100 += 1;
                        });
                    }
                });
                Object.keys(mods).forEach(k => {
                    if (mods[k] === 0) mods[k] = "0";
                });
                output.push(mods);
            }

            // Sort by speed mods, offense mods, or 6* mods
            const sortBy = interaction.options.getString("sort");
            if (sortBy === "offense") {
                // Sort by # of good offense mods
                output = output.sort((m, n) => parseInt(m.off100, 10) - parseInt(n.off100, 10));
            } else if (sortBy === "speed") {
                // Sort by # of good speed mods
                output = output.sort((m, n) => parseInt(m.spd20, 10) - parseInt(n.spd20, 10));
            } else if (sortBy === "6") {
                // Sort by # of 6* mods
                output = output.sort((m, n) => parseInt(m.sixPip, 10) - parseInt(n.sixPip, 10));
            }

            const table = Bot.makeTable({
                sixPip:{value: "6*", startWith: "`"},
                spd15: {value: "15+"},
                spd20: {value: "20+"},
                off100:{value: "100+", endWith: "`"},
                name:  {value: "", align: "left"}
            }, output);
            const header = [Bot.expandSpaces("`     ┏╸ Spd ┓  Off ​`")];

            const fields = Bot.msgArray(header.concat(table), "\n", 700).map(m => {
                return {name: "-", value: m};
            });

            return interaction.editReply({content: null, embeds: [{
                author: {
                    name: interaction.language.get("COMMAND_GUILDSEARCH_MODS_HEADER", guild.name)
                },
                fields: fields
            }]});
        }

        async function guildRelics() {
            const members = [];

            // Make sure the guild roster exists, and grab all the ally codes
            let gRoster ;
            if (!guild || !guild.roster || !guild.roster.length) {
                throw new Error(interaction.language.get("BASE_SWGOH_NO_GUILD"));
            } else {
                interaction.editReply({content: "Found guild `" + guild.name + "`!"});
                gRoster = guild.roster.map(m => m.allyCode);
            }

            // Use the ally codes to get all the other info for the guild
            let guildMembers;
            try {
                guildMembers = await Bot.swgohAPI.unitStats(gRoster, cooldown);
            } catch (e) {
                Bot.logger.error("ERROR(GS) getting guild: " + e);
                return interaction.editReply({content: null, embeds: [{
                    title: "Something Broke while getting your guild's characters",
                    description: Bot.codeBlock(e),
                    footer: "Please try again in a bit."
                }]});
            }

            for (const member of guildMembers) {
                const memberRoster = {
                    // Just the name
                    name: member.name,

                    // The gear levels
                    g1: 0, g2: 0, g3: 0, g4: 0, g5: 0, g6: 0, g7: 0, g8: 0, g9: 0, g10: 0, g11: 0, g12: 0,

                    // The relics
                    "r0-4": 0, "r5-7": 0, r8:  0
                };
                for (const char of member.roster) {
                    if (char.gear === 13 && char?.relic?.currentTier-2 >= 0) {
                        // If it's a g13 with a relic, check for the relic
                        const rel = char.relic.currentTier - 2;
                        if (rel <= 4) {
                            memberRoster["r0-4"] += 1;
                        } else if (rel <= 7) {
                            memberRoster["r5-7"] += 1;
                        } else {
                            memberRoster.r8  += 1;
                        }
                    } else {
                        // If it's not already there, then stick it in
                        memberRoster["g" + char.gear] += 1;
                    }
                }
                members.push(memberRoster);
            }

            // See what the top 4 tiers of gear/ relic are available for these members
            let firstViableTier = null;
            const tierKeys = Object.keys(members[0]).reverse();
            for (const tier in tierKeys) {
                if (members.filter(mem => mem[tierKeys[tier]] > 0).length) {
                    firstViableTier = tier;
                    break;
                }
            }

            // Set up the formats for the table maker
            const viableTiers = tierKeys.slice(parseInt(firstViableTier, 10), parseInt(firstViableTier, 10)+4).reverse();
            const tierFormat = {
                [viableTiers[0]]: {value: viableTiers[0], startWith: "`[", endWith: "|",  align: "right"},
                [viableTiers[1]]: {value: viableTiers[1],                  endWith: "|",  align: "right"},
                [viableTiers[2]]: {value: viableTiers[2],                  endWith: "|",  align: "right"},
                [viableTiers[3]]: {value: viableTiers[3],                  endWith: "]`",  align: "right"},
                name:             {value: "",                                             align: "left"}
            };

            // Format all the output, then send it on
            const memOut = Bot.makeTable(tierFormat, members.sort((a, b) => a.name.toLowerCase() > b.name.toLowerCase() ? 1 : -1));

            // Chunk the info into sections so it'll fit in the embed fields
            const fields = [];
            const fieldVals = Bot.msgArray(memOut, "\n", 1000);

            // Stick the formatted bits into the fields
            for (const fieldVal of fieldVals) {
                fields.push({
                    name: "-",
                    value: fieldVal
                });
            }

            // Send the formatted info
            return interaction.editReply({content: null, embeds: [{
                title: `${guild.name}'s Gear/ Relic summary`,
                fields: fields
            }]});
        }

        async function guildTickets(userID) {
            const momentDuration = require("moment-duration-format");
            momentDuration(moment);

            const sortBy = interaction.options.getString("sort");

            let rawGuild;
            try {
                rawGuild = await Bot.swgohAPI.getRawGuild(userID);
            } catch (err) {
                return interaction.editReply({content: err.toString()});
            }

            if (!rawGuild) return interaction.editReply({content: `Sorry, but I could not find a guild to match with ${userID}`});

            const out = [];
            let roster = null;
            if (sortBy === "tickets") {
                roster = rawGuild.roster.sort((a, b) => parseInt(a.memberContribution[2]?.currentValue, 10) > parseInt(b.memberContribution[2]?.currentValue, 10) ? 1 : -1);
            } else {
                roster = rawGuild.roster.sort((a, b) => a.playerName.toLowerCase() > b.playerName.toLowerCase() ? 1 : -1);
            }

            const dayMS = 86400000;
            let timeUntilReset = null;
            const chaTime = rawGuild.nextChallengesRefresh;
            const nowTime = moment().unix();
            if (chaTime > nowTime) {
                // It's in the future
                timeUntilReset = moment.duration(chaTime - nowTime, "seconds").format("h [hrs], m [min]");
            } else {
                // It's in the past, so calculate the next time
                const dur = parseInt(chaTime, 10) + parseInt(dayMS, 10) - parseInt(nowTime, 10);
                timeUntilReset = moment.duration(dur, "seconds").format("h [hrs], m [min]");
            }

            let maxed = 0;
            for (const member of roster) {
                const tickets = member.memberContribution["2"].currentValue;
                if (tickets < 600) {
                    out.push(Bot.expandSpaces(`\`${tickets.toString().padStart(3)}\` - ${"**" + member.playerName + "**"}`));
                } else {
                    maxed += 1;
                }
            }
            const footer = Bot.updatedFooter(rawGuild.updated, interaction, "guild", cooldown);
            const timeTilString = `***Time until reset: ${timeUntilReset}***\n\n`;
            const maxedString   = maxed > 0 ? `**${maxed}** members with 600 tickets\n\n` : "";
            return interaction.editReply({content: null, embeds: [{
                author: {
                    name: `${rawGuild.profile.name}'s Ticket Counts`
                },
                description: `${timeTilString}${maxedString}${out.join("\n")}`,
                footer: footer
            }]});
        }

        async function baseGuild() {
            const fields = [];
            let desc = guild.desc ? `**${interaction.language.get("COMMAND_GUILDS_DESC")}:**\n\`${guild.desc}\`\n` : "";
            desc += (guild.message && guild.message.length) ? `**${interaction.language.get("COMMAND_GUILDS_MSG")}:**\n\`${guild.message}\`` : "";

            const raidStr = interaction.language.get("COMMAND_GUILDS_RAID_STRINGS");
            let raids = "";

            if (guild.raid && Object.keys(guild.raid).length) {
                Object.keys(guild.raid).forEach(r => {
                    raids += `${raidStr[r]}${guild.raid[r].includes("HEROIC") ? raidStr.heroic : guild.raid[r].replace("DIFF0", "T")}\n`;
                });
            } else {
                raids = "No raids available";
            }

            fields.push({
                name: raidStr.header,
                value: Bot.codeBlock(raids),
                inline: true
            });

            let guildCharGP = 0;
            let guildShipGP = 0;
            guild.roster.forEach(m => {
                guildCharGP += m.gpChar;
                guildShipGP += m.gpShip;
            });
            const stats = interaction.language.get("COMMAND_GUILDS_STAT_STRINGS",
                guild.roster.length,
                guild.required,
                guild.gp.toLocaleString(),
                guildCharGP.toLocaleString(),
                guildShipGP.toLocaleString()
            );
            fields.push({
                name: interaction.language.get("COMMAND_GUILDS_STAT_HEADER"),
                value: Bot.codeBlock(stats),
                inline: true
            });

            fields.push({
                name: "-",
                value: interaction.language.get("COMMAND_GUILDS_FOOTER", interaction.guildSettings.prefix)
            });

            if (guild.warnings) {
                fields.push({
                    name: "Warnings",
                    value: guild.warnings.join("\n")
                });
            }

            const cooldown = await Bot.getPlayerCooldown(interaction.user.id);
            const footer = Bot.updatedFooter(guild.updated, interaction, "guild", cooldown);
            return interaction.editReply({content: null, embeds: [{
                author: {
                    name: guild.name
                },
                description: desc.length ? desc : "",
                fields: fields.length ? fields : [],
                footer: footer
            }]});
        }

        async function guildRoster() {
            const showAC = interaction.options.getBoolean("show_allycode");
            const showReg = interaction.options.getBoolean("registered");
            const sortBy = interaction.options.getString("sort");

            if (!guild.roster.length) {
                throw new Error(interaction.language.get("COMMAND_GUILDS_NO_GUILD"));
            }
            let sortedGuild;
            if (showAC || (sortBy && ["name", "rank"].includes(sortBy))) {
                sortedGuild = guild.roster.sort((p, c) => p.name.toLowerCase() > c.name.toLowerCase() ? 1 : -1);
            } else {
                sortedGuild = guild.roster.sort((p, c) => c.gp - p.gp);
            }

            const users = [];
            let badCount = 0;
            const gRanks = {
                2: "M",
                3: "O",
                4: "L"
            };
            for (const p of sortedGuild) {
                // Check if the player is registered, then bold the name if so
                if (!p.allyCode) {
                    badCount += 1;
                    continue;
                }
                const codes = await Bot.userReg.getUserFromAlly(p.allyCode);
                if (codes && codes.length) {
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
                p.memberLvl = p.guildMemberLevel ?  gRanks[p.guildMemberLevel] : null;
            }

            if (sortBy && sortBy === "rank") {
                const members = [];
                const officers = [];
                const leader = [];
                sortedGuild.forEach(p => {
                    if (p.memberLvl === "L") {
                        leader.push(p);
                    } else if (p.memberLvl === "O") {
                        officers.push(p);
                    } else {
                        members.push(p);
                    }
                });
                sortedGuild = leader.concat(officers).concat(members);
            }

            for (const p of sortedGuild) {
                if (showAC) {
                    if (p.inGuild) {
                        if (showReg) {
                            users.push(`\`[${p.allyCode}]\` - \`[${p.memberLvl}]\` **${p.name}** (<@!${p.dID}>)`);
                        } else {
                            users.push(`\`[${p.allyCode}]\` - \`[${p.memberLvl}]\` **${p.name}**`);
                        }
                    } else {
                        users.push(`\`[${p.allyCode}]\` - \`[${p.memberLvl}]\` ${p.name}`);
                    }
                } else {
                    if (p.inGuild) {
                        if (showReg) {
                            users.push(`\`[${" ".repeat(9 - p.gp.toLocaleString().length) + p.gp.toLocaleString()} GP]\` - **${p.name}** (<@!${p.dID}>)`);
                        } else {
                            users.push(`\`[${" ".repeat(9 - p.gp.toLocaleString().length) + p.gp.toLocaleString()} GP]\` - **${p.name}**`);
                        }
                    } else {
                        users.push(`\`[${" ".repeat(9 - p.gp.toLocaleString().length) + p.gp.toLocaleString()} GP]\` - ${p.name}`);
                    }
                }
            }
            const fields = [];
            const msgArray = Bot.msgArray(users, "\n", 1000);
            msgArray.forEach((m, ix) => {
                fields.push({
                    name: interaction.language.get("COMMAND_GUILDS_ROSTER_HEADER", ix+1, msgArray.length),
                    value: m
                });
            });
            fields.push({
                name: interaction.language.get("COMMAND_GUILDS_GUILD_GP_HEADER"),
                value: Bot.codeBlock(interaction.language.get("COMMAND_GUILDS_GUILD_GP", guild.gp.toLocaleString(), Math.floor(guild.gp/users.length).toLocaleString()))
            });
            if (badCount > 0) {
                guild.warnings = guild.warnings || [];
                guild.warnings.push(`Missing ${badCount} guild members`);
            }
            if (guild.warnings) {
                fields.push({
                    name: "Warnings",
                    value: guild.warnings.join("\n")
                });
            }
            const footer = Bot.updatedFooter(guild.updated, interaction, "guild", cooldown);
            return interaction.editReply({content: null, embeds: [{
                author: {
                    name: interaction.language.get("COMMAND_GUILDS_USERS_IN_GUILD", users.length, guild.name)
                },
                fields: fields,
                footer: footer
            }]});
        }

        async function twSummary() {
            const fields = [];
            const doExpand = interaction.options.getBoolean("expand");
            let gRoster ;
            if (!guild || !guild.roster || !guild.roster.length) {
                throw new Error(interaction.language.get("BASE_SWGOH_NO_GUILD"));
            } else {
                await interaction.editReply({content: `Found guild \`${guild.name}\`!`});
                gRoster = guild.roster.map(m => m.allyCode);
            }

            let guildMembers;
            try {
                guildMembers = await Bot.swgohAPI.unitStats(gRoster, cooldown);
            } catch (e) {
                Bot.logger.error("ERROR(GS) getting guild: " + e);
                return interaction.editReply({content: null, embeds: [{
                    description: Bot.codeBlock(e),
                    title: "Something Broke while getting your guild's characters",
                    footer: "Please try again in a bit."
                }]});
            }


            // Get overall stats for the guild
            const charArenaMembers = guildMembers.filter(m => m?.arena?.char?.rank);
            const charArenaAVG = (charArenaMembers.reduce((acc, curr) => acc + curr.arena.char.rank, 0) / charArenaMembers.length);
            const shipArenaMembers = guildMembers.filter(m => m?.arena?.ship?.rank);
            const shipArenaAVG = (shipArenaMembers.reduce((acc, curr) => acc + curr.arena.ship.rank, 0) / shipArenaMembers.length);
            let zetaCount = 0;
            for (const member of guildMembers) {
                const zetaRoster = member.roster
                    .map(char => char?.skills?.filter(s => s.isZeta && s.tier === s.tiers).length);
                zetaCount += zetaRoster.reduce((acc, curr) => acc + curr, 0);
            }
            fields.push({
                name: "General Stats",
                value: Bot.codeBlock([
                    `Members:        ${guild.roster.length}`,
                    `GP:             ${guild.gp.shortenNum()}`,
                    `AVG Char Arena: ${charArenaAVG.toFixed(2)}`,
                    `AVG Ship Arena: ${shipArenaAVG.toFixed(2)}`,
                    `Zetas:          ${zetaCount.toLocaleString()}`
                ].join("\n"))
            });

            // Get the overall gear levels for the guild as a whole
            const [gearLvls, avgGear] = Bot.summarizeGearLvls(guildMembers);
            fields.push({
                name: "Character Gear Counts",
                value: "*How many characters at each gear level*" +
                Bot.codeBlock(Object.keys(gearLvls)
                    .slice(doExpand ? 0 : -4)
                    .map(g => `G${g + " ".repeat(12-g.length)}:: ${" ".repeat(7-gearLvls[g].toLocaleString().length) + gearLvls[g].toLocaleString()}`).join("\n") +
                    `\nAVG Gear Lvl :: ${" ".repeat(7-avgGear.toString().length) + avgGear}`
                )
            });

            // Get the overall rarity levels for the guild as a whole
            const [rarityLvls, avgRarity] = Bot.summarizeRarityLvls(guildMembers);
            fields.push({
                name: "Character Rarity Counts",
                value: "*How many characters at each star level*" +
                Bot.codeBlock(Object.keys(rarityLvls).splice(doExpand ? 0 : -4).map(g => `${g}*           :: ${" ".repeat(7-rarityLvls[g].toLocaleString().length) + rarityLvls[g].toLocaleString()}`).join("\n") +
                    `\nAVG Star Lvl :: ${" ".repeat(7-avgRarity.toString().length) + avgRarity}`)
            });

            // Get the overall relic levels for the guild as a whole
            const relicLvls = {};
            const MAX_RELIC = 8;
            for (let ix = MAX_RELIC; ix >= 1; ix--) {
                let relicCount = 0;
                for (const member of guildMembers) {
                    relicCount += member.roster.filter(c => c && c.combatType === 1 && c.relic?.currentTier-2 === ix).length;
                }
                if (relicCount > 0) {
                    relicLvls[ix] = relicCount;
                }
            }
            const tieredRelic = Object.keys(relicLvls).reduce((acc, curr) => parseInt(acc, 10) + (relicLvls[curr] * curr), 0);
            const totalRelic = Object.keys(relicLvls).reduce((acc, curr) => parseInt(acc, 10) + relicLvls[curr]);
            const avgRelic = (tieredRelic / totalRelic);
            fields.push({
                name: "Character Relic Counts",
                value: "*How many characters at each relic tier*" +
                Bot.codeBlock(Object.keys(relicLvls).splice(doExpand ? 0 : -4).map(g => `R${g}            :: ${" ".repeat(7-relicLvls[g].toLocaleString().length) + relicLvls[g].toLocaleString()}`).join("\n") +
                    `\nAVG Relic Lvl :: ${" ".repeat(7-avgRelic.toFixed(2).toString().length) + avgRelic.toFixed(2)}`)
            });

            // Get general stats on how many of certain characters the guild has and at what gear
            // Possibly put this in the guildConf so guilds can have custom lists?
            const charOut = twCategoryFormat(charChecklist, gearLvls, 19, guildMembers, false);
            fields.push(...charOut.map(char => {
                return {
                    name: Bot.toProperCase(char.name),
                    value: char.value
                };
            }));

            const shipOut = twCategoryFormat(shipChecklist, gearLvls, 8, guildMembers, true);
            fields.push(...shipOut.map(ship => {
                return {
                    name: Bot.toProperCase(ship.name),
                    value: ship.value
                };
            }));

            if (guildMembers.warnings) {
                fields.push({
                    name: "Warnings",
                    value: guildMembers.warnings.join("\n")
                });
            }

            const footer = Bot.updatedFooter(Math.min(...guildMembers.map(m => m.updated)), interaction, "guild", cooldown);
            return interaction.editReply({content: null, embeds: [{
                author: {
                    name: interaction.language.get("COMMAND_GUILDS_TWS_HEADER", guild.name)
                },
                fields: fields,
                footer: footer
            }]});
        }
    }
}


function twCategoryFormat(unitObj, gearLvls, divLen, guildMembers, ships=false) {
    const fieldsOut = [];
    const [gear1, gear2] = Object.keys(gearLvls).map(num => parseInt(num, 10)).sort((a, b) => b - a);

    for (const category of Object.keys(unitObj)) {
        const unitOut = [];
        const unitListArray = unitObj[category];
        const longest = unitListArray.reduce((acc, curr) => Math.max(acc, curr[1].length), 0);
        const divider = `**\`${"=".repeat(divLen + longest)}\`**`;
        if (ships) {
            unitOut.push(`**\`${"Name" + " ".repeat(longest-4)}Total 7*\`**`);
        } else {
            if (category === "Galactic Legends") {
                unitOut.push(`**\`${"Name" + " ".repeat(longest-4)}Total G${gear1}  G${gear2}  Ult\`**`);
            } else {
                unitOut.push(`**\`${"Name" + " ".repeat(longest-4)}Total G${gear1}  G${gear2}   7*\`**`);
            }
        }
        unitOut.push(divider);

        for (const unit of unitListArray) {
            const defId = unit[0];
            const roster = guildMembers
                .filter(p => p.roster.find(c => c.defId === defId))
                .map(p => p.roster.find(c => c.defId === defId));

            let total = 0, g1 = 0, g2 = 0, ult = 0, sevenStar = 0;
            if (roster && roster.length) {
                total = roster.length;
                if (category === "Galactic Legends") {
                    ult = roster.filter(c => c && c.purchasedAbilityId.length).length;
                } else {
                    sevenStar = roster.filter(c => c && c.rarity === 7).length;
                }
                if (!ships) {
                    g1 = roster.filter(c => c && c.gear === gear1).length;
                    g2 = roster.filter(c => c && c.gear === gear2).length;
                }
            }
            const name = unit[1];
            if (category === "Galactic Legends") {
                unitOut.push(`\`${name + " ".repeat(longest-name.length)}  ${" ".repeat(2-total.toString().length) + total}   ${" ".repeat(2-g1.toString().length) + g1}   ${" ".repeat(2-g2.toString().length) + g2}   ${" ".repeat(2-ult.toString().length) + ult}\``);
            } else if (ships) {
                unitOut.push(`\`${name + " ".repeat(longest-name.length)}  ${" ".repeat(2-total.toString().length) + total}  ${" ".repeat(2-sevenStar.toString().length) + sevenStar}\``);
            }  else {
                unitOut.push(`\`${name + " ".repeat(longest-name.length)}  ${" ".repeat(2-total.toString().length) + total}   ${" ".repeat(2-g1.toString().length) + g1}   ${" ".repeat(2-g2.toString().length) + g2}   ${" ".repeat(2-sevenStar.toString().length) + sevenStar}\``);
            }
        }
        fieldsOut.push({
            name: category,
            value: unitOut.join("\n")
        });
    }
    return fieldsOut;
}

module.exports = Guilds;
