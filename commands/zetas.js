const Command = require("../base/Command");

class Zetas extends Command {
    constructor(client) {
        super(client, {
            name: "zetas",
            category: "SWGoH",
            aliases: ["zeta", "z"],
            permissions: ["EMBED_LINKS"],
            flags: {
                "r": {
                    aliases: ["rec", "recommend", "recommendations"]
                },
                "g": {
                    aliases: ["guild"]
                },
                "h": {
                    aliases: ["heroic"]
                }
            }
        });
    }

    async run(client, message, [userID, ...searchChar], options) { // eslint-disable-line no-unused-vars
        let allyCode;

        if (options.flags.g && options.flags.r) {
            return message.channel.send(message.language.get("COMMAND_ZETA_CONFLICTING_FLAGS"));
        }

        const filters = ["pit", "pvp", "sith", "tank", "tb", "tw"];
        // Need to get the allycode from the db, then use that
        if (!userID || userID === "me" || client.isUserID(userID) || client.isAllyCode(userID)) {
            const allyCodes = await client.getAllyCode(message, userID);
            if (!allyCodes.length) {
                return message.channel.send(message.language.get("BASE_SWGOH_NO_USER", message.guildSettings.prefix));
            }
            allyCode = allyCodes[0];
        } else {
            // If they're just looking for a character for themselves, get the char
            searchChar = [userID].concat(searchChar);
            const allyCodes = await client.getAllyCode(message, message.author.id);
            if (!allyCodes.length) {
                return message.channel.send(message.language.get("BASE_SWGOH_NO_USER", message.guildSettings.prefix));
            }
            allyCode = allyCodes[0];
        }
        
        searchChar = searchChar.join(" ").trim();
        
        if (searchChar.length && options.flags.r && !filters.includes(searchChar.toLowerCase())) { 
            return message.channel.send(message.language.get("COMMAND_ZETA_REC_BAD_FILTER", filters.join(", ")));
        }             

        let character = null;
        if (searchChar && !options.flags.r) {
            const chars = client.findChar(searchChar, client.characters);
            
            if (chars.length > 1) {
                const charL = [];
                const charS = chars.sort((p, c) => p.name > c.name ? 1 : -1);
                charS.forEach(c => {
                    charL.push(c.name);
                });
                return message.channel.send(message.language.get("COMMAND_GUILDSEARCH_CHAR_LIST", charL.join("\n")));
            } else if (chars.length === 1) {
                character = chars[0];
            }
        }
        
        const msg = await message.channel.send(options.flags.g ? message.language.get("COMMAND_ZETA_WAIT_GUILD") : message.language.get("BASE_SWGOH_PLS_WAIT_FETCH", "zetas"));

        const cooldown = client.getPlayerCooldown(message.author.id);
        let player;

        try {
            player = await client.swgohAPI.player(allyCode, null, cooldown);
        } catch (e) {
            console.log("Error: Broke while trying to get player data in zetas: " + e);
            return msg.edit(message.language.get("BASE_SWGOH_NO_ACCT"));
        }

        if (!options.flags.r && !options.flags.g) {

            const zetas = {};
            let count = 0;
            player.roster.forEach(char => {
                // If they are not looking for a specific character, check em all
                if (!character || character.uniqueName === char.defId) {
                    if (!char.nameKey) {
                        const tmp = client.characters.filter(c => c.uniqueName === char.defId);
                        if (tmp.length) {
                            char.nameKey = tmp[0].name;
                        }
                    }
                    char.skills.forEach(skill => {
                        if (skill && skill.isZeta && skill.tier === 8) {
                            count++;
                            // If the character is not already listed, add it
                            if (!zetas[char.nameKey]) {
                                zetas[char.nameKey] = ["`[" + skill.id.charAt(0) + "]` " + skill.nameKey];
                            } else {
                                zetas[char.nameKey].push("`[" + skill.id.charAt(0) + "]` " + skill.nameKey);
                            }
                        }
                    });
                }
            });

            const sorted = Object.keys(zetas).sort((p, c) => p > c ? 1 : -1);
            const desc = [], author = {};
            if (!character) {
                author.name = message.language.get("COMMAND_ZETA_ZETAS_HEADER", player.name, count);
                desc.push("`------------------------------`");
                sorted.forEach(character => {
                    desc.push(`\`(${zetas[character].length})\` ${character}`);
                });
                desc.push("`------------------------------`");
                desc.push(message.language.get("COMMAND_ZETA_MORE_INFO"));
            } else {
                author.name = `${player.name}'s ${character.name} (${count})`;
                author.icon_url = character.avatarURL;
                if (!zetas[sorted[0]] || zetas[sorted[0]].length === 0) {
                    desc.push(message.language.get("COMMAND_ZETA_NO_ZETAS"));
                } else {
                    desc.push(zetas[sorted[0]].join("\n"));
                }
            }
            
            const footer = client.updatedFooter(player.updated, message, "player", cooldown);
            msg.edit({embed: {
                color: 0x000000,
                author: author,
                description: desc.join("\n"), 
                footer: footer
            }});
        } else if (options.flags.r) {
            // Zeta recommendations
            const zetas = client.zetaRec;
            const myZetas = [];

            const sortBy = searchChar.length ? searchChar : "versa";
            const zetaSort = sortBy ? zetas.zetas.sort((a, b) => a[sortBy] - b[sortBy]) : zetas.zetas.sort((a, b) => a.toon - b.toon);
            for (let ix = 0; ix < zetaSort.length; ix ++) {
                if (myZetas.length >= 5) {
                    break;
                }
                if (zetaSort[ix][sortBy] === 0) continue;
                const char = player.roster.find(c => zetaSort[ix].toon === c.nameKey);
                let skill = null;
                if (char) {
                    skill = char.skills.find(a => a.nameKey === zetaSort[ix].name);
                } 
                if (skill && skill.tier < 8 && char.level >= 80) {
                    if (options.flags.h && char.rarity < 7) continue; 
                    skill.toon = char.nameKey;
                    skill.gearLvl = char.gear;
                    skill.lvl = char.level;
                    skill.star = char.rarity;
                    myZetas.push(skill);
                }
            }

            let desc = message.language.get("COMMAND_ZETA_REC_HEADER");
            desc += "\n`" + filters.join(", ") + "`\n`------------------------------`\n";
            myZetas.forEach(z => {
                desc += `**${z.nameKey}**\n${z.toon}\n\`${message.language.get("BASE_LEVEL_SHORT")}${z.lvl} | ⚙${z.gearLvl} | ${z.star}*\`\n${client.zws}\n`;
            });

            const zetaLen = `${myZetas.length} ${sortBy === "versa" ? "" : sortBy + " "}`;
            const footer = client.updatedFooter(player.updated, message, "player", cooldown);
            return msg.edit({embed: {
                author: {
                    name: message.language.get("COMMAND_ZETA_REC_AUTH", zetaLen, player.name)
                },
                description: desc,
                footer: footer
            }});
        } else if (options.flags.g) {
            let guild = null;
            try {
                guild = await client.swgohAPI.guild(player.allyCode, null, cooldown);
                // TODO  Lang this
                if (!guild) return message.channel.send("Cannot find guild");

                const zetaList = {};
                for (let p = 0; p < guild.roster.length; p++) {
                    const member = await client.swgohAPI.player(guild.roster[p].allyCode);
                    if (!member) continue;
                    if (searchChar.length) {
                        member.roster = member.roster.filter(c => c.defId === character.uniqueName);
                    }
                    if (!member.roster.length) continue;
                    for (let c = 0; c < member.roster.length; c++) {
                        const char = member.roster[c];
                        if (!char.skills || !char.skills.length) continue;
                        for (let s = 0; s < char.skills.length; s++) {
                            const skill = char.skills[s];
                            if (!skill.isZeta || skill.tier < 8) continue;
                            const tmp = zetaList[char.nameKey] || {};
                            if (!tmp[skill.nameKey]) {
                                tmp[skill.nameKey] = [member.name];
                            } else {
                                tmp[skill.nameKey].push(member.name);
                            }
                            zetaList[char.nameKey] = tmp;
                        }
                    }
                }
                if (!searchChar.length) {
                    // Just want to see all zetas for the guild
                    const zArr = [];
                    const sorted = Object.keys(zetaList).sort();
                    sorted.forEach(c => { 
                        let zStr = "";
                        zStr += `**${c}**\n`;
                        Object.keys(zetaList[c]).forEach(z => {
                            zStr += `**\`${zetaList[c][z].length}\`**: ${z}\n`;
                        });
                        zArr.push(zStr);
                    });
                    const fields = [];
                    const msgArr = client.msgArray(zArr, "", 1000);
                    msgArr.forEach(m => {
                        fields.push({
                            name: "____",
                            value: m,
                            inline: true
                        });

                    });

                    const footer = client.updatedFooter(guild.updated, message, "guild", cooldown);
                    return msg.edit({embed: {
                        author: {
                            name: message.language.get("COMMAND_ZETA_ZETAS_HEADER", guild.name)
                        },
                        fields: fields,
                        footer: footer
                    }});
                } else {
                    // Want to see all zetas in the guild for a certain character
                    const fields = [];
                    const zChar = zetaList[Object.keys(zetaList)[0]];
                    Object.keys(zChar).forEach(z => {
                        // Format the string/ embed
                        const msgArr = client.msgArray(zChar[z].sort((p, c) => p.toLowerCase() > c.toLowerCase() ? 1 : -1), "\n", 700);
                        msgArr.forEach((m, ix) => {
                            let msgCount = "";
                            if (msgArr.length > 1) msgCount = ` (${ix+1}/${msgArr.length})`;
                            fields.push({
                                name: z + msgCount,
                                value: m,
                                inline: (ix + 1) === msgArr.length ? false : true
                            });
                        });
                    });
                    const footer = client.updatedFooter(guild.updated, message, "guild", cooldown);
                    return msg.edit({embed: {
                        author: {
                            name: `${guild.name}'s ${character.name} zetas`
                        },
                        fields: fields,
                        footer: footer
                    }});
                }


            } catch (e) {
                console.error(e);
            }
        } 
    }
}

module.exports = Zetas;

