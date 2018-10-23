const Command = require("../base/Command");
// const moment = require('moment');
require("moment-duration-format");

class MyMods extends Command {
    constructor(client) {
        super(client, {
            name: "mymods",
            category: "SWGoH",
            guildOnly: false,
            aliases: ["charactermods", "charmods", "cmods", "cm", "mm"],
            permissions: ["EMBED_LINKS"],
            subArgs: {
                b: {
                    aliases: ["best"],
                    default: null
                }
            },
            flags: {
                t: {
                    aliases: ["total"]
                }
            }
        });
    }

    async run(client, message, [userID, ...searchChar], options) { // eslint-disable-line no-unused-vars
        // const lang = message.guildSettings.swgohLanguage;
        const cooldown = client.getPlayerCooldown(message.author.id);
        const icons = {
            STATMOD_SLOT_01: await client.getEmoji("362066327101243392") || "Square",
            STATMOD_SLOT_02: await client.getEmoji("362066325474115605") || "Arrow",
            STATMOD_SLOT_03: await client.getEmoji("362066326925082637") || "Diamond",
            STATMOD_SLOT_04: await client.getEmoji("362066327168352257") || "Triangle",
            STATMOD_SLOT_05: await client.getEmoji("362066326996385812") || "Circle",
            STATMOD_SLOT_06: await client.getEmoji("362066327516610570") || "Cross"
        };

        if (searchChar) searchChar = searchChar.join(" ");

        // Need to get the allycode from the db, then use that
        if (!userID) {
            if (!options.subArgs.b) {
                return message.channel.send(message.language.get("BASE_SWGOH_MISSING_CHAR"));
            } else {
                userID = message.author.id;
            }
        } else if (userID === "me") {
            userID = message.author.id;
        } else if (client.isAllyCode(userID) || client.isUserID(userID)) {
            userID = userID.replace(/[^\d]*/g, "");
        } else {
            // If they're just looking for a character for themselves, get the char
            searchChar = userID + " " + searchChar;
            searchChar = searchChar.trim();
            userID = message.author.id;
        }

        const msg = await message.channel.send(message.language.get("COMMAND_MYMODS_WAIT"));

        const allyCodes = await client.getAllyCode(message, userID);
        if (!allyCodes.length) {
            return msg.edit(message.language.get("BASE_SWGOH_NOT_REG", client.users.get(userID).tag));
        } else if (allyCodes.length > 1) {
            return msg.edit("Found " + allyCodes.length + " matches. Please make sure your code is correct.");
        }

        const allyCode = allyCodes[0];

        if (!options.subArgs.b) {
            let character;
            if (!searchChar) {
                return msg.edit(message.language.get("BASE_SWGOH_MISSING_CHAR"));
            }

            const chars = client.findChar(searchChar, client.characters);
            if (chars.length === 0) {
                return msg.edit(message.language.get("BASE_SWGOH_NO_CHAR_FOUND", searchChar));
            } else if (chars.length > 1) {
                const charL = [];
                const charS = chars.sort((p, c) => p.name > c.name ? 1 : -1);
                charS.forEach(c => {
                    charL.push(c.name);
                });
                return msg.edit(message.language.get("BASE_SWGOH_CHAR_LIST", charL.join("\n")));
            } else {
                character = chars[0];
            }

            let player;
            try {
                player = await client.swgohAPI.player(allyCode, null, cooldown);
            } catch (e) {
                console.log(e);
            }

            const charMods = player.roster.filter(c => c.defId === character.uniqueName)[0].mods;

            const slots = {};

            const sets = message.language.get("BASE_MODSETS_FROM_GAME");
            const stats = message.language.get("BASE_MODS_FROM_GAME");

            charMods.forEach(mod => {
                slots[mod.slot] = {
                    stats: [],
                    type: sets[mod.set],
                    lvl: mod.level,
                    pip: mod.pips
                };

                // Add the primary in
                slots[mod.slot].stats.push(`${mod.primaryStat.value} ${stats[mod.primaryStat.unitStat].replace("+", "").replace("%", "")}`);

                // Then all the secondaries
                mod.secondaryStat.forEach(s => {
                    let t = stats[s.unitStat];
                    if (t.indexOf("%") > -1) { 
                        t = t.replace("%", "").trim();
                        s.value = s.value.toFixed(2) + "%";
                    }

                    let statStr = s.value;
                    if (s.roll > 0) statStr = `(${s.roll}) ${statStr}`;
                    statStr +=  " " + t;
                    slots[mod.slot].stats.push(statStr);
                });
            });

            const fields = [];
            Object.keys(slots).forEach(mod => {
                const stats = slots[mod].stats;
                fields.push({
                    name: `${icons[`STATMOD_SLOT_0${mod}`]} ${slots[mod].type} (${slots[mod].pip}* Lvl: ${slots[mod].lvl})`,
                    value: `**${stats.shift()}**\n${stats.join("\n")}\n\`${"-".repeat(28)}\``,
                    inline: true
                });
            });

            msg.edit({embed: {
                author: {
                    name: `${player.name}'s ${character.name}`,
                    icon_url: character.avatarURL
                },
                fields: fields,
                footer: {
                    text: message.language.get("BASE_SWGOH_LAST_UPDATED", client.duration(player.updated, message))
                }
            }});
        } else {
            const checkableStats = {
                "Health": {
                    aliases: ["HP"]
                },
                "Protection": {
                    aliases: ["Prot"]
                },
                "Speed": {
                    aliases: []
                },
                "Potency": {
                    aliases: ["Pot"]
                },
                "Physical Critical Chance": {
                    aliases: ["PCC", "CC", "Crit Chance", "Critical Chance", "Physical Crit Chance"], 
                },
                "Special Critical Chance": {
                    aliases: ["SCC", "Special Crit Chance"]
                },
                "Critical Damage": {
                    aliases: ["CD", "Crit Damage"]
                },
                "Tenacity": {
                    aliases: ["Ten"]
                },
                "Accuracy": {
                    aliases: []
                },
                "Armor": {
                    aliases: []
                },
                "Resistance": {
                    aliases: ["Res", "Resist"]
                }
            };
            let found = false;
            if (searchChar.length) options.subArgs.b = options.subArgs.b + " " + searchChar;
            if (Object.keys(checkableStats).filter(c => c.toLowerCase() === options.subArgs.b.toLowerCase()).length > 0) {
                options.subArgs.b =  options.subArgs.b.toProperCase();
                found = true;
            } else {
                Object.keys(checkableStats).forEach(s => {
                    if (checkableStats[s].aliases.filter(c => c.toLowerCase() === options.subArgs.b.toLowerCase()).length > 0) {
                        options.subArgs.b = s;
                        found = true;
                        return;
                    }
                });
            }
            if (!found) {
                return msg.edit(message.language.get("COMMAND_MYMODS_BAD_STAT", client.codeBlock(Object.keys(checkableStats).join("\n"))));
            }
            const statToCheck = options.subArgs.b;
            let stats;
            try { 
                stats = await client.swgohAPI.unitStats(allyCode, cooldown);
            } catch (e) {
                return msg.edit({embed: {
                    author: {name: "Something Broke"},
                    description: client.codeBlock(e.message) + "Please try again in a bit"
                }});
            }
            
            let updated;
            if (stats && stats.stats) {
                updated = stats.updated;
                stats = stats.stats;
            }

            stats.forEach(c => {
                if (c.stats.final && !c.stats.final[statToCheck]) {
                    c.stats.final[statToCheck] = 0;
                }
                if (c.stats.mods && !c.stats.mods[statToCheck]) {
                    c.stats.mods[statToCheck] = 0;
                }
            });

            let sorted;
            if (options.flags.t) {
                sorted = stats.sort((p, c) => p.stats.final && c.stats.final && p.stats.final[statToCheck] > c.stats.final[statToCheck] ? -1 : 1);
            } else {
                sorted = stats.sort((p, c) => p.stats.mods && c.stats.mods && p.stats.mods[statToCheck] > c.stats.mods[statToCheck] ? -1 : 1);

            }
            const out = sorted.map(c => {
                const finalStat = c.stats.final ? (c.stats.final[statToCheck] % 1 === 0 ? c.stats.final[statToCheck] : (c.stats.final[statToCheck] * 100).toFixed(2)+"%") : 0;
                const modStat = c.stats.mods && c.stats.mods[statToCheck] ? (c.stats.mods[statToCheck] % 1 === 0 ? `(${c.stats.mods[statToCheck]})` : `(${(c.stats.mods[statToCheck] * 100).toFixed(2)}%)`) : "";
                return {
                    stat: `${finalStat}${modStat.length ? " " + modStat : ""}`, 
                    name: `: ${c.unit.name}`
                };
            });
            const longest = out.reduce((max, s) => Math.max(max, s.stat.length), 0);
            let outStr = "";
            for (let ix = 0; ix < 10; ix++) {
                outStr += "`" + out[ix].stat + ` ${client.zws}`.repeat(longest-out[ix].stat.length) + "`**" + out[ix].name + "**\n";
            }
            const author = {};
            if (options.flags.t) {
                // ${playerName}'s Highest ${stat} Characters
                author.name = message.language.get("COMMAND_MYMODS_HEADER_TOTAL", stats[0].unit.player, options.subArgs.b);
            } else {
                // ${playerName}'s Best ${stat} From Mods
                author.name = message.language.get("COMMAND_MYMODS_HEADER_MODS", stats[0].unit.player, options.subArgs.b);
            }
            return msg.edit({embed: {
                author: author,
                description: "==============================\n" + outStr + "==============================",
                footer: {
                    text: updated ? message.language.get("BASE_SWGOH_LAST_UPDATED", client.duration(updated, message)) : ""
                }
            }});
        }
    }
}

module.exports = MyMods;

