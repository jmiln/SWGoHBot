const Command = require("../base/slashCommand");
const { ApplicationCommandOptionType } = require("discord.js");
const {inspect} = require("util");      // eslint-disable-line no-unused-vars

class MyCharacter extends Command {
    constructor(Bot) {
        super(Bot, {
            name: "mycharacter",
            description: "Display overall stats & mod info for the selected character",
            guildOnly: false,
            enabled: true,
            options: [
                {
                    name: "character",
                    description: "Show the stats for a specified character",
                    type: ApplicationCommandOptionType.Subcommand,
                    options: [
                        {
                            name: "character",
                            autocomplete: true,
                            required: true,
                            type: ApplicationCommandOptionType.String,
                            description: "The character you want to show the stats of"
                        },
                        {
                            name: "allycode",
                            description: "The ally code for whoever you're wanting to look up",
                            type: ApplicationCommandOptionType.String
                        },
                    ]
                },
                {
                    name: "ship",
                    description: "Show the stats for a specified ship",
                    type: ApplicationCommandOptionType.Subcommand,
                    options: [
                        {
                            name: "ship",
                            autocomplete: true,
                            required: true,
                            type: ApplicationCommandOptionType.String,
                            description: "The ship you want to show the stats of"
                        },
                        {
                            name: "allycode",
                            description: "The ally code for whoever you're wanting to look up",
                            type: ApplicationCommandOptionType.String
                        },
                    ]
                }
            ]
        });
    }

    async run(Bot, interaction) {
        const searchType = interaction.options.getSubcommand();
        const searchUnit = searchType === "character" ? interaction.options.getString("character") : interaction.options.getString("ship");
        let allycode     = interaction.options.getString("allycode");
        allycode = await Bot.getAllyCode(interaction, allycode);

        if (!allycode) {
            return super.error(interaction, "I could not find a valid allycode. Please make sure you're using a valid code.");
        }

        // Get any matching units
        const units = Bot.findChar(searchUnit, searchType === "ship" ? Bot.ships : Bot.characters, true);

        // If there are no results or too many results, let the user know
        if (units.length === 0) {
            return super.error(interaction, interaction.language.get("BASE_SWGOH_NO_CHAR_FOUND", searchUnit));
        } else if (units.length > 1) {
            const sortedUnitList = units.sort((p, c) => p.name > c.name ? 1 : -1);
            const unitList = sortedUnitList.map(u => u.name);
            return super.error(interaction, interaction.language.get("BASE_SWGOH_CHAR_LIST", unitList.join("\n")));
        }

        // If there's nothing wrong above, grab the single unit and go from there
        const unit = units[0];

        await interaction.reply({content: "Please wait while I look up your profile."});

        const cooldown = await Bot.getPlayerCooldown(interaction.user.id);
        let player = null;
        try {
            player = await Bot.swgohAPI.unitStats(allycode, cooldown);
            if (Array.isArray(player)) player = player[0];
        } catch (e) {
            console.error(e);
            return super.error(interaction, Bot.codeBlock(e.message), {
                title: interaction.language.get("BASE_SOMETHING_BROKE"),
                footer: "Please try again in a bit."
            });
        }

        if (!player?.roster || !player?.updated) {
            return super.error(interaction, "I could not find any player with that ally code, please double check that it's correct");
        }

        const pName = player.name;
        const footerStr = Bot.updatedFooterStr(player.updated, interaction);

        const thisUnit = player.roster.find(c => c.defId === unit.uniqueName);

        // The user doesn't have the unit unlocked, so let em know
        if (!thisUnit) {
            return super.error(interaction, interaction.language.get("BASE_SWGOH_LOCKED_CHAR"), {
                title: `${pName}'s ${unit.name}`,
                description: footerStr
            });
        }

        thisUnit.unit = await Bot.swgohAPI.langChar(thisUnit, interaction.guildSettings.swgohLanguage);

        const stats = thisUnit.stats;
        const isShip = thisUnit.combatType === 2 ? true : false;

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
        if (searchType === "character") {
            gearStr = ["   [0]  [3]", "[1]       [4]", "   [2]  [5]"].join("\n");
            thisUnit.equipped.forEach(e => {
                gearStr = gearStr.replace(e.slot, "X");
            });
            gearStr = gearStr.replace(/[0-9]/g, "  ");
            gearStr = Bot.expandSpaces(gearStr);
        }
        thisUnit.skills.forEach(a => {
            a.type = Bot.toProperCase(a.id.split("_")[0].replace("skill", ""));
            if (a.tier === a.tiers) {
                if (a.isOmicron) {
                    // Maxed Omicron ability
                    a.tierStr = "Max O";
                } else if (a.isZeta) {
                    // Maxed Zeta ability
                    a.tierStr = "Max ✦";
                } else if (isShip) {
                    a.tierStr = "Max";
                } else {
                    // Maxed Omega ability
                    a.tierStr = "Max ⭓";
                }
            } else {
                // Unmaxed ability
                a.tierStr = "Lvl " + a.tier;
            }
            try {
                abilities[`${a.type ? a.type.toLowerCase() : a.defId.toLowerCase()}`].push(`\`${a.tierStr} [${a.type ? a.type.charAt(0) : a.defId.charAt(0)}]\` ${a.nameKey}`);
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
            "Primary Attributes":     [ "Strength", "Agility", "Intelligence" ],
            "General":                [ "Health", "Protection", "Speed", "Critical Damage", "Potency", "Tenacity", "Health Steal", ],
            "Physical Offense":       [ "Physical Damage", "Physical Critical Chance", "Armor Penetration", "Accuracy" ],
            "Physical Survivability": [ "Armor", "Dodge Chance", "Critical Avoidance" ],
            "Special Offense":        [ "Special Damage", "Special Critical Chance", "Resistance Penetration", "Accuracy" ],
            "Special Survivability":  [ "Resistance", "Deflection Chance", "Critical Avoidance" ]
        };

        const langStr = interaction.language.get("BASE_STAT_NAMES");
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

        if (!stats) return super.error(interaction, "Something went wrong. Please make sure you have that character unlocked");
        if (!stats.final) return super.error(interaction, "Something went wrong, I couldn't get the stats for that character");

        let keys = Object.keys(stats.final);
        if (keys.indexOf("undefined") >= 0) keys = keys.slice(0, keys.indexOf("undefined"));
        let maxLen;
        try {
            maxLen = keys.reduce((long, str) => Math.max(long, langStr[langMap[str]] ? langStr[langMap[str]].length : 0), 0);
        } catch (e) {
            Bot.logger.error("[MyCharacter] Getting maxLen broke: " + e);
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
                const thisLangStr = langStr[langMap[s]];
                if (!thisLangStr?.length) {
                    console.log("[/mycharacter] Missing stat langStr:");
                    console.log(s, thisLangStr);
                    statStr += s + " ".repeat(8 - s.length) + "\n";
                } else {
                    const rep = maxLen - (thisLangStr?.length || 0);
                    if (s === "Dodge Chance" || s === "Deflection Chance") {
                        statStr += `${langStr[langMap[s]]}${" ".repeat(rep > 0 ? rep : 0)} :: 2.00%\n`;
                    } else {
                        statStr += `${langStr[langMap[s]]}${" ".repeat(rep > 0 ? rep : 0)} :: `;
                        const str = stats.final[s] % 1 === 0 ? stats.final[s].toLocaleString() : (stats.final[s] * 100).toFixed(2)+"%";
                        const modStr = isShip ? "" : stats.mods[s] ? (stats.mods[s] % 1 === 0 ? `(${stats.mods[s].toLocaleString()})` : `(${(stats.mods[s] * 100).toFixed(2)}%)`) : "";
                        statStr += str + " ".repeat(8 - str.length) + modStr + "\n";
                    }
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
                `${interaction.language.get("BASE_GEAR_SHORT")}: ${thisUnit.gear}`,
                `${gearStr}`
            ].join("\n");
        }

        const unitImg = await Bot.getUnitImage(thisUnit.defId, thisUnit);

        fields.push({
            name: Bot.constants.zws,
            value: footerStr
        });

        if (!unitImg) {
            // If it couldn't get an image for the character
            return interaction.editReply({
                content: null,
                embeds: [{
                    author: {
                        name: (thisUnit.player ? thisUnit.player : player.name) + "'s " + unit.name,
                        url: unit.url || null,
                        icon_url: unit.avatarURL || null
                    },
                    description: `\`${interaction.language.get("BASE_LEVEL_SHORT")} ${thisUnit.level} | ${thisUnit.rarity}* | ${parseInt(thisUnit.gp, 10)} gp\`${gearOut}`,
                    fields: [
                        {
                            name: interaction.language.get("COMMAND_MYCHARACTER_ABILITIES"),
                            value: abilitiesOut.length ? abilitiesOut.join("\n") : "Couldn't find abilities"
                        }
                    ].concat(fields),
                }]
            });
        }

        // But if it could, go ahead and send it
        return interaction.editReply({
            content: null,
            embeds: [{
                author: {
                    name: (thisUnit.player ? thisUnit.player : player.name) + "'s " + unit.name,
                    url: unit.url
                },
                thumbnail: { url: "attachment://image.png" },
                description: `\`${interaction.language.get("BASE_LEVEL_SHORT")} ${thisUnit.level} | ${thisUnit.rarity}* | ${parseInt(thisUnit.gp, 10)} gp\`${gearOut}`,
                fields: [
                    {
                        name: interaction.language.get("COMMAND_MYCHARACTER_ABILITIES"),
                        value: abilitiesOut.length ? abilitiesOut.join("\n") : "Couldn't find abilities"
                    }
                ].concat(fields),
            }],
            files: [{
                attachment: unitImg,
                name: "image.png"
            }]
        });
    }
}

module.exports = MyCharacter;
