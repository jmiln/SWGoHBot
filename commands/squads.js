const Command = require("../base/Command");

class Squads extends Command {
    constructor(client) {
        super(client, {
            name: "squads",
            aliases: ["sq", "squad", "raid", "raidteam"],
            category: "Star Wars"
        });
    }

    async run(client, message, [user, list, phase]) {
        const squadList = client.squads;
        const lists = Object.keys(squadList).filter(l => !["psummary", "gsummary"].includes(l));
        let shipEv = false;

        if (!user) {
            return message.channel.send(message.language.get("COMMAND_SQUADS_NO_LIST", lists.join(", ")));
        }

        const lang = message.guildSettings.swgoghLanguage;
        let allyCodes;
        if (user === "me" || client.isUserID(user) || client.isAllyCode(user)) {
            allyCodes = await client.getAllyCode(message, user);
        }
        let player = null;
        if (!allyCodes || !allyCodes.length || allyCodes.length > 1) {
            phase = list;
            list = user;
        } else {
            const cooldown = client.getPlayerCooldown(message.author.id);
            try {
                player = await client.swgohAPI.player(allyCodes[0], lang, cooldown);
            } catch (e) {
                console.log("Broke getting player in squads: " + e);
            }
        }
        // console.log(player.roster.filter(c => c.name.includes('Anakin')));


        if (!list) {
            // No list, show em the possible ones
            return message.channel.send(message.language.get("COMMAND_SQUADS_NO_LIST", lists.join(", ")));
        } else {
            list = list.toLowerCase();
        } 
        if (lists.includes(list)) {
            if (!phase) {
                // They've chosen a list, show em the phase list 
                const outList = squadList[list].phase.map((p, ix) => 
                    "`" + (ix + 1) + "`"+ ": " + p.name.replace("&amp;", "&").toProperCase().replace(/aat/gi, "AAT")
                ).join("\n");
                return message.channel.send(message.language.get("COMMAND_SQUADS_SHOW_LIST", list.toProperCase().replace(/aat/gi, "AAT"), outList));
            } else if (phase > 0 && phase <= squadList[list].phase.length) {
                phase = phase - 1;
                const sqArray = [];
                squadList[list].phase[phase].name = squadList[list].phase[phase].name.replace("&amp;", "&").toProperCase().replace(/aat/gi, "AAT");
                squadList[list].phase[phase].squads.forEach(s => {
                    let outStr = s.name ? `**${s.name}**\n` : "";

                    outStr += charCheck(s.team, {
                        level : squadList[list].level,
                        stars : squadList[list].rarity,
                        gear  : squadList[list].gear
                    }, player, s.ships);
                    if (s.ships) shipEv = true;
                    sqArray.push(outStr);
                });

                const fields = [];
                const outArr = client.msgArray(sqArray, "\n", 1000);
                outArr.forEach((sq, ix) => {
                    fields.push({
                        name: (player ? player.name + "'s " : "") + message.language.get("COMMAND_SQUADS_FIELD_HEADER") + (ix === 0 ? "" : " " + message.language.get("BASE_CONT_STRING")),
                        value: sq
                    });
                });
                return message.channel.send({embed: {
                    author: {
                        name: squadList[list].name.toProperCase().replace(/aat/gi, "AAT")
                    },
                    description: `**${squadList[list].phase[phase].name}**\n${squadList[list].rarity}* ${shipEv ? "" : `| g${squadList[list].gear}`} | lvl${squadList[list].level}`,
                    fields: fields,
                    color: 0x00FF00
                }});
            } else {
                const outList = squadList[list].phase.map((p, ix) => "`" + (ix + 1) + "`"+ ": " + p.name.replace("&amp;", "&").toProperCase().replace(/aat/gi, "AAT")).join("\n");
                return message.channel.send(message.language.get("COMMAND_SQUAD_INVALID_PHASE", outList));
            }
        } else {
            // Unknown list/ category
            return message.channel.send(`Invalid category, please select one of the following: \n\`${lists.join(", ")}\``);
        }

        function charCheck(characters, stats, player=null, ships=null) {
            const {level, stars, gear} = stats;
            let outStr = "";
            if (!player) {
                characters.forEach(c => {
                    try {
                        if (!ships) {
                            outStr += client.characters.filter(char => char.uniqueName === c.split(":")[0])[0].name + "\n";
                        } else {
                            outStr += client.ships.filter(ship => ship.uniqueName === c.split(":")[0])[0].name + "\n";
                        }
                    } catch (e) {
                        console.log("Squad broke: " + c + ": " + e);
                    }
                });
            } else {
                characters.forEach(c => {
                    try {
                        const ch = player.roster.filter(char => char.defId === c.split(":")[0])[0];
                        if (!ch) {
                            if (!ships) {
                                outStr += "`✗|✗|✗` " + client.characters.filter(char => char.uniqueName === c.split(":")[0])[0].name + "\n";
                            } else {
                                outStr += "`✗|✗` " + client.characters.filter(char => char.uniqueName === c.split(":")[0])[0].name + "\n";
                            }
                        } else if (ch.rarity >= stars && ch.gear >= gear && ch.level >= level) {
                            if (!ships) {
                                outStr += "`✓|✓|✓` **" + ch.name + "**\n"; 
                            } else {
                                outStr += "`✓|✓` **" + ch.name + "**\n"; 
                            }
                        } else {
                            outStr += ch.rarity >= stars ? "`✓|" : "`✗|";
                            if (!ships) {
                                outStr += ch.gear   >= gear  ? "✓|" : "✗|";
                            }
                            outStr += ch.level  >= level ? "✓` " : "✗` ";
                            outStr += ch.name + "\n";
                        }
                    } catch (e) {
                        console.log("Squad broke: " + c + ": " + e);
                    }
                });
            }
            return outStr;
        }
    }
}

module.exports = Squads;

