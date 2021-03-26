const Command = require("../base/Command");
const nodeFetch = require("node-fetch");
const {promisify, inspect} = require("util");      // eslint-disable-line no-unused-vars

// const {statEnum, base, pct} = require("../data/statEnums");

class MyCharacter extends Command {
    constructor(Bot) {
        super(Bot, {
            name: "mycharacter",
            category: "SWGoH",
            enabled: true,
            aliases: ["mc", "mychar"],
            permissions: ["EMBED_LINKS", "ATTACH_FILES"],
            permLevel: 0,
            flags: {
                ships: {
                    aliases: ["s", "ship"]
                }
            }
        });
    }

    async run(Bot, message, args, options) {
        const {allyCode, searchChar, err} = await super.getUserAndChar(message, args);

        if (err) {
            return super.error(message, err);
        }

        let chars = [];
        if (!options.flags.ships) {
            chars = Bot.findChar(searchChar, Bot.characters);
        }
        if (!chars.length) {
            chars = Bot.findChar(searchChar, Bot.ships, true);
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

        const cooldown = await Bot.getPlayerCooldown(message.author.id);
        let pName;
        let player = null;
        try {
            player = await Bot.swgohAPI.unitStats(allyCode, cooldown);
            if (Array.isArray(player)) player = player[0];
        } catch (e) {
            console.error(e);
            return super.error(message, Bot.codeBlock(e.message), {
                title: message.language.get("BASE_SOMETHING_BROKE"),
                footer: "Please try again in a bit."
            });
        }

        if (player && player.roster) {
            pName = player.name;
        }
        const footer = Bot.updatedFooter(player.updated, message, "player", cooldown);

        let thisChar = player.roster.filter(c => c.defId === character.uniqueName);
        if (thisChar.length && Array.isArray(thisChar)) thisChar = thisChar[0];

        if (thisChar && !Array.isArray(thisChar)) {
            thisChar.unit = await Bot.swgohAPI.langChar(thisChar, message.guildSettings.swgohLanguage);

            const stats = thisChar.stats;
            const isShip = thisChar.combatType === 2 ? true : false;

            let charImg;
            const charArr = [thisChar.defId];
            charArr.push(thisChar.rarity);
            charArr.push(thisChar.level);
            charArr.push(thisChar.gear);
            charArr.push(thisChar.skills.filter(s => s.isZeta && s.tier == s.tiers).length);  // Zeta count
            if (thisChar.relic?.currentTier) {
                charArr.push(thisChar.relic.currentTier);  // Relic count
            }
            charArr.push(character.side);

            try {
                await nodeFetch(Bot.config.imageServIP_Port + "/char/" + charArr.join("/"))
                    .then(response => response.buffer())
                    .then(image => {
                        charImg = image;
                    });
            } catch (e) {
                Bot.logger.error("ImageFetch in myCharacter broke: " + e);
            }

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
                gearStr = Bot.expandSpaces(gearStr);
            }
            thisChar.skills.forEach(a => {
                a.type = a.id.split("_")[0].replace("skill", "").toProperCase();
                if (a.tier === a.tiers) {
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
                    Bot.logger.error("ERROR[MC]: bad ability type: " + inspect(a));
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
                "Physical Accuracy":        "ACCURACY",
                "Physical Offense":         "PHYSOFF",
                "Physical Damage":          "PHYSDMG",
                "Physical Critical Chance": "PHYSCRIT",
                "Physical Critical Rating": "PHYSCRIT",
                "Armor Penetration":        "ARMORPEN",
                "Accuracy":                 "ACCURACY",
                "Physical Survivability":   "PHYSSURV",
                "Armor":                    "ARMOR",
                "Dodge Chance":             "DODGECHANCE",
                "Critical Avoidance":       "CRITAVOID",
                "Special Offense":          "SPECOFF",
                "Special Damage":           "SPECDMG",
                "Special Critical Chance":  "SPECCRIT",
                "Special Critical Rating":  "SPECCRIT",
                "Resistance Penetration":   "RESPEN",
                "Special Survivability":    "SPECSURV",
                "Resistance":               "RESISTANCE",
                "Deflection Chance":        "DEFLECTION"
            };

            if (!stats) return super.error(message, "Something went wrong. Please make sure you have that character unlocked");

            let keys = Object.keys(stats.final);
            if (keys.indexOf("undefined") >= 0) keys = keys.slice(0, keys.indexOf("undefined"));
            let maxLen;
            try {
                maxLen = keys.reduce((long, str) => Math.max(long, langStr[langMap[str]] ? langStr[langMap[str]].length : 0), 0);
            } catch (e) {
                Bot.logger.error("[MC] Getting maxLen broke: " + e);
            }

            // Stick in some standatd keys to help it not be wonky
            if (stats.final["Physical Accuracy"] && stats.final["Special Accuracy"]) stats.final["Accuracy"] = stats.final["Physical Accuracy"];
            if (stats.final["Physical Critical Rating"]) stats.final["Physical Critical Chance"] = stats.final["Physical Critical Rating"];
            if (stats.final["Special Critical Rating"]) stats.final["Special Critical Chance"] = stats.final["Special Critical Rating"];

            const statArr = [];
            Object.keys(statNames).forEach(sn => {
                let statStr = "== " + sn + " ==\n";
                statNames[sn].forEach(s => {
                    if (s.indexOf("Rating") >= 0) s = s.replace("Rating", "Chance");
                    if (!stats.final[s]) stats.final[s] = 0;
                    const rep = maxLen - langStr[langMap[s]].length;
                    if (s === "Dodge Chance" || s === "Deflection Chance") {
                        statStr += `${langStr[langMap[s]]}${" ".repeat(rep > 0 ? rep : 0)} :: 2.00%\n`;
                    } else {
                        statStr += `${langStr[langMap[s]]}${" ".repeat(rep > 0 ? rep : 0)} :: `;
                        const str = stats.final[s] % 1 === 0 ? stats.final[s].toLocaleString() : (stats.final[s] * 100).toFixed(2)+"%";
                        const modStr = isShip ? "" : stats.mods[s] ? (stats.mods[s] % 1 === 0 ? `(${stats.mods[s].toLocaleString()})` : `(${(stats.mods[s] * 100).toFixed(2)}%)`) : "";
                        statStr += str + " ".repeat(8 - str.length) + modStr + "\n";
                    }
                });
                statArr.push(Bot.expandSpaces(statStr));
            });

            const fields = [];
            Bot.msgArray(statArr, "\n", 1000).forEach((m, ix) => {
                fields.push({
                    name: ix === 0 ? "Stats" : "-",
                    value: Bot.codeBlock(m, "asciidoc")
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

            if (!charImg) {
                // If it couldn't get an image for the character
                return msg.edit({embed: {
                    author: {
                        name: (thisChar.player ? thisChar.player : player.name) + "'s " + character.name,
                        url: character.url,
                        icon_url: character.avatarURL
                    },
                    description: `\`${message.language.get("BASE_LEVEL_SHORT")} ${thisChar.level} | ${thisChar.rarity}* | ${parseInt(thisChar.gp, 10)} gp\`${gearOut}`,
                    fields: [
                        {
                            name: message.language.get("COMMAND_MYCHARACTER_ABILITIES"),
                            value: abilitiesOut.length ? abilitiesOut.join("\n") : "Couldn't find abilities"
                        }
                    ].concat(fields),
                    footer: footer
                }});
            } else {
                // But if it could, go ahead and send it
                return message.channel.send({embed: {
                    author: {
                        name: (thisChar.player ? thisChar.player : player.name) + "'s " + character.name,
                        url: character.url,
                        icon_url: character.avatarURL
                    },
                    thumbnail: { url: "attachment://image.png" },
                    description: `\`${message.language.get("BASE_LEVEL_SHORT")} ${thisChar.level} | ${thisChar.rarity}* | ${parseInt(thisChar.gp, 10)} gp\`${gearOut}`,
                    fields: [
                        {
                            name: message.language.get("COMMAND_MYCHARACTER_ABILITIES"),
                            value: abilitiesOut.length ? abilitiesOut.join("\n") : "Couldn't find abilities"
                        }
                    ].concat(fields),
                    footer: footer,
                    files: [{
                        attachment: charImg,
                        name: "image.png"
                    }]
                }});
            }
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
