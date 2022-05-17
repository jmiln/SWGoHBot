import { Interaction } from "discord.js";
import SlashCommand from "../base/slashCommand";
import { emoteIDs } from "../data/emoteIDs";
import { BotInteraction, BotType, UnitObj } from "../modules/types";

class Character extends SlashCommand {
    constructor(Bot: BotType) {
        super(Bot, {
            name: "character",
            guildOnly: false,
            description: "Show overall info for the given character",
            category: "Star Wars",
            permissions: ["EMBED_LINKS"],
            options: [
                {
                    name: "character",
                    type: Bot.constants.optionType.STRING,
                    description: "The character you want to see the gear of",
                    required: true
                },
            ]
        });
    }

    async run(Bot: BotType, interaction: BotInteraction) {
        const searchName = interaction.options.getString("character");
        const abilityMatMK3 = emoteIDs["abilityMatMK3"];
        const omega         = emoteIDs["omegaMat"];
        const zeta          = emoteIDs["zetaMat"];
        const omicron       = emoteIDs["omicronMat"];

        // Find any characters that match what they're looking for
        const chars = Bot.findChar(searchName, Bot.characters);
        if (chars.length <= 0) {
            const err = interaction.language.get("COMMAND_CHARACTER_INVALID_CHARACTER", interaction.guildSettings.prefix);
            if (err.indexOf("\n") > -1) {
                const [title, usage] = err.split("\n");
                return super.error(interaction, usage, {title: title, example: "abilities Han Solo"});
            }
            return super.error(interaction, err, {example: "abilities Han Solo"});
        } else if (chars.length > 1) {
            const charL = [];
            const charS = chars.sort((p: UnitObj, c: UnitObj) => p.name > c.name ? 1 : -1);
            charS.forEach((c: UnitObj) => {
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
                value: char.factions.map((f: string) => Bot.toProperCase(f)).join(", ")
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
                if (ability.cost.AbilityMatOmicron > 0) {
                    costs.push(`${ability.cost.AbilityMatOmicron} ${omicron}`);
                }
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

            msgArr.forEach((m: string, ix: number) => {
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
