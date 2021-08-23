const Command = require("../base/slashCommand");

class Mods extends Command {
    constructor(Bot) {
        super(Bot, {
            name: "mods",
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
        const client = interaction.client;

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
                ""                   : "COMMAND_MODS_EMPTY_SET",
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

        const getCharacterMods = function(character) {
            let mods = character.defaultMods;
            if (JSON.stringify(character.mods) !== JSON.stringify({})) {
                mods = character.mods;
            }

            return mods;
        };

        // Remove any junk from the name
        const searchName = interaction.options.getString("character");

        // Check if it should send as an embed or a code block
        const guildConf = interaction.guildSettings;
        let embeds = true;
        if (interaction.guild) {
            if (guildConf["useEmbeds"] !== true || !interaction.channel.permissionsFor(client.user).has("EMBED_LINKS")) {
                embeds = false;
            }
        }

        // Make sure they gave a character to find
        if (searchName === "") {
            return super.error(interaction, interaction.language.get("COMMAND_MODS_NEED_CHARACTER", interaction.guildSettings.prefix));
        }

        // Find any characters that match that
        const chars = Bot.findChar(searchName, charList);
        if (!chars || chars.length <= 0) {
            return super.error(interaction, interaction.language.get("COMMAND_MODS_USAGE", interaction.guildSettings.prefix), {
                title: interaction.language.get("COMMAND_MODS_INVALID_CHARACTER_HEADER"),
                example: "mods darth vader"
            });
        } else if (chars.length > 1) {
            const charL = [];
            const charS = chars.sort((p, c) => p.name > c.name ? 1 : -1);
            charS.forEach(c => {
                charL.push(c.name);
            });
            return super.error(interaction, interaction.language.get("BASE_SWGOH_CHAR_LIST", charL.join("\n")));
        }

        chars.forEach(character => {
            if (embeds) { // If Embeds are enabled
                const fields = [];
                const characterMods = getCharacterMods(character);
                for (var modSet in characterMods) {
                    const mods = getLocalizedModAdvice(characterMods[modSet]);
                    const modSetString = "* " + mods.sets.join("\n* ");

                    let modPrimaryString = interaction.language.get("COMMAND_MODS_EMBED_STRING1", mods.square, mods.arrow, mods.diamond);
                    modPrimaryString += interaction.language.get("COMMAND_MODS_EMBED_STRING2", mods.triangle, mods.circle, mods.cross);

                    fields.push({
                        "name": modSet,
                        "value": interaction.language.get("COMMAND_MODS_EMBED_OUTPUT", modSetString, modPrimaryString),
                        "inline": true
                    });
                }
                const embed = {
                    "color": `${character.side === "light" ? "#0055FF" : "#E01414"}`,
                    "author": {
                        "name": character.name,
                        "url": character.url,
                        "icon_url": character.avatarURL
                    },
                    "footer": {
                        "icon_url": "https://cdn.discordapp.com/attachments/329514150105448459/361268366180352002/crouchingRancor.png",
                        "text": "Mods via apps.crouchingrancor.com"
                    }
                };
                if (!fields.length) { // If there are no sets there
                    embed.description = interaction.language.get("COMMAND_NO_MODSETS");
                } else {
                    embed.fields = fields;
                }
                return interaction.reply({
                    embeds: [embed]
                });
            } else { // Embeds are disabled
                const characterMods = getCharacterMods(character);
                for (const modSet in characterMods) {
                    const mods = getLocalizedModAdvice(characterMods[modSet]);
                    const modSetString = "* " + mods.sets.join("\n* ");

                    let modPrimaryString = interaction.language.get("COMMAND_MODS_CODE_STRING1", mods.square, mods.arrow, mods.diamond);
                    modPrimaryString += interaction.language.get("COMMAND_MODS_CODE_STRING2", mods.triangle, mods.circle, mods.cross);

                    return interaction.reply({content: Bot.codeBlock(interaction.language.get("COMMAND_MODS_CODE_OUTPUT", character.name, modSetString, modPrimaryString), "md")}); //TODO , { code: "md", split: true });
                }
            }
        });
    }
}

module.exports = Mods;
