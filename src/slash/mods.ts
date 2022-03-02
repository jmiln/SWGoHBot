const Command = require("../base/slashCommand");

class Mods extends Command {
    constructor(Bot) {
        super(Bot, {
            name: "mods",
            guildOnly: false,
            aliases: ["m", "mod"],
            category: "Star Wars",
            permissions: ["EMBED_LINKS"],
            description: "Display some suggested mod loadouts based on apps.crouchingrancor.com",
            options: [
                {
                    name: "character",
                    required: true,
                    description: "The character you want to see the mods for",
                    type: "STRING"
                },
            ]
        });
    }

    async run(Bot, interaction) {
        const charList = Bot.characters;

        const getLocalizedModString = function(key) {
            const localizationKeyMap = {
                "Critical Chance x2" : "COMMAND_MODS_CRIT_CHANCE_SET",
                "Critical Damage x4" : "COMMAND_MODS_CRIT_DAMAGE_SET",
                "Speed x4"           : "COMMAND_MODS_SPEED_SET",
                "Tenacity x2"        : "COMMAND_MODS_TENACITY_SET",
                "Offense x4"         : "COMMAND_MODS_OFFENSE_SET",
                "Potency x2"         : "COMMAND_MODS_POTENCY_SET",
                "Health x2"          : "COMMAND_MODS_HEALTH_SET",
                "Defense x2"         : "COMMAND_MODS_DEFENSE_SET",
                ""                   : " ",
                "Accuracy"           : "COMMAND_MODS_ACCURACY_STAT",
                "Crit. Chance"       : "COMMAND_MODS_CRIT_CHANCE_STAT",
                "Crit. Damage"       : "COMMAND_MODS_CRIT_DAMAGE_STAT",
                "Critical Damage"    : "COMMAND_MODS_CRIT_DAMAGE_STAT",
                "Defense"            : "COMMAND_MODS_DEFENSE_STAT",
                "Health"             : "COMMAND_MODS_HEALTH_STAT",
                "Offense"            : "COMMAND_MODS_OFFENSE_STAT",
                "Protection"         : "COMMAND_MODS_PROTECTION_STAT",
                "Potency"            : "COMMAND_MODS_POTENCY_STAT",
                "Speed"              : "COMMAND_MODS_SPEED_STAT",
                "Tenacity"           : "COMMAND_MODS_TENACITY_STAT"
            };

            const keyArray = key.split("/ ");
            const valueArray = [];

            for (const index in keyArray) {
                const  key = keyArray[index].trim();
                let localizationKey = "COMMAND_MODS_UNKNOWN";

                if (localizationKeyMap[key]) {
                    localizationKey = localizationKeyMap[key];
                }

                valueArray.push(interaction.language.get(localizationKey));
            }

            return valueArray.join("/ ");
        };

        const getLocalizedModAdvice = function(modAdvice) {
            const sets = [];

            for (const i in modAdvice.sets) {
                const thisSet = modAdvice.sets[i];
                sets[i] = getLocalizedModString(thisSet);
            }

            const modOut = {
                "sets"     : sets,
                "square"   : getLocalizedModString(modAdvice.square),
                "arrow"    : getLocalizedModString(modAdvice.arrow),
                "diamond"  : getLocalizedModString(modAdvice.diamond),
                "triangle" : getLocalizedModString(modAdvice.triangle),
                "circle"   : getLocalizedModString(modAdvice.circle),
                "cross"    : getLocalizedModString(modAdvice.cross),
                "source"   : modAdvice.source
            };
            return modOut;
        };

        // Grab the character that they're searching for
        const searchName = interaction.options.getString("character");

        // Find any characters that match that
        const chars = Bot.findChar(searchName, charList);
        if (!chars || chars.length <= 0) {
            return super.error(interaction, interaction.language.get("COMMAND_MODS_USAGE", interaction.guildSettings.prefix), {
                title: interaction.language.get("COMMAND_MODS_INVALID_CHARACTER_HEADER"),
            });
        } else if (chars.length > 1) {
            const charL = [];
            const charS = chars.sort((p, c) => p.name > c.name ? 1 : -1);
            charS.forEach(c => {
                charL.push(c.name);
            });
            return super.error(interaction, interaction.language.get("BASE_SWGOH_CHAR_LIST", charL.join("\n")));
        }

        const character = chars[0];
        let description = interaction.language.get("COMMAND_NO_MODSETS");

        if (character.mods && Object.keys(character.mods).length) {
            const mods = getLocalizedModAdvice(character.mods);
            const modSetString = "* " + mods.sets.join("\n* ");

            let modPrimaryString = interaction.language.get("COMMAND_MODS_EMBED_STRING1", mods.square,   mods.arrow,  mods.diamond);
            modPrimaryString    += interaction.language.get("COMMAND_MODS_EMBED_STRING2", mods.triangle, mods.circle, mods.cross);

            description = interaction.language.get("COMMAND_MODS_EMBED_OUTPUT", modSetString, modPrimaryString);
        }
        return interaction.reply({
            embeds: [{
                color: character.side === "light" ? "#0055FF" : "#E01414",
                author: {
                    name: character.name,
                    url: character.mods.url,
                    icon_url: character.avatarURL
                },
                description: description,
                footer: {
                    icon_url: "https://swgoh.gg/static/img/swgohgg-nav-orange.png",
                    text: "Mods via https://www.swgoh.gg"
                }
            }]
        });
    }
}

module.exports = Mods;
