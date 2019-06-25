const Command = require("../base/Command");

class Squads extends Command {
    constructor(Bot) {
        super(Bot, {
            name: "squads",
            aliases: ["sq", "squad", "raidteam", "raidteams"],
            category: "Star Wars",
            permissions: ["EMBED_LINKS"]
        });
    }

    async run(Bot, message, [user, list, phase]) {
        const example = `squads aat 1\n${message.guildSettings.prefix}squads me aat 1\n${message.guildSettings.prefix}squads 123456789 aat 1`;
        const squadList = Bot.squads;
        const lists = Object.keys(squadList).filter(l => !["psummary", "gsummary"].includes(l));
        let shipEv = false;

        if (!user) {
            return super.error(message, message.language.get("COMMAND_SQUADS_NO_LIST", lists.join(", ")), {title: "Missing category", example: example});
        }

        const lang = message.guildSettings.swgoghLanguage;
        let allyCodes;
        if (user === "me" || Bot.isUserID(user) || Bot.isAllyCode(user)) {
            allyCodes = await super.getUser(message, user);
            if (!allyCodes) {
                return super.error(message, "I could't find that user. Check that:\n* Your ally code is correct.\n* The user you're checking is registered.");
            }
        }
        // console.log(allyCodes, list, phase);
        // console.log(lists);
        let player = null;
        let cooldown = null;
        if (!allyCodes) {
            phase = list;
            list = user;
        } else {
            cooldown = Bot.getPlayerCooldown(message.author.id);
            try {
                player = await Bot.swgohAPI.player(allyCodes, lang, cooldown);
            } catch (e) {
                console.log("Broke getting player in squads: " + e);
            }
        }

        if (!list || !list.length) {
            // No list, show em the possible ones
            return super.error(message, message.language.get("COMMAND_SQUADS_NO_LIST", lists.join(", ")), {title: "Missing category", example: example});
        } else {
            list = list.toLowerCase();
        }

        if (lists.includes(list)) {
            if (!phase) {
                // They've chosen a list, show em the phase list
                const outList = squadList[list].phase.map((p, ix) => {
                    if (p && p.name) {
                        return "`" + (ix + 1) + "`"+ ": " + p.name.replace("&amp;", "&").toProperCase().replace(/aat/gi, "AAT").trim();
                    } else {
                        let tmp = p.team;
                        if (tmp === tmp.toUpperCase()) {
                            let char = Bot.characters.find(c => c.uniqueName === tmp);
                            if (!char) {
                                char = Bot.ships.find(c => c.uniqueName === tmp);
                            }
                            tmp = char.name;
                        }
                        return "`" + (ix + 1) + "`"+ ": " + tmp.replace("&amp;", "&").toProperCase().replace(/aat/gi, "AAT").trim();
                    }
                }).join("\n");
                return super.error(message, message.language.get("COMMAND_SQUADS_SHOW_LIST", list.toProperCase().replace(/aat/gi, "AAT"), outList), {title: "Missing phase", example: example});
            } else if (phase > 0 && phase <= squadList[list].phase.length) {
                phase = phase - 1;
                const sqArray = [];
                if (list !== "twcounters") {
                    if (squadList[list].phase[phase].name) {
                        squadList[list].phase[phase].name = squadList[list].phase[phase].name.replace("&amp;", "&").toProperCase().replace(/aat/gi, "AAT");
                    }
                    for (const s of squadList[list].phase[phase].squads) {
                        let outStr = s.name ? `**${s.name}**\n` : "";

                        try {
                            outStr += await charCheck(s.team, {
                                level : squadList[list].level,
                                stars : squadList[list].rarity,
                                gear  : squadList[list].gear
                            }, player, s.ships);
                        } catch (e) {
                            return super.error(message, e.message);
                        }
                        if (s.ships) shipEv = true;
                        sqArray.push(outStr);
                    }
                    const fields = [];
                    const outArr = Bot.msgArray(sqArray, "\n", 1000);
                    outArr.forEach((sq, ix) => {
                        fields.push({
                            name: (player ? player.name + "'s " : "") + message.language.get("COMMAND_SQUADS_FIELD_HEADER") + (ix === 0 ? "" : " " + message.language.get("BASE_CONT_STRING")),
                            value: sq
                        });
                    });
                    let footer = "";
                    if (player && cooldown) {
                        if (player.warnings) {
                            fields.push({
                                name: "Warnings",
                                value: player.warnings.join("\n")
                            });
                        }

                        footer = Bot.updatedFooter(player.updated, message, "player", cooldown);
                    }
                    return message.channel.send({embed: {
                        author: {
                            name: squadList[list].name.toProperCase().replace(/aat/gi, "AAT")
                        },
                        description: `**${squadList[list].phase[phase].name}**\n${squadList[list].rarity}* ${shipEv ? "" : `| g${squadList[list].gear}`} | lvl${squadList[list].level}`,
                        fields: fields,
                        footer: footer,
                        color: 0x00FF00
                    }});
                } else {
                    const fields = [];
                    let counterName = squadList[list].phase[phase].team;
                    if (counterName && counterName.toUpperCase() === counterName) {
                        const char = await Bot.characters.find(c => c.uniqueName === counterName);
                        counterName = char.name.trim();
                    }
                    let out = [];
                    for (const counters of squadList[list].phase[phase].hardcounters) {
                        try {
                            out.push(await charCheck(counters.team, {
                                level: 0,
                                stars: 0,
                                gear: 0
                            }, player));
                        } catch (e) {
                            super.error(message, e.message);
                        }
                    }
                    fields.push({
                        name: "Hard counters",
                        value: out.join("--\n")
                    });

                    out = [];
                    for (const counters of squadList[list].phase[phase].softcounters) {
                        try {
                            out.push(await charCheck(counters.team, {
                                level: 0,
                                stars: 0,
                                gear: 0
                            }, player));
                        } catch (e) {
                            super.error(message, e.message);
                        }
                    }
                    fields.push({
                        name: "Soft counters",
                        value: out.join("--\n")
                    });
                    let footer;
                    if (player && cooldown) {
                        if (player.warnings) {
                            fields.push({
                                name: "Warnings",
                                value: player.warnings.join("\n")
                            });
                        }

                        footer = Bot.updatedFooter(player.updated, message, "player", cooldown);
                    }
                    return message.channel.send({embed: {
                        author: {
                            name: `Counters for ${counterName}`
                        },
                        fields: fields,
                        footer: footer,
                        color: 0x00FF00
                    }});
                }

            } else {
                const outList = squadList[list].phase.map((p, ix) => "`" + (ix + 1) + "`"+ ": " + p.name.replace("&amp;", "&").toProperCase().replace(/aat/gi, "AAT")).join("\n");
                return super.error(message, message.language.get("COMMAND_SQUAD_INVALID_PHASE", outList), {example: example});
            }
        } else {
            // Unknown list/ category
            return super.error(message, `Please select one of the following: \n\`${lists.join(", ")}\``, {title: "Invalid Category", example: example});
        }

        async function charCheck(characters, stats, player=null, ships=null) {
            const {level, stars, gear} = stats;
            let outStr = "";
            if (!Array.isArray(characters)) {
                characters = [characters];
            }
            if (!player) {
                characters.forEach(c => {
                    try {
                        if (!ships) {
                            let char = Bot.characters.find(char => char.uniqueName === c.split(":")[0]);
                            if (!char) {
                                char = Bot.ships.find(ship => ship.uniqueName === c.split(":")[0]);
                            }
                            outStr += char.name + "\n";
                        } else {
                            outStr += Bot.ships.find(ship => ship.uniqueName === c.split(":")[0]).name + "\n";
                        }
                    } catch (e) {
                        console.log("Squad broke: " + c + ": " + e);
                    }
                });
            } else {
                if (!player || !player.roster) {
                    throw new Error("Sorry, something broke whlie getting your info. Please try again.");
                }
                for (const c of characters) {
                    try {
                        let ch = player.roster.find(char => char.defId === c.split(":")[0]);
                        if (ch) {
                            ch = await Bot.swgohAPI.langChar(ch, message.guildSettings.swgohLanguage);
                        }
                        if (!ch) {
                            if (!ships) {
                                outStr += "`✗|✗|✗` " + Bot.characters.filter(char => char.uniqueName === c.split(":")[0])[0].name + "\n";
                            } else {
                                outStr += "`✗|✗` " + Bot.characters.filter(char => char.uniqueName === c.split(":")[0])[0].name + "\n";
                            }
                        } else if (ch.rarity >= stars && ch.gear >= gear && ch.level >= level) {
                            if (!ships) {
                                outStr += "`✓|✓|✓` **" + ch.nameKey + "**\n";
                            } else {
                                outStr += "`✓|✓` **" + ch.nameKey + "**\n";
                            }
                        } else {
                            outStr += ch.rarity >= stars ? "`✓|" : "`✗|";
                            if (!ships) {
                                outStr += ch.gear   >= gear  ? "✓|" : "✗|";
                            }
                            outStr += ch.level  >= level ? "✓` " : "✗` ";
                            outStr += ch.nameKey + "\n";
                        }
                    } catch (e) {
                        console.log("Squad broke: " + c + ": " + e);
                    }
                }
            }
            return outStr;
        }
    }
}

module.exports = Squads;

