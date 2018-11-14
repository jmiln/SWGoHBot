const Command = require("../base/Command");

class Guilds extends Command {
    constructor(client) {
        super(client, {
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
                    aliases: [],
                    default: "gp"
                }
            }
        });
    }

    async run(client, message, [userID, ...args], options) { // eslint-disable-line no-unused-vars
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
        if (userID === "me" || client.isUserID(userID) || client.isAllyCode(userID)) {
            userID = await client.getAllyCode(message, userID);
            if (!userID.length) {
                return msg.edit(message.language.get("COMMAND_GUILDS_REG_NEEDED"));
            }
            userID = userID[0];
        } else {
            // Or, if they don't have one of those, try getting the guild by name
            userID += args.length ? " " + args.join(" ") : "";
            acType = false;
            // return msg.edit("I currently do not support looking up guilds by name, please use an ally code, or mention someone that has registered.");
        }

        const cooldown = client.getPlayerCooldown(message.author.id);
        let guild = null;
        try {
            if (acType) {
                guild = await client.swgohAPI.guild(userID, null, cooldown);
            } else {
                guild = await client.swgohAPI.guildByName(userID);
            }
        } catch (e) {
            console.log("ERROR(guilds): " + e);
            return msg.edit("Error: " + client.codeBlock(e));
        }

        if (!guild) {
            return msg.edit(message.language.get("COMMAND_GUILDS_NO_GUILD"));
        } 

        if (options.flags.roster) {
            // Display the roster with gp etc
            if (!guild.roster.length) {
                return msg.edit(message.language.get("COMMAND_GUILDS_NO_GUILD"));
            }
            let sortedGuild;
            if (options.flags.a || options.subArgs.sort.toLowerCase() === "name") {
                sortedGuild = guild.roster.sort((p, c) => p.name.toLowerCase() > c.name.toLowerCase() ? 1 : -1);
            } else {
                sortedGuild = guild.roster.sort((p, c) => c.gp - p.gp);
            }

            const users = [];
            for (const p of sortedGuild) {
                // Check if the player is registered, then bold the name if so
                const exists = await client.database.models.allyCodes.findOne({where: {allyCode: p.allyCode}})
                    .then(token => token !== null)
                    .then(isUnique => isUnique);
                if (exists) {
                    const codes = await client.database.models.allyCodes.findAll({where: {allyCode: p.allyCode}});
                    for (const c of codes) {
                        // Make sure they're in the same server
                        if (message.guild && message.guild.members.has(c.id)) {
                            p.inGuild = true;
                            p.dID = c.id;
                            break;
                        }
                    }                    
                } 
                if (options.flags.a) {
                    if (p.inGuild) {
                        if (options.flags.reg) {
                            users.push(`\`[${p.allyCode}]\` - **${p.name}** (<@!${p.dID}>)`);
                        } else {
                            users.push(`\`[${p.allyCode}]\` - **${p.name}**`);
                        }
                    } else {
                        users.push(`\`[${p.allyCode}]\` - ${p.name}`);
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
                const msgArray = client.msgArray(users, "\n", 1000);
                msgArray.forEach((m, ix) => {
                    fields.push({
                        name: message.language.get("COMMAND_GUILDS_ROSTER_HEADER", ix+1, msgArray.length),
                        value: m
                    });
                });
            }
            fields.push({
                name: message.language.get("COMMAND_GUILDS_GUILD_GP_HEADER"),
                value: client.codeBlock(message.language.get("COMMAND_GUILDS_GUILD_GP", guild.gp.toLocaleString(), Math.floor(guild.gp/users.length).toLocaleString()))
            });
            const footer = client.updatedFooter(guild.updated, message, "guild", cooldown);
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
                return msg.edit(message.language.get("BASE_SWGOH_NO_GUILD"));
            } else {
                msg.edit("Found guild `" + guild.name + "`!");
                gRoster = guild.roster.map(m => m.allyCode);
            }

            let guildGG;
            try {
                guildGG = await client.swgohAPI.guildGG(gRoster, null, cooldown);
            } catch (e) {
                console.log("ERROR(GS) getting guild: " + e); 
                return message.channel.send({embed: {
                    author: {
                        name: "Something Broke while getting your guild's characters"
                    },  
                    description: client.codeBlock(e) + "Please try again in a bit."
                }});
            }
            // Possibly put this in the guildConf so guilds can have custom lists?
            const guildChecklist = [
                "Light Side",
                ["COMMANDERLUKESKYWALKER",  "CLS"],
                ["R2D2_LEGENDARY",          "R2-D2"],
                ["HANSOLO",                 "Han Solo"],
                ["REYJEDITRAINING",         "Rey (JT)"],
                ["BB8",                     "BB-8"],
                
                ["JEDIKNIGHTREVAN",         "Jedi Revan"],
                ["BASTILASHAN",             "Bastila"],
                ["GENERALKENOBI",           "Gen. Kenobi"],
                ["GRANDMASTERYODA",         "GM Yoda"],
                ["HERMITYODA",              "Hermit Yoda"],

                ["ENFYSNEST",               "Enfys Nest"],

                "Dark Side",
                ["BOSSK",                   "Bossk"],
                ["MAUL",                    "Darth Maul"],
                ["DARTHSION",               "Darth Sion"],
                ["DARTHTRAYA",              "Darth Traya"],
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
                ["CAPITALMONCALAMARICRUISER", "Home One"]
            ];

            const allNames = guildChecklist.map(c => c[1]);
            const longest = allNames.reduce((long, str) => Math.max(long, str.length), 0);

            let charOut = [];
            charOut.push(`**\`${"Name" + " ".repeat(longest-4)}Total G12  G11   7*\`**`);
            charOut.push("**`==============================`**");
            guildChecklist.forEach((char, ix) => {
                if (Array.isArray(char)) {
                    const roster = guildGG.roster[char[0]];
                    const total = roster.length;
                    const g12 = roster.filter(c => c.gearLevel === 12).length;
                    const g11 = roster.filter(c => c.gearLevel === 11).length;
                    const sevenStar = roster.filter(c => c.starLevel === 7).length;
                    const name = allNames[ix];
                    charOut.push(`\`${name + " ".repeat(longest-name.length)}  ${" ".repeat(2-total.toString().length) + total}   ${" ".repeat(2-g12.toString().length) + g12}   ${" ".repeat(2-g11.toString().length) + g11}   ${" ".repeat(2-sevenStar.toString().length) + sevenStar}\``);
                } else {
                    charOut.push(`\n**${char}**`);
                }
            });
            charOut = charOut.map(c => client.expandSpaces(c));
            const footer = client.updatedFooter(guild.updated, message, "guild", cooldown);
            return msg.edit({embed: {
                author: {
                    name: guild.name + "'s Territory War Summary"
                },
                description: charOut.join("\n"),
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
                value: client.codeBlock(raids),
                inline: true
            });
    
            const stats = message.language.get("COMMAND_GUILDS_STAT_STRINGS", guild.members, guild.required, guild.gp.toLocaleString());
            fields.push({
                name: message.language.get("COMMAND_GUILDS_STAT_HEADER"),
                value: client.codeBlock(stats),
                inline: true
            });

            fields.push({
                name: "-",
                value: message.language.get("COMMAND_GUILDS_FOOTER", message.guildSettings.prefix)
            });
            const footer = client.updatedFooter(guild.updated, message, "guild", cooldown);
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

