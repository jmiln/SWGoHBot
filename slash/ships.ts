import { ApplicationCommandOptionType, InteractionContextType } from "discord.js";
import Command from "../base/slashCommand.ts";
import { characters, ships } from "../data/constants/units.ts";
import { expandSpaces, findChar, getBlankUnitImage, getSideColor, msgArray, toProperCase } from "../modules/functions.ts";
import swgohAPI from "../modules/swapi.ts";
import type { BotInteraction } from "../types/types.ts";

export default class Ships extends Command {
    static readonly metadata = {
        name: "ships",
        description: "Get information about a ship",
        guildOnly: false,
        contexts: [InteractionContextType.Guild, InteractionContextType.BotDM],
        options: [
            {
                name: "ship",
                autocomplete: true,
                type: ApplicationCommandOptionType.String,
                description: "The ship to look up",
                required: true,
            },
        ],
    };
    constructor() {
        super( Ships.metadata);
    }

    async run(interaction: BotInteraction) {
        const searchName = interaction.options.getString("ship");

        // Find any characters that match that
        const foundShips = findChar(searchName, ships, true);
        if (foundShips.length <= 0) {
            return super.error(
                interaction,
                `Sorry, but I cannot find **${searchName}**. Please double check the spelling, and that it's a proper ship/ crew crew member.`,
            );
        }
        if (foundShips.length > 1) {
            return super.error(
                interaction,
                interaction.language.get(
                    "BASE_SWGOH_CHAR_LIST",
                    foundShips
                        .map((s) => {
                            if (s.crew?.length) {
                                return `${s.name}${`\n${s.crew.map((c) => `- ${c}`).join("\n")}\n`}`;
                            }
                            return s.name;
                        })
                        .join("\n"),
                ),
            );
        }

        const ship = foundShips[0];
        const unit = await swgohAPI.getCharacter(ship.uniqueName, interaction.guildSettings.swgohLanguage);

        const shipAbilities = unit.skillReferenceList;

        const fields = [];

        if (unit.crew.length) {
            const crew = [];
            for (const crewMember of unit.crew) {
                const crewName = characters.find((c) => c.uniqueName === crewMember);
                crew.push(crewName.name);
            }
            fields.push({
                name: interaction.language.get("COMMAND_SHIPS_CREW"),
                value: toProperCase(crew.join(", ")),
            });
        }
        if (unit.factions.length) {
            fields.push({
                name: interaction.language.get("COMMAND_SHIPS_FACTIONS"),
                value: toProperCase(unit.factions.join(", ")),
            });
        }
        if (shipAbilities.length) {
            for (const ability of shipAbilities) {
                const a = {
                    type: toProperCase(ability.skillId.split("_")[0].replace("skill", "")),
                    abilityCooldown: ability.cooldown,
                    abilityDesc: ability.desc,
                };

                const msgArr = msgArray(expandSpaces(interaction.language.get("COMMAND_SHIPS_ABILITIES", a)).split(" "), " ", 1000);

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
        }
        if (!fields.length) {
            fields.push({
                name: "Error",
                value: "Sorry, but this ship has not been fully updated yet.",
            });
        }
        const charImg = await getBlankUnitImage(ship.uniqueName);
        return interaction.reply({
            embeds: [
                {
                    color: getSideColor(ship.side),
                    author: {
                        name: toProperCase(ship.name),
                        url: ship.url,
                    },
                    fields: fields,
                    thumbnail: { url: "attachment://image.png" },
                },
            ],
            files: [
                {
                    attachment: charImg,
                    name: "image.png",
                },
            ],
        });
    }
}
