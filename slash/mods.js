const Command = require("../base/slashCommand");
const { ApplicationCommandOptionType } = require("discord.js");

class Mods extends Command {
    constructor(Bot) {
        super(Bot, {
            name: "mods",
            guildOnly: false,
            description: "Display some suggested mod loadouts based on the most common loadouts by players in top 100 guilds.",
            options: [
                {
                    name: "character",
                    required: true,
                    autocomplete: true,
                    description: "The character you want to see the mods for",
                    type: ApplicationCommandOptionType.String,
                },
            ],
        });
    }

    async run(Bot, interaction) {
        await interaction.deferReply();
        const charList = Bot.characters;

        const getLocalizedModString = (key) => {
            const localizationKeyMap = {
                "Critical Chance x2": "COMMAND_MODS_CRIT_CHANCE_SET",
                "Critical Damage x4": "COMMAND_MODS_CRIT_DAMAGE_SET",
                "Crit. Chance x2": "COMMAND_MODS_CRIT_CHANCE_SET",
                "Crit. Damage x4": "COMMAND_MODS_CRIT_DAMAGE_SET",
                "Speed x4": "COMMAND_MODS_SPEED_SET",
                "Tenacity x2": "COMMAND_MODS_TENACITY_SET",
                "Offense x4": "COMMAND_MODS_OFFENSE_SET",
                "Potency x2": "COMMAND_MODS_POTENCY_SET",
                "Health x2": "COMMAND_MODS_HEALTH_SET",
                "Defense x2": "COMMAND_MODS_DEFENSE_SET",
                "": " ",
                Accuracy: "COMMAND_MODS_ACCURACY_STAT",
                "Crit. Chance": "COMMAND_MODS_CRIT_CHANCE_STAT",
                "Crit. Damage": "COMMAND_MODS_CRIT_DAMAGE_STAT",
                "Critical Damage": "COMMAND_MODS_CRIT_DAMAGE_STAT",
                Defense: "COMMAND_MODS_DEFENSE_STAT",
                Health: "COMMAND_MODS_HEALTH_STAT",
                Offense: "COMMAND_MODS_OFFENSE_STAT",
                Protection: "COMMAND_MODS_PROTECTION_STAT",
                Potency: "COMMAND_MODS_POTENCY_STAT",
                Speed: "COMMAND_MODS_SPEED_STAT",
                Tenacity: "COMMAND_MODS_TENACITY_STAT",
            };

            const keyArray = key.split("/ ");
            const valueArray = [];

            for (const index in keyArray) {
                const key = keyArray[index].trim();
                let localizationKey = "COMMAND_MODS_UNKNOWN";

                if (localizationKeyMap[key]) {
                    localizationKey = localizationKeyMap[key];
                }

                valueArray.push(interaction.language.get(localizationKey));
            }

            return valueArray.join("/ ");
        };

        const getLocalizedModAdvice = (modAdvice) => {
            const sets = [];

            for (const i in modAdvice.sets) {
                const thisSet = modAdvice.sets[i];
                sets[i] = getLocalizedModString(thisSet);
            }

            const modOut = {
                sets: sets,
                square: getLocalizedModString(modAdvice.square),
                arrow: getLocalizedModString(modAdvice.arrow),
                diamond: getLocalizedModString(modAdvice.diamond),
                triangle: getLocalizedModString(modAdvice.triangle),
                circle: getLocalizedModString(modAdvice.circle),
                cross: getLocalizedModString(modAdvice.cross),
                source: modAdvice.source,
            };
            return modOut;
        };

        // Grab the character that they're searching for
        const searchName = interaction.options.getString("character");

        // Find any characters that match that
        const chars = Bot.findChar(searchName, charList);
        if (!chars?.length) {
            return super.error(
                interaction,
                interaction.language.get("COMMAND_MODS_USAGE") || "Usage is `/mods character: <characterName>`",
                {
                    title: interaction.language.get("COMMAND_MODS_INVALID_CHARACTER_HEADER") || "Invalid Character",
                },
            );
        }
        if (chars.length > 1) {
            const charL = [];
            const charS = chars.sort((p, c) => (p.name > c.name ? 1 : -1));
            for (const c of charS) {
                charL.push(c.name);
            }
            return super.error(interaction, interaction.language.get("BASE_SWGOH_CHAR_LIST", charL.join("\n")));
        }

        const character = chars[0];
        let description = interaction.language.get("COMMAND_NO_MODSETS");

        if (character.mods && Object.keys(character.mods).length) {
            const mods = getLocalizedModAdvice(character.mods);
            const modSetString = `* ${mods.sets.join("\n* ")}`;

            let modPrimaryString = interaction.language.get("COMMAND_MODS_EMBED_STRING1", mods.square, mods.arrow, mods.diamond);
            modPrimaryString += interaction.language.get("COMMAND_MODS_EMBED_STRING2", mods.triangle, mods.circle, mods.cross);

            description = interaction.language.get("COMMAND_MODS_EMBED_OUTPUT", modSetString, modPrimaryString);
        }
        return interaction.editReply({
            embeds: [
                {
                    color: Bot.getSideColor(character.side),
                    author: {
                        name: character.name,
                        icon_url: character.avatarURL,
                    },
                    description: description,
                },
            ],
        });
    }
}

module.exports = Mods;
