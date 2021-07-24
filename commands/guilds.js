const Command = require("../base/Command");
const moment = require("moment-timezone");
const {charChecklist, shipChecklist} = require("../data/unitChecklist");

class Guilds extends Command {
    constructor(Bot) {
        super(Bot, {
            name: "guilds",
            category: "SWGoH",
            aliases: ["guild", "g"],
            permissions: ["EMBED_LINKS"],
            flags: {
                "min": {
                    aliases: ["minimal", "minimize", "m"]
                },
                "roster": {
                    aliases: ["r"]
                },
                "a": {
                    aliases: ["allycodes", "allycode"]
                },
                "reg": {
                    aliases: []
                },
                tickets: {
                    aliases: ["t", "tic", "ticket"]
                },
                twsummary: {
                    aliases: ["tw"]
                },
                expand: {
                    aliases: ["ex", "expanded"]
                },
                relics: {
                    aliases: ["rel", "relic"]
                }
            },
            subArgs: {
                sort: {
                    aliases: []
                }
            }
        });
    }

    async run(Bot, message, [userID, ...args], options) { // eslint-disable-line no-unused-vars
        // Basic, with no args, shows the top ## guilds (Based on how many have registered)
        // <allyCode | mention | guildName >

        // Shows your guild's total GP, average GP, and a list of your members
        // Not trying to get any specific guild, show em the top ones
        let acType = true;
        if (!userID) {
            userID = "me";
        }

        const msg = await message.channel.send(message.language.get("COMMAND_GUILDS_PLEASE_WAIT"));

        // Get the user's ally code from the message or psql db
        if (userID === "me" || Bot.isUserID(userID) || Bot.isAllyCode(userID)) {
            userID = await Bot.getAllyCode(message, userID);
            if (!userID.length) {
                return super.error(msg, message.language.get("COMMAND_GUILDS_REG_NEEDED"), {edit: true, example: "guilds me"});
            }
            userID = userID[0];
        } else {
            // Or, if they don't have one of those, try getting the guild by name
            userID += args.length ? " " + args.join(" ") : "";
            acType = false;
        }

        const cooldown = await Bot.getPlayerCooldown(message.author.id);
        if (options.flags.tickets) {
            if (!acType || !userID) return super.error(message, `Cannot find a guild with ${userID}`);
            let rawGuild;
            try {
                rawGuild = await Bot.swgohAPI.getRawGuild(userID);
            } catch (err) {
                return super.error(message, "" + err);
            }
            if (!rawGuild) return super.error(message, "I could not get the info for your guild at this time.");
            return await guildTickets(userID, rawGuild);
        }

        let guild = null;
        try {
            if (acType) {
                guild = await Bot.swgohAPI.guild(userID, null, cooldown);
            } else {
                guild = await Bot.swgohAPI.guildByName(userID);
            }
        } catch (e) {
            return super.error(msg, Bot.codeBlock(e), {edit: true, example: "guilds me"});
        }

        if (!guild) {
            return super.error(msg, message.language.get("COMMAND_GUILDS_NO_GUILD"), {edit: true, example: "guilds me"});
        }

        if (options.flags.roster) {
            // Display the roster with gp etc
            try {
                await guildRoster();
            } catch (err) {
                return super.error(msg, err, {edit: true, example: "guilds me"});
            }
        } else if (options.flags.twsummary) {
            // Spit out a general summary of guild characters and such related to tw
            try {
                await twSummary();
            } catch (err) {
                return super.error(msg, err, {edit: true, example: "guilds me -twsumary"});
            }
        } else if (options.flags.relics) {
            try {
                await guildRelics();
            } catch (err) {
                return super.error(msg, err, {edit: true, example: "guilds me -relics"});
            }
        } else {
            // Show basic stats/ info about the guild
            await baseGuild();
        }

        async function guildRelics() {
            const members = [];

            // Make sure the guild roster exists, and grab all the ally codes
            let gRoster ;
            if (!guild || !guild.roster || !guild.roster.length) {
                throw new Error(message.language.get("BASE_SWGOH_NO_GUILD"));
            } else {
                msg.edit("Found guild `" + guild.name + "`!");
                gRoster = guild.roster.map(m => m.allyCode);
            }

            // Use the ally codes to get all the other info for the guild
            let guildMembers;
            try {
                guildMembers = await Bot.swgohAPI.unitStats(gRoster, cooldown);
            } catch (e) {
                Bot.logger.error("ERROR(GS) getting guild: " + e);
                return msg.edit(Bot.codeBlock(e), {
                    title: "Something Broke while getting your guild's characters",
                    footer: "Please try again in a bit."
                });
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
            return message.channel.send({embed: {
                title: `${guild.name}'s Gear/ Relic summary`,
                fields: fields
            }});
        }

        async function guildTickets(userID, rawGuild) {
            const momentDuration = require("moment-duration-format");
            momentDuration(moment);
            if (!rawGuild) return msg.edit(`Sorry, but I could not find a guild to match with ${userID}`);

            const out = [];
            let roster = null;
            if (["tic", "ticket", "tickets"].indexOf(options.subArgs.sort) > -1) {
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
            const footer = Bot.updatedFooter(rawGuild.updated, message, "guild", cooldown);
            const timeTilString = `***Time until reset: ${timeUntilReset}***\n\n`;
            const maxedString   = maxed > 0 ? `**${maxed}** members with 600 tickets\n\n` : "";
            return message.channel.send({embed: {
                author: {
                    name: `${rawGuild.profile.name}'s Ticket Counts`
                },
                description: `${timeTilString}${maxedString}${out.join("\n")}`,
                footer: footer
            }});
        }

        async function baseGuild() {
            const fields = [];
            let desc = guild.desc ? `**${message.language.get("COMMAND_GUILDS_DESC")}:**\n\`${guild.desc}\`\n` : "";
            desc += (guild.message && guild.message.length) ? `**${message.language.get("COMMAND_GUILDS_MSG")}:**\n\`${guild.message}\`` : "";

            const raidStr = message.language.get("COMMAND_GUILDS_RAID_STRINGS");
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
            const stats = message.language.get("COMMAND_GUILDS_STAT_STRINGS",
                guild.roster.length,
                guild.required,
                guild.gp.toLocaleString(),
                guildCharGP.toLocaleString(),
                guildShipGP.toLocaleString()
            );
            fields.push({
                name: message.language.get("COMMAND_GUILDS_STAT_HEADER"),
                value: Bot.codeBlock(stats),
                inline: true
            });

            fields.push({
                name: "-",
                value: message.language.get("COMMAND_GUILDS_FOOTER", message.guildSettings.prefix)
            });

            if (options.defaults) {
                fields.push({
                    name: "Default flags used:",
                    value: Bot.codeBlock(options.defaults)
                });
            }
            if (guild.warnings) {
                fields.push({
                    name: "Warnings",
                    value: guild.warnings.join("\n")
                });
            }

            const cooldown = await Bot.getPlayerCooldown(message.author.id);
            const footer = Bot.updatedFooter(guild.updated, message, "guild", cooldown);
            return msg.edit({embed: {
                author: {
                    name: guild.name
                },
                description: desc.length ? desc : "",
                fields: fields.length ? fields : [],
                footer: footer
            }});
        }

        async function guildRoster() {
            if (!guild.roster.length) {
                throw new Error(message.language.get("COMMAND_GUILDS_NO_GUILD"));
            }
            let sortedGuild;
            if (options.flags.a || (options.subArgs.sort && ["name", "rank"].indexOf(options.subArgs.sort.toLowerCase()) > -1)) {
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
                        const mem = await message.guild?.members.fetch(c.id).catch(() => {});
                        if (message.guild && mem) {
                            p.inGuild = true;
                            p.dID = c.id;
                            break;
                        }
                    }
                }
                p.memberLvl = p.guildMemberLevel ?  gRanks[p.guildMemberLevel] : null;
            }

            if (options.subArgs.sort && options.subArgs.sort.toLowerCase() === "rank") {
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
                if (options.flags.a) {
                    if (p.inGuild) {
                        if (options.flags.reg) {
                            users.push(`\`[${p.allyCode}]\` - \`[${p.memberLvl}]\` **${p.name}** (<@!${p.dID}>)`);
                        } else {
                            users.push(`\`[${p.allyCode}]\` - \`[${p.memberLvl}]\` **${p.name}**`);
                        }
                    } else {
                        users.push(`\`[${p.allyCode}]\` - \`[${p.memberLvl}]\` ${p.name}`);
                    }
                } else {
                    if (p.inGuild) {
                        if (options.flags.reg) {
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
            if (!options.flags.min) {
                const msgArray = Bot.msgArray(users, "\n", 1000);
                msgArray.forEach((m, ix) => {
                    fields.push({
                        name: message.language.get("COMMAND_GUILDS_ROSTER_HEADER", ix+1, msgArray.length),
                        value: m
                    });
                });
            }
            fields.push({
                name: message.language.get("COMMAND_GUILDS_GUILD_GP_HEADER"),
                value: Bot.codeBlock(message.language.get("COMMAND_GUILDS_GUILD_GP", guild.gp.toLocaleString(), Math.floor(guild.gp/users.length).toLocaleString()))
            });
            if (options.defaults) {
                fields.push({
                    name: "Default flags used:",
                    value: Bot.codeBlock(options.defaults)
                });
            }
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
            const footer = Bot.updatedFooter(guild.updated, message, "guild", cooldown);
            await msg.delete().catch(Bot.noop);
            return message.channel.send({embed: {
                author: {
                    name: message.language.get("COMMAND_GUILDS_USERS_IN_GUILD", users.length, guild.name)
                },
                fields: fields,
                footer: footer
            }});
        }

        async function twSummary() {
            const fields = [];
            let gRoster ;
            if (!guild || !guild.roster || !guild.roster.length) {
                throw new Error(message.language.get("BASE_SWGOH_NO_GUILD"));
            } else {
                msg.edit("Found guild `" + guild.name + "`!");
                gRoster = guild.roster.map(m => m.allyCode);
            }

            let guildMembers;
            try {
                guildMembers = await Bot.swgohAPI.unitStats(gRoster, cooldown);
            } catch (e) {
                Bot.logger.error("ERROR(GS) getting guild: " + e);
                return msg.edit(Bot.codeBlock(e), {
                    title: "Something Broke while getting your guild's characters",
                    footer: "Please try again in a bit."
                });
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
                    .slice(options.flags.expand ? 0 : -4)
                    .map(g => `G${g + " ".repeat(12-g.length)}:: ${" ".repeat(7-gearLvls[g].toLocaleString().length) + gearLvls[g].toLocaleString()}`).join("\n") +
                    `\nAVG Gear Lvl :: ${" ".repeat(7-avgGear.toString().length) + avgGear}`
                )
            });

            // Get the overall rarity levels for the guild as a whole
            const [rarityLvls, avgRarity] = Bot.summarizeRarityLvls(guildMembers);
            fields.push({
                name: "Character Rarity Counts",
                value: "*How many characters at each star level*" +
                Bot.codeBlock(Object.keys(rarityLvls).splice(options.flags.expand ? 0 : -4).map(g => `${g}*           :: ${" ".repeat(7-rarityLvls[g].toLocaleString().length) + rarityLvls[g].toLocaleString()}`).join("\n") +
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
                Bot.codeBlock(Object.keys(relicLvls).splice(options.flags.expand ? 0 : -4).map(g => `R${g}            :: ${" ".repeat(7-relicLvls[g].toLocaleString().length) + relicLvls[g].toLocaleString()}`).join("\n") +
                    `\nAVG Relic Lvl :: ${" ".repeat(7-avgRelic.toFixed(2).toString().length) + avgRelic.toFixed(2)}`)
            });

            // Get general stats on how many of certain characters the guild has and at what gear
            // Possibly put this in the guildConf so guilds can have custom lists?
            const charOut = twCategoryFormat(charChecklist, gearLvls, 19, guildMembers, false);
            fields.push(...charOut);

            const shipOut = twCategoryFormat(shipChecklist, gearLvls, 8, guildMembers, true);
            fields.push(...shipOut);

            if (options.defaults) {
                fields.push({
                    name: "Default flags used:",
                    value: Bot.codeBlock(options.defaults)
                });
            }
            if (guildMembers.warnings) {
                fields.push({
                    name: "Warnings",
                    value: guildMembers.warnings.join("\n")
                });
            }

            const footer = Bot.updatedFooter(Math.min(...guildMembers.map(m => m.updated)), message, "guild", cooldown);
            await msg.delete().catch(Bot.noop);
            return message.channel.send({embed: {
                author: {
                    name: message.language.get("COMMAND_GUILDS_TWS_HEADER", guild.name)
                },
                fields: fields,
                footer: footer
            }});
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
            name: category.toProperCase(),
            value: unitOut.join("\n")
        });
    }
    return fieldsOut;
}

module.exports = Guilds;
