const Command = require("../base/Command");
// const {inspect} = require('util');

class GuildSearch extends Command {
    constructor(client) {
        super(client, {
            name: "guildsearch",
            category: "SWGoH",
            aliases: ["search", "gs"],
            permissions: ["EMBED_LINKS"],
            flags: {
                "ships": {
                    aliases: ["s", "ship"]
                },
                reverse: {
                    aliases: ["rev"]
                },
            },
            subArgs: {
                stat: {
                    aliases: ["stats"],
                    default: "name"
                }
            }
        });
    }

    async run(client, message, args, options) { // eslint-disable-line no-unused-vars
        let starLvl = 0;
        const sortType = options.subArgs.sort ? options.subArgs.sort.toLowerCase() : "name";
        const reverse = options.flags.reverse;
        const rarityMap = {
            "ONESTAR": 1,
            "TWOSTAR": 2,
            "THREESTAR": 3,
            "FOURSTAR": 4,
            "FIVESTAR": 5,
            "SIXSTAR": 6,
            "SEVENSTAR": 7
        };

        // If there's enough elements in args, and it's in the format of a number*
        if (args.length && !isNaN(parseInt(args[args.length-1]))) {
            starLvl = parseInt(args.pop());
            if (starLvl < 0 || starLvl > 7) {
                return message.channel.send(message.language.get("COMMAND_GUILDSEARCH_BAD_STAR"));
            }
        }
        
        const {allyCode, searchChar, err} = await super.getUserAndChar(message, args);

        if (err) {
            return message.channel.send("**Error:** `" + err + "`");
        }

        if (options.flags.ships && options.flags.stats) {
            // TODO Lang this
            return message.channel.send("Sorry, but I cannot get the stats for ships at this time.");
        }
        
        const chars = !options.flags.ships ? client.findChar(searchChar, client.characters) : client.findChar(searchChar, client.ships, true);
        
        let character;
        
        if (chars.length === 0) {
            return message.channel.send(message.language.get("COMMAND_GUILDSEARCH_NO_RESULTS", searchChar));
        } else if (chars.length > 1) {
            const charL = [];
            const charS = chars.sort((p, c) => p.name > c.name ? 1 : -1);
            charS.forEach(c => {
                charL.push(c.name);
            });
            return message.channel.send(message.language.get("COMMAND_GUILDSEARCH_CHAR_LIST", charL.join("\n")));
        } else {
            character = chars[0];
        }

        const msg = await message.channel.send(message.language.get("COMMAND_GUILDSEARCH_PLEASE_WAIT"));

        const cooldown = client.getPlayerCooldown(message.author.id);

        if (!options.subArgs.stat) {
            let guild = null;
            try {
                guild = await client.swgohAPI.guild(allyCode, null, cooldown);
            } catch (e) {
                console.log("ERROR(GS) getting guild: " + e);
                return message.channel.send({embed: {
                    author: {
                        name: "Something Broke getting your guild's roster"
                    },
                    description: client.codeBlock(e) + "Please try again in a bit."
                }});
            }
            let gRoster;
            if (!guild || !guild.roster || !guild.roster.length) {
                return msg.edit(message.language.get("BASE_SWGOH_NO_GUILD"));
            } else {
                msg.edit("Found guild `" + guild.name + "`!");
                gRoster = guild.roster.sort((a, b) => a.name.toLowerCase() > b.name.toLowerCase() ? 1 : -1).map(m => m.allyCode);
            }

            if (!gRoster.length) {
                return msg.edit("I can't find any players in the requested guild.");
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

            // Get the list of people with that character
            const guildChar = guildGG.roster[character.uniqueName];

            if (!guildChar || guildChar.length === 0) {
                return msg.edit({embed: {
                    author: {
                        name: message.language.get("BASE_SWGOH_NAMECHAR_HEADER", guild.name, character.name)
                    },
                    description: message.language.get("COMMAND_GUILDSEARCH_NO_CHARACTER"),
                    footer: {
                        text: message.language.get("BASE_SWGOH_LAST_UPDATED", client.duration(guild.updated, message))
                    }
                }});
            }

            const totalUnlocked = guildChar.length;

            // Fill in everyone that does not have it since everyone is guaranteed to have jedi consular
            guildGG.roster["JEDIKNIGHTCONSULAR"].forEach(j => {
                // If they have both the targeted character and consular, ignore them
                const filtered = guildChar.filter(p => p.player === j.player);

                // If they don't, it'll be a 0 length array, so fill it in with 0 stats
                if (!filtered.length) {
                    guildChar.push({
                        player: j.player,       // Player name
                        allyCode: j.allyCode,   // Ally code
                        gearLevel: 0,
                        gp: 0,
                        level: 0,
                        starLevel: 0,
                        zetas: [],
                        gear: [],
                        type: j.type
                    });
                }
            });

            // Can get the order from abilities table => skillReferenceList
            let maxZ = 0;
            const zetas = [];
            const apiChar = await client.swgohAPI.getCharacter(character.uniqueName);
            for (const ab of apiChar.skillReferenceList) {
                if (ab.cost && ab.cost.AbilityMatZeta > 0) {
                    maxZ = maxZ + 1;
                    zetas.push(ab.skillId);
                }
            }

            let sortedGuild = [];
            if (sortType === "name") {
                // Sort by name
                if (!reverse) {
                    sortedGuild = guildChar.sort((p, c) => p.player.toLowerCase() > c.player.toLowerCase() ? 1 : -1);
                } else {
                    sortedGuild = guildChar.sort((p, c) => p.player.toLowerCase() < c.player.toLowerCase() ? 1 : -1);
                }
            } else if (sortType === "gp") {
                // Sort by gp
                if (!reverse) {
                    sortedGuild = guildChar.sort((p, c) => p.gp - c.gp);
                } else {
                    sortedGuild = guildChar.sort((p, c) => c.gp - p.gp);
                }
            } else if (sortType === "gear") {
                // Sort by gear
                if (!reverse) {
                    sortedGuild = guildChar.sort((p, c) => p.gearLevel - c.gearLevel);
                } else {
                    sortedGuild = guildChar.sort((p, c) => c.gearLevel - p.gearLevel);
                }
            } else {
                return msg.edit(message.language.get("COMMAND_GUILDSEARCH_BAD_SORT", sortType, ["name", "gp"]));
            }

            const charOut = {};
            for (const member of sortedGuild) {
                if (isNaN(parseInt(member.starLevel))) member.starLevel = rarityMap[member.starLevel];
                const gearStr = "⚙" + member.gearLevel + " ".repeat(2 - member.gearLevel.toString().length);
                let z = " | ";
                zetas.forEach((zeta, ix) => {
                    const pZeta = member.zetas.find(pz => pz.id === zeta);
                    if (!pZeta) {
                        z += " ";
                    } else {
                        z += (ix + 1).toString();
                    }
                });
                const gpStr = parseInt(member.gp).toLocaleString();

                let uStr;
                if (member.starLevel > 0) {
                    if (options.flags.ships) {
                        uStr = `**\`[Lvl ${member.level} | ${gpStr + " ".repeat(6 - gpStr.length)}${maxZ > 0 ? z : ""}]\`** ${member.player}`;
                    } else {
                        uStr = `**\`[${gearStr} | ${gpStr + " ".repeat(6 - gpStr.length)}${maxZ > 0 ? z : ""}]\`** ${member.player}`;
                    }
                } else {
                    uStr = member.player;
                }

                uStr = client.expandSpaces(uStr);

                if (!charOut[member.starLevel]) {
                    charOut[member.starLevel] = [uStr];
                } else {
                    charOut[member.starLevel].push(uStr);
                }
            }

            const fields = [];
            const outArr = reverse ? Object.keys(charOut).reverse() : Object.keys(charOut);
            outArr.forEach(star => {
                if (star >= starLvl) {
                    const msgArr = client.msgArray(charOut[star], "\n", 1000);
                    msgArr.forEach((msg, ix) => {
                        const name = star === 0 ? message.language.get("COMMAND_GUILDSEARCH_NOT_ACTIVATED", charOut[star].length) : message.language.get("COMMAND_GUILDSEARCH_STAR_HEADER", star, charOut[star].length);
                        fields.push({
                            name: msgArr.length > 1 ? name + ` (${ix+1}/${msgArr.length})` : name,
                            value: msgArr[ix]
                        });
                    });
                }
            });
            if (guild.warnings) {
                fields.push({
                    name: "Guild Roster Warnings",
                    value: guild.warnings.join("\n")
                });
            }
            if (guildGG.warnings) {
                fields.push({
                    name: "Guild Character Warnings",
                    value: guildGG.warnings.join("\n")
                });
            }

            const footer = client.updatedFooter(guildGG.updated, message, "guild", cooldown);
            msg.edit({embed: {
                author: {
                    name: message.language.get("BASE_SWGOH_NAMECHAR_HEADER_NUM", guild.name, character.name, totalUnlocked)
                },
                fields: fields,
                footer: footer
            }});
        } else {
            // Looking for a stat
            const outArr = [];

            const checkableStats = { 
                "Health": {
                    aliases: ["HP"],
                    short: "HP"
                },   
                "Protection": {
                    aliases: ["Prot"],
                    short: "Prot"
                },   
                "Speed": {
                    aliases: ["spd"],
                    short: "Spd"
                },   
                "Potency": {
                    aliases: ["Pot"],
                    short: "Pot"
                },   
                "Physical Critical Chance": {
                    aliases: ["PCC", "CC", "Crit Chance", "Critical Chance", "Physical Crit Chance"], 
                    short: "CC"
                },   
                "Special Critical Chance": {
                    aliases: ["SCC", "Special Crit Chance"],
                    short: "CC"
                },   
                "Critical Damage": {
                    aliases: ["CD", "Crit Damage"],
                    short: "CD"
                },   
                "Tenacity": {
                    aliases: ["Ten"],
                    short: "Ten"
                },   
                "Accuracy": {
                    aliases: ["Acc"],
                    short: "Acc"
                },   
                "Armor": {
                    aliases: ["arm"],
                    short: "Arm"
                },   
                "Resistance": {
                    aliases: ["Res", "Resist"],
                    short: "Res"
                }       
            }; 


            let found = false;
            let sortBy = options.subArgs.stat;
            const stat = Object.keys(checkableStats).filter(s => s.toLowerCase().replace(/\s/gi, "") === sortBy.toLowerCase());
            if (stat && stat.length) {
                sortBy = stat[0];
                found = true;
            } else {
                Object.keys(checkableStats).forEach(s => {
                    if (checkableStats[s].aliases.find(c => c.toLowerCase().replace(" ", "") === sortBy.toLowerCase())) {
                        sortBy = s;
                        found = true;
                        return;
                    }
                });
            }

            if (!found) {
                return msg.edit("Not an acceptable stat to sort by. Try one of the following:" + client.codeBlock(Object.keys(checkableStats).map(s => s.replace(/\s/gi, "")).join(", ")));
            }

            let guild = null;
            try {
                guild = await client.swgohAPI.guild(allyCode, null, cooldown);
            } catch (e) {
                console.log("ERROR(GS) getting guild: " + e);
                return message.channel.send({embed: {
                    author: {
                        name: "Something Broke getting your guild's roster"
                    },
                    description: client.codeBlock(e) + "Please try again in a bit."
                }});
            }
            let gRoster;
            if (!guild || !guild.roster || !guild.roster.length) {
                return msg.edit(message.language.get("BASE_SWGOH_NO_GUILD"));
            } else {
                msg.edit("Found guild `" + guild.name + "`!");
                gRoster = guild.roster.sort((a, b) => a.name.toLowerCase() > b.name.toLowerCase() ? 1 : -1).map(m => m.allyCode);
            }

            if (!gRoster.length) {
                return msg.edit("I can't find any players in the requested guild.");
            }
            const gStats = await client.swgohAPI.guildStats(gRoster, character.uniqueName, cooldown);

            const sortedMembers = gStats.sort((a, b) => a.stats.final[sortBy] < b.stats.final[sortBy] ? 1 : -1);


            sortedMembers.forEach( member => {
                const stats = member.stats.final;
                Object.keys(stats).forEach(s => {
                    if (stats[s] % 1 !== 0) {
                        // Probably a percentage
                        stats[s] = (stats[s] * 100).toFixed(2) + "%";
                    } else {
                        stats[s] = stats[s].toLocaleString();
                    }
                });
                stats.player = guild.roster.find(m => m.allyCode === member.allyCode).name;
                stats.gp = member.unit.gp.toLocaleString();
                stats.gear = member.unit.gear;
                if (!stats.Protection) stats.Protection = 0;
                outArr.push(stats);
            });

            const fields = []; 
            if (!outArr.length) {
                fields.push({
                    name: character.name,
                    value: message.language.get("COMMAND_GUILDSEARCH_NO_CHARACTER")
                });
            } else {
                const header = {
                    gear: {value: "Gear", startWith: "`[", endWith: "|", align: "right"},
                    gp: {value: "GP", endWith: "|", align: "right"}
                };
                header[sortBy] = {value: checkableStats[sortBy].short, endWith: "]`", align: "right"};
                header.player = {value:"", align: "left"};

                const outTable = client.makeTable(header, outArr);

                if (outArr.length) {
                    const outMsgArr = client.msgArray(outTable, "\n", 1000);
                    outMsgArr.forEach((m, ix) => {
                        const name = (ix === 0) ? `${character.name} (Sorted by ${sortBy})` : message.language.get("BASE_CONT_STRING");
                        fields.push({
                            name: name,
                            value: m
                        });
                    });
                } else {
                    fields.push({
                        name: "-",
                        value: message.language.get("BASE_SWGOH_GUILD_LOCKED_CHAR")
                    });
                }
            }

            msg.edit({embed: {
                author: {
                    name: guild.name
                },
                fields: fields
            }});
        }    
    }
}

module.exports = GuildSearch;

