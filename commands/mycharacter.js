const Command = require("../base/Command");
const {promisify, inspect} = require("util");      // eslint-disable-line no-unused-vars

class MyCharacter extends Command {
    constructor(client) {
        super(client, {
            name: "mycharacter",
            category: "SWGoH",
            enabled: true, 
            aliases: ["mc", "mychar"],
            permissions: ["EMBED_LINKS"],   
            permLevel: 0,
        });
    }

    async run(client, message, args) {
        const {allyCode, searchChar, err} = await super.getUserAndChar(message, args);

        if (err) {
            return message.channel.send("**Error:** `" + err + "`");
        }

        const chars = client.findChar(searchChar, client.characters);
        let character;
        if (!searchChar) {
            return message.channel.send(message.language.get("BASE_SWGOH_MISSING_CHAR"));
        }

        if (chars.length === 0) {
            return message.channel.send(message.language.get("BASE_SWGOH_NO_CHAR_FOUND", searchChar));
        } else if (chars.length > 1) {
            const charL = [];
            const charS = chars.sort((p, c) => p.name > c.name ? 1 : -1);
            charS.forEach(c => {
                charL.push(c.name);
            });
            return message.channel.send(message.language.get("BASE_SWGOH_CHAR_LIST", charL.join("\n")));
        } else {
            character = chars[0];
        }

        const msg = await message.channel.send("Please wait while I look up your profile.");

        const cooldown = client.getPlayerCooldown(message.author.id);
        let pName;
        let player = null;
        try {
            player = await client.swgohAPI.unitStats(allyCode, cooldown);
        } catch (e) {
            console.error(e);
            return msg.edit({embed: {
                author: {name: message.language.get("BASE_SOMETHING_BROKE")},
                description: client.codeBlock(e.message) + "Please try again in a bit"
            }});
        }

        if (player && player.stats) {
            pName = player.stats[0].unit.player;
        }
        const footer = client.updatedFooter(player.updated, message, "player", cooldown);

        let thisChar = player.stats.filter(c => c.unit.defId === character.uniqueName);
        if (thisChar && thisChar[0]) {
            const stats = thisChar[0].stats;
            thisChar = thisChar[0].unit;
            let gearStr = ["   [0]  [3]", "[1]       [4]", "   [2]  [5]"].join("\n");
            const abilities = {
                basic: [],
                special: [],
                leader: [],
                unique: [],
                contract: []
            };
            thisChar.equipped.forEach(e => {
                gearStr = gearStr.replace(e.slot, "X");
            });
            gearStr = gearStr.replace(/[0-9]/g, "  ");
            gearStr = client.expandSpaces(gearStr);
            thisChar.skills.forEach(a => {
                a.type = a.id.split("_")[0].replace("skill", "").toProperCase();
                if (a.tier === 8 || (a.tier === 3 && a.type === "Contract")) {
                    if (a.isZeta) {
                        // Maxed Zeta ability
                        a.tier = "Max ✦";
                    } else {
                        // Maxed Omega ability
                        a.tier = "Max ⭓";
                    }
                } else {
                    // Unmaxed ability
                    a.tier = "Lvl " + a.tier;
                }
                try {
                    abilities[`${a.type ? a.type.toLowerCase() : a.defId.toLowerCase()}`].push(`\`${a.tier} [${a.type ? a.type.charAt(0) : a.defId.charAt(0)}]\` ${a.nameKey}`);
                } catch (e) {
                    console.log("ERROR[MC]: bad ability type: " + inspect(a));
                }
            });
            const abilitiesOut = abilities.basic
                .concat(abilities.special)
                .concat(abilities.leader)
                .concat(abilities.unique)
                .concat(abilities.contract);

            const statNames = {
                "Primary Attributes" : [
                    "Strength",
                    "Agility",
                    "Intelligence"
                ],
                "General": [
                    "Health",
                    "Protection",
                    "Speed",
                    "Critical Damage",
                    "Potency",
                    "Tenacity",
                    "Health Steal",
                    "Defense Penetration"
                ],
                "Physical Offense": [
                    "Physical Damage",
                    "Physical Critical Chance",
                    "Armor Penetration",
                    "Accuracy"
                ],
                "Physical Survivability": [
                    "Armor",
                    "Dodge Chance",
                    "Critical Avoidance"
                ],
                "Special Offense": [
                    "Special Damage",
                    "Special Critical Chance",
                    "Resistance Penetration",
                    "Accuracy"
                ],
                "Special Survivability": [
                    "Resistance",
                    "Deflection Chance",
                    "Critical Avoidance"
                ]
            };

            const langStr = message.language.get("BASE_STAT_NAMES");
            const langMap = {
                "Primary Attributes":       "PRIMARY",    
                "Strength":                 "STRENGTH",   
                "Agility":                  "AGILITY",    
                "Intelligence":             "TACTICS",    
                "General":                  "GENERAL",    
                "Health":                   "HEALTH",     
                "Protection":               "PROTECTION", 
                "Speed":                    "SPEED",      
                "Critical Damage":          "CRITDMG",    
                "Potency":                  "POTENCY",    
                "Tenacity":                 "TENACITY",   
                "Health Steal":             "HPSTEAL",    
                "Defense Penetration":      "DEFENSEPEN", 
                "Physical Offense":         "PHYSOFF",    
                "Physical Damage":          "PHYSDMG",    
                "Physical Critical Chance": "PHYSCRIT",   
                "Armor Penetration":        "ARMORPEN",   
                "Accuracy":                 "ACCURACY",   
                "Physical Survivability":   "PHYSSURV",   
                "Armor":                    "ARMOR",      
                "Dodge Chance":             "DODGECHANCE",
                "Critical Avoidance":       "CRITAVOID",  
                "Special Offense":          "SPECOFF",    
                "Special Damage":           "SPECDMG",    
                "Special Critical Chance":  "SPECCRIT",   
                "Resistance Penetration":   "RESPEN",     
                "Special Survivability":    "SPECSURV",   
                "Resistance":               "RESISTANCE", 
                "Deflection Chance":        "DEFLECTION" 
            };

            let keys = Object.keys(stats.final);
            if (keys.indexOf("undefined") >= 0) keys = keys.slice(0, keys.indexOf("undefined"));
            let maxLen;
            try {
                maxLen = keys.reduce((long, str) => Math.max(long, langStr[langMap[str]].length), 0);
            } catch (e) {
                console.log("[MC] Getting maxLen broke: " + e);
            }
            const statArr = [];
            Object.keys(statNames).forEach(sn => {
                let statStr = "== " + sn + " ==\n";
                statNames[sn].forEach(s => {
                    if (!stats.final[s]) stats.final[s] = 0;
                    if (s === "Dodge Chance" || s === "Deflection Chance") {
                        statStr += `${langStr[langMap[s]]}${" ".repeat(maxLen - langStr[langMap[s]].length)} :: 2.00%\n`;
                    } else {
                        statStr += `${langStr[langMap[s]]}${` ${client.zws}`.repeat(maxLen - langStr[langMap[s]].length)} :: `;
                        const str = stats.final[s] % 1 === 0 ? stats.final[s] : (stats.final[s] * 100).toFixed(2)+"%";
                        const modStr = stats.mods[s] ? (stats.mods[s] % 1 === 0 ? `(${stats.mods[s]})` : `(${(stats.mods[s] * 100).toFixed(2)}%)`) : "";
                        statStr += str + " ".repeat(8 - str.length) + modStr + "\n";
                    }
                });
                statArr.push(statStr);
            });

            const fields = [];
            client.msgArray(statArr, "\n", 1000).forEach((m, ix) => {
                fields.push({
                    name: ix === 0 ? "Stats" : "-",
                    value: client.codeBlock(m, "asciidoc")
                });
            });

            if (player.warnings) {
                fields.push({
                    name: "Warnings",
                    value: player.warnings.join("\n")
                });
            }

            return msg.edit({embed: {
                author: {
                    name: (thisChar.player ? thisChar.player : player.name) + "'s " + character.name
                }, 
                description: 
                [
                    `\`${message.language.get("BASE_LEVEL_SHORT")} ${thisChar.level} | ${thisChar.rarity}* | ${parseInt(thisChar.gp)} gp\``,
                    `${message.language.get("BASE_GEAR_SHORT")}: ${thisChar.gear}`,
                    `${gearStr}`
                ].join("\n"),
                fields: [
                    {
                        name: message.language.get("COMMAND_MYCHARACTER_ABILITIES"),
                        value: abilitiesOut.join("\n")
                    }
                ].concat(fields),
                footer: footer
            }});
        } else {
            // You don't have the character
            msg.edit({embed: {
                author: {
                    name: pName + "'s " + character.name
                },
                description: message.language.get("BASE_SWGOH_LOCKED_CHAR"),
                footer: footer
            }});
        }
    }
}

module.exports = MyCharacter;





