import { ApplicationCommandOptionType, InteractionContextType } from "discord.js";
import Command from "../base/slashCommand.ts";
import { characters } from "../data/constants/units.ts";
import emoteStrings from "../data/emoteStrings.ts";
import { expandSpaces, findChar, getBlankUnitImage, getSideColor, msgArray, toProperCase } from "../modules/functions.ts";
import logger from "../modules/Logger.ts";
import swgohAPI from "../modules/swapi.ts";
import type { RawCharacter } from "../types/swapi_types.ts";
import type { CommandContext } from "../types/types.ts";

export default class Character extends Command {
    static readonly metadata = {
        name: "character",
        category: "General",

        guildOnly: false,
        contexts: [InteractionContextType.Guild, InteractionContextType.BotDM],
        description: "Show overall info for the given character",
        options: [
            {
                name: "character",
                autocomplete: true,
                type: ApplicationCommandOptionType.String,
                description: "The character you want to see the gear of",
                required: true,
            },
        ],
    };

    constructor() {
        super(Character.metadata);
    }

    async run({ interaction, language, swgohLanguage }: CommandContext) {
        const searchName = interaction.options.getString("character");

        const abilityMatMK3 = emoteStrings.abilityMatMK3;
        const omega = emoteStrings.omegaMat;
        const zeta = emoteStrings.zetaMat;
        const omicron = emoteStrings.omicronMat;

        // Find any characters that match what they're looking for
        const chars = findChar(searchName, characters);
        if (!chars?.length) {
            const err = language.get("COMMAND_CHARACTER_INVALID_CHARACTER");
            if (err.indexOf("\n") > -1) {
                const [title, usage] = err.split("\n");
                return super.error(interaction, usage, { title: title, example: "abilities Han Solo" });
            }
            return super.error(interaction, err, { example: "abilities Han Solo" });
        }
        if (chars.length > 1) {
            const charL = [];
            const charS = chars.sort((p, c) => (p.name > c.name ? 1 : -1));
            for (const c of charS) {
                charL.push(c.name);
            }
            return super.error(interaction, language.get("BASE_SWGOH_CHAR_LIST", charL.join("\n")));
        }

        const character = chars[0];
        let char: RawCharacter;
        try {
            char = await swgohAPI.getCharacter(character.uniqueName, swgohLanguage);
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            logger.error(`[slash/character] Failed to get character ${character.uniqueName}: ${errorMessage}`);
            return super.error(
                interaction,
                "Sorry, I couldn't fetch character data right now. Please try again later or contact support if this continues.",
            );
        }
        const fields = [];

        if (char.factions.length) {
            fields.push({
                name: "Factions",
                value: char.factions.map((f) => toProperCase(f)).join(", "),
            });
        }

        for (const ability of char.skillReferenceList) {
            // Get the ability type
            const types = ["basic", "special", "leader", "unique", "contract"];
            let type = "Basic";
            for (const t of types) {
                if (ability.skillId.startsWith(t)) {
                    type = toProperCase(t);
                }
            }

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
                logger.log(ability.toString());
            }
            const costStr = costs.length > 0 ? costs.join(" | ") : "";

            let cooldownString = "";
            if (ability.cooldown > 0) {
                cooldownString = language.get("COMMAND_CHARACTER_COOLDOWN", ability.cooldown);
            }

            if (ability.desc && ability.zetaDesc) {
                ability.desc = ability.desc.replace(ability.zetaDesc, `**${ability.zetaDesc}**`);
            }

            const msgArr = msgArray(
                expandSpaces(language.get("COMMAND_CHARACTER_ABILITY", type, costStr, cooldownString, ability.desc)).split(" "),
                " ",
                1000,
            );

            msgArr.forEach((m, ix) => {
                if (ix === 0) {
                    fields.push({
                        name: ability.name,
                        value: m,
                    });
                } else {
                    fields.push({
                        name: "-",
                        value: m,
                    });
                }
            });
        }

        let embeds1Len = 0;
        let useEmbeds2 = false;
        const charImage = await getBlankUnitImage(character.uniqueName);
        const embeds = [
            {
                color: getSideColor(character.side),
                author: {
                    name: character.name,
                    url: character?.url || null,
                },
                thumbnail: charImage ? { url: "attachment://image.png" } : null,
                fields: [],
            },
        ];

        for (const thisField of fields) {
            if (!useEmbeds2 && embeds1Len + thisField.value.length < 5000) {
                // Use msg1
                embeds[0].fields.push(thisField);
                embeds1Len += thisField.value.length;
            } else {
                // Use msg2
                if (!embeds[1]) {
                    embeds.push({
                        color: getSideColor(character.side),
                        author: {
                            name: `${character.name} continued...`,
                            url: null,
                        },
                        fields: [],
                        thumbnail: null,
                    });
                }
                embeds[1].fields.push(thisField);
                useEmbeds2 = true;
            }
        }

        await interaction.reply({
            content: null,
            embeds: [embeds[0]],
            files: charImage
                ? [
                      {
                          attachment: charImage,
                          name: "image.png",
                      },
                  ]
                : null,
        });
        if (embeds.length > 1) {
            await interaction.followUp({ content: null, embeds: [embeds[1]] });
        }
        return;
    }
}
