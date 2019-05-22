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
            flags: {
                ships: {
                    aliases: ["s", "ship"]
                }
            }
        });
    }

    async run(client, message, args, options) {
        const {allyCode, searchChar, err} = await super.getUserAndChar(message, args);

        if (err) {
            return super.error(message, err);
        }

        let chars = [];
        if (!options.flags.ships) {
            chars = client.findChar(searchChar, client.characters);
        }
        if (!chars.length) {
            chars = client.findChar(searchChar, client.ships, true);
        }
        let character;
        if (!searchChar) {
            return super.error(message, message.language.get("BASE_SWGOH_MISSING_CHAR"));
        }

        if (chars.length === 0) {
            return super.error(message, message.language.get("BASE_SWGOH_NO_CHAR_FOUND", searchChar));
        } else if (chars.length > 1) {
            const charL = [];
            const charS = chars.sort((p, c) => p.name > c.name ? 1 : -1);
            charS.forEach(c => {
                charL.push(c.name);
            });
            return super.error(message, message.language.get("BASE_SWGOH_CHAR_LIST", charL.join("\n")));
        } else {
            character = chars[0];
        }

        const msg = await message.channel.send("Please wait while I look up your profile.");

        const cooldown = client.getPlayerCooldown(message.author.id);
        let pName;
        let player = null;
        try {
            player = await client.swgohAPI.unitStats(allyCode, cooldown);
            if (Array.isArray(player)) player = player[0];
        } catch (e) {
            console.error(e);
            return super.error(message, client.codeBlock(e.message), {
                title: message.language.get("BASE_SOMETHING_BROKE"),
                footer: "Please try again in a bit."
            });
        }

        if (player && player.stats) {
            pName = player.name;
        }
        const footer = client.updatedFooter(player.updated, message, "player", cooldown);

        let thisChar = player.stats.filter(c => c.unit.defId === character.uniqueName);
        if (thisChar.length && Array.isArray(thisChar)) thisChar = thisChar[0];

        if (thisChar && !Array.isArray(thisChar)) {
            thisChar.unit = await client.swgohAPI.langChar(thisChar.unit, message.guildSettings.swgohLanguage);
            const stats = thisChar.stats;
            thisChar = thisChar.unit;
            const isShip = thisChar.crew.length ? true : false;

            const abilities = {
                basic: [],
                special: [],
                leader: [],
                unique: [],
                contract: [],
                crew: [],
                hardware: []
            };

            let gearStr;
            if (!isShip) {
                gearStr = ["   [0]  [3]", "[1]       [4]", "   [2]  [5]"].join("\n");
                thisChar.equipped.forEach(e => {
                    gearStr = gearStr.replace(e.slot, "X");
                });
                gearStr = gearStr.replace(/[0-9]/g, "  ");
                gearStr = client.expandSpaces(gearStr);
            }
            thisChar.skills.forEach(a => {
                a.type = a.id.split("_")[0].replace("skill", "").toProperCase();
                if (a.tier === 8 || (a.tier === 3 && (a.type === "Contract" || a.type === "Hardware"))) {
                    if (a.isZeta) {
                        // Maxed Zeta ability
                        a.tier = "Max ✦";
                    } else if (isShip) {
                        a.tier = "Max";
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
                .concat(abilities.crew)
                .concat(abilities.contract)
                .concat(abilities.hardware);

            const statNames = {
                "Primary Attributes" : [ "Strength", "Agility", "Intelligence" ],
                "General": [ "Health", "Protection", "Speed", "Critical Damage", "Potency", "Tenacity", "Health Steal", ],
                "Physical Offense": [ "Physical Damage", "Physical Critical Chance", "Armor Penetration", "Accuracy" ],
                "Physical Survivability": [ "Armor", "Dodge Chance", "Critical Avoidance" ],
                "Special Offense": [ "Special Damage", "Special Critical Chance", "Resistance Penetration", "Accuracy" ],
                "Special Survivability": [ "Resistance", "Deflection Chance", "Critical Avoidance" ]
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

            if (!stats) return super.error(message, "Something went wrong. Please make sure you have that character unlocked");

            let keys = Object.keys(stats);
            if (keys.indexOf("undefined") >= 0) keys = keys.slice(0, keys.indexOf("undefined"));
            let maxLen;
            try {
                maxLen = keys.reduce((long, str) => Math.max(long, langStr[langMap[str]] ? langStr[langMap[str]].length : 0), 0);
            } catch (e) {
                console.log("[MC] Getting maxLen broke: " + e);
            }
            const statArr = [];
            Object.keys(statNames).forEach(sn => {
                let statStr = "== " + sn + " ==\n";
                statNames[sn].forEach(s => {
                    if (!stats[s]) stats[s] = {base: 0, final: 0, mods: 0, pct: false};
                    if (s === "Dodge Chance" || s === "Deflection Chance") {
                        statStr += `${langStr[langMap[s]]}${" ".repeat(maxLen - langStr[langMap[s]].length)} :: 2.00%\n`;
                    } else {
                        statStr += `${langStr[langMap[s]]}${" ".repeat(maxLen - langStr[langMap[s]].length)} :: `;
                        const str = !stats[s].pct ? parseInt(stats[s].final) : (stats[s].final * 100).toFixed(2)+"%";
                        const modStr = stats[s].mods > 0 ? (!stats[s].pct ? `(${parseInt(stats[s].mods)})` : `(${(stats[s].mods * 100).toFixed(2)}%)`) : "";
                        statStr += str + " ".repeat(8 - str.toString().length) + modStr + "\n";
                    }
                });
                statArr.push(client.expandSpaces(statStr));
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
            let gearOut = "";
            if (!isShip) {
                // If it's a character, go ahead and work out the gear
                gearOut = "\n" + [
                    `${message.language.get("BASE_GEAR_SHORT")}: ${thisChar.gear}`,
                    `${gearStr}`
                ].join("\n");
            }

            return msg.edit({embed: {
                author: {
                    name: (thisChar.player ? thisChar.player : player.name) + "'s " + character.name,
                    url: character.url,
                    icon_url: character.avatarURL
                },
                description: `\`${message.language.get("BASE_LEVEL_SHORT")} ${thisChar.level} | ${thisChar.rarity}* | ${parseInt(thisChar.gp)} gp\`${gearOut}`,
                fields: [
                    {
                        name: message.language.get("COMMAND_MYCHARACTER_ABILITIES"),
                        value: abilitiesOut.length ? abilitiesOut.join("\n") : "Couldn't find abilities"
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





