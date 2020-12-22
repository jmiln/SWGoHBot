const Command = require("../base/Command");

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
                twsummary: {
                    aliases: ["tw"]
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
            if (!guild.roster.length) {
                return super.error(msg, (message.language.get("COMMAND_GUILDS_NO_GUILD")), {edit: true, example: "guilds me"});
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
            return msg.edit({embed: {
                author: {
                    name: message.language.get("COMMAND_GUILDS_USERS_IN_GUILD", users.length, guild.name)
                },
                fields: fields,
                footer: footer
            }});
        } else if (options.flags.twsummary) {
            // Spit out a general summary of guild characters and such related to tw
            let gRoster ;
            if (!guild || !guild.roster || !guild.roster.length) {
                return super.error(msg, (message.language.get("BASE_SWGOH_NO_GUILD")), {edit: true, example: "guilds me -twsumary"});
            } else {
                msg.edit("Found guild `" + guild.name + "`!");
                gRoster = guild.roster.map(m => m.allyCode);
            }

            let guildMembers;
            try {
                guildMembers = await Bot.swgohAPI.unitStats(gRoster, cooldown);
            } catch (e) {
                Bot.logger.error("ERROR(GS) getting guild: " + e);
                return super.error(message, Bot.codeBlock(e), {
                    title: "Something Broke while getting your guild's characters",
                    footer: "Please try again in a bit."
                });
            }
            // Possibly put this in the guildConf so guilds can have custom lists?
            const guildChecklist = [
                "Light Side",
                ["BASTILASHAN",             "Bastila"],
                ["BB8",                     "BB-8"],
                ["C3POLEGENDARY",           "C-3PO"],
                ["COMMANDERLUKESKYWALKER",  "CLS"],
                ["ENFYSNEST",               "Enfys Nest"],
                ["GENERALKENOBI",           "Gen. Kenobi"],
                ["GRANDMASTERYODA",         "GM Yoda"],
                ["HANSOLO",                 "Han Solo"],
                ["HERMITYODA",              "Hermit Yoda"],
                ["JEDIKNIGHTREVAN",         "Jedi Revan"],
                ["R2D2_LEGENDARY",          "R2-D2"],
                ["REYJEDITRAINING",         "Rey (JT)"],

                "Dark Side",
                ["BOSSK",                   "Bossk"],
                ["MAUL",                    "Darth Maul"],
                ["DARTHMALAK",              "Darth Malak"],
                ["DARTHREVAN",              "Darth Revan"],
                ["DARTHSION",               "Darth Sion"],
                ["DARTHTRAYA",              "Darth Traya"],
                ["GRIEVOUS",                "Gen Grievous"],
                ["KYLORENUNMASKED",         "Kylo Unmask"],
                ["VEERS",                   "Gen. Veers"],
                ["EMPERORPALPATINE",        "Palpatine"],
                ["MOTHERTALZIN",            "Talzin"],
                ["GRANDADMIRALTHRAWN",      "Thrawn"],
                ["WAMPA",                   "Wampa"],

                "Ships",
                ["CAPITALCHIMAERA",         "Chimaera"],
                ["CAPITALJEDICRUISER",      "Endurance"],
                ["CAPITALSTARDESTROYER",    "Executrix"],
                ["CAPITALMONCALAMARICRUISER", "Home One"],
                ["CAPITALMALEVOLENCE",      "Malevolence"],
                ["CAPITALFINALIZER",        "Finalizer"],
                ["CAPITALRADDUS",           "Raddus"]
            ];

            const allNames = guildChecklist.map(c => c[1]);
            const longest = allNames.reduce((long, str) => Math.max(long, str.length), 0);

            let charOut = [];
            charOut.push(`**\`${"Name" + " ".repeat(longest-4)}Total G12  G11   7*\`**`);
            charOut.push("**`==============================`**");
            guildChecklist.forEach((char, ix) => {
                if (Array.isArray(char)) {
                    const defId = char[0];
                    const roster = guildMembers.filter(p => p.roster.find(c => c.defId === defId)).map(p => p.roster.find(c => c.defId === defId));
                    let total = 0, g12 = 0, g11 = 0, sevenStar = 0;
                    if (roster && roster.length) {
                        total = roster.length;
                        g12 = roster.filter(c => c && c.gear === 12).length;
                        g11 = roster.filter(c => c && c.gear === 11).length;
                        sevenStar = roster.filter(c => c && c.rarity === 7).length;
                    }
                    const name = allNames[ix];
                    charOut.push(`\`${name + " ".repeat(longest-name.length)}  ${" ".repeat(2-total.toString().length) + total}   ${" ".repeat(2-g12.toString().length) + g12}   ${" ".repeat(2-g11.toString().length) + g11}   ${" ".repeat(2-sevenStar.toString().length) + sevenStar}\``);
                } else {
                    charOut.push(`\n**${char}**`);
                }
            });
            charOut = charOut.map(c => Bot.expandSpaces(c));

            const fields = [];

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
            const footer = Bot.updatedFooter(guildMembers.updated, message, "guild", cooldown);
            return msg.edit({embed: {
                author: {
                    name: message.language.get("COMMAND_GUILDS_TWS_HEADER", guild.name)
                },
                description: charOut.join("\n"),
                fields: fields,
                footer: footer
            }});
        } else {
            // Show basic stats. info about the guild
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
                guild.members,
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
    }
}

module.exports = Guilds;
