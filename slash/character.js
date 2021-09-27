const Command = require("../base/slashCommand");

class Character extends Command {
    constructor(Bot) {
        super(Bot, {
            name: "character",
            guildOnly: false,
            description: "Show overall info for the given character",
            category: "Star Wars",
            aliases: ["characters", "char", "ab", "abilities"],
            permissions: ["EMBED_LINKS"],
            options: [
                {
                    name: "character",
                    type: "STRING",
                    description: "The character you want to see the gear of",
                    required: true
                },
            ]
        });
    }

    async run(Bot, interaction) {
        const charList = Bot.characters;

        const searchName = interaction.options.getString("character");

        const zeta = Bot.emotes["zetaMat"];
        const omega = Bot.emotes["omegaMat"];
        const abilityMatMK3 = Bot.emotes["abilityMatMK3"];

        // Find any characters that match what they're looking for
        const chars = Bot.findChar(searchName, charList);
        if (chars.length <= 0) {
            const err = interaction.language.get("COMMAND_CHARACTER_INVALID_CHARACTER", interaction.guildSettings.prefix);
            if (err.indexOf("\n") > -1) {
                const [title, usage] = err.split("\n");
                return super.error(interaction, usage, {title: title, example: "abilities Han Solo"});
            }
            return super.error(interaction, err, {example: "abilities Han Solo"});
        } else if (chars.length > 1) {
            const charL = [];
            const charS = chars.sort((p, c) => p.name > c.name ? 1 : -1);
            charS.forEach(c => {
                charL.push(c.name);
            });
            return super.error(interaction, interaction.language.get("BASE_SWGOH_CHAR_LIST", charL.join("\n")));
        }

        const character = chars[0];

        const char = await Bot.swgohAPI.getCharacter(character.uniqueName, interaction.guildSettings.swgohLanguage);

        const fields = [];

        if (char.factions.length) {
            fields.push({
                name: "Factions",
                value: char.factions.map(f => Bot.toProperCase(f)).join(", ")
            });
        }

        for (const ability of char.skillReferenceList) {
            // Get the ability type
            const types = ["basic", "special", "leader", "unique", "contract"];
            let type = "Basic";
            types.forEach(t => {
                if (ability.skillId.startsWith(t)) {
                    type = Bot.toProperCase(t);
                }
            });

            const costs = [];
            if (ability.cost) {
                if (ability.cost.AbilityMatZeta > 0) {
                    costs.push(`${ability.cost.AbilityMatZeta} ${zeta}`);
                }
                if (ability.cost.AbilityMatOmega > 0) {
                    costs.push(`${ability.cost.AbilityMatOmega} ${omega}`);
                }
                if (ability.cost.AbilityMatMk3 > 0) {
                    costs.push(`${ability.cost.AbilityMatMk3} ${abilityMatMK3}`);
                }
            } else {
                Bot.logger.log(ability);
            }
            const costStr = costs.length > 0 ? costs.join(" | ") : "";

            var cooldownString = "";
            if (ability.cooldown > 0) {
                cooldownString = interaction.language.get("COMMAND_CHARACTER_COOLDOWN", ability.cooldown);
            }

            const msgArr = Bot.msgArray(Bot.expandSpaces(interaction.language.get("COMMAND_CHARACTER_ABILITY", type, costStr, cooldownString, ability.desc)).split(" "), " ", 1000);

            msgArr.forEach((m, ix) => {
                if (ix === 0) {
                    fields.push({
                        "name": ability.name,
                        "value": m
                    });
                } else {
                    fields.push({
                        "name": "-",
                        "value": m
                    });
                }
            });
        }

        return interaction.reply({
            embeds: [{
                "color": `${character.side === "light" ? "#5114e0" : "#e01414"}`,
                "author": {
                    "name": character.name,
                    "url": character.url,
                    "icon_url": character.avatarURL
                },
                "fields": fields
            }]
        });
    }
}

module.exports = Character;
