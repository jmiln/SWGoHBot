import { ApplicationCommandOptionType, InteractionContextType } from "discord.js";
import Command from "../base/slashCommand.ts";
import config from "../config.js";
import { characters, charLocs, shipLocs, ships } from "../data/constants/units.ts";
import cache from "../modules/cache.ts";
import { expandSpaces, findChar, getSideColor, toProperCase } from "../modules/functions.ts";
import swgohAPI from "../modules/swapi.ts";
import type { BotInteraction } from "../types/types.ts";

export default class Farm extends Command {
    static readonly metadata = {
        name: "farm",
        description: "Finds the farming locations for units",
        guildOnly: false,
        contexts: [InteractionContextType.Guild, InteractionContextType.BotDM],
        options: [
            {
                name: "character",
                autocomplete: true,
                description: "The character or ship you want to search for",
                type: ApplicationCommandOptionType.String,
                required: true,
            },
        ],
    };
    constructor() {
        super( Farm.metadata);
    }

    async run(interaction: BotInteraction) {
        // Grab the character they're looking for
        const searchChar = interaction.options.getString("character");
        let isChar = true;

        // Check the characters list
        let chars = findChar(searchChar, characters);

        // If there was no luck with characters, try checking the ships
        if (!chars?.length) {
            isChar = false;
            chars = findChar(searchChar, ships, true);
        }
        if (!chars?.length) {
            // Didn't find one
            return super.error(interaction, interaction.language.get("BASE_SWGOH_NO_CHAR_FOUND", searchChar));
        }
        if (chars.length > 1) {
            // Found too many
            return super.error(interaction, interaction.language.get("BASE_SWGOH_CHAR_LIST", chars.map((c) => c.name).join("\n")));
        }

        // There was only one result, so lets use it
        const character = chars[0];

        const unit = await swgohAPI.units(character.uniqueName, interaction.swgohLanguage);
        if (!unit) {
            return super.error(interaction, "[FARM] Broke trying to get the unit.");
        }

        const outList = [];
        let unitLocs = null;
        if (!isChar) {
            unitLocs = shipLocs.find((s) => s.defId === character.uniqueName);
        } else {
            unitLocs = charLocs.find((c) => c.defId === character.uniqueName);
        }

        if (!unitLocs) {
            return super.error(interaction, `I couldn't get the location data for *${character.name}*`);
        }
        for (const loc of unitLocs.locations) {
            if (loc.cost) {
                // This will be anything in a store
                outList.push(
                    ` - ${loc.type} \n * ${loc.cost
                        .split("\n")
                        .map((cost: string) => cost.replace("/", " per "))
                        .join(" shards\n * ")} shards`,
                );
            } else if (loc.level) {
                // It's a node, fleet, cantina, light/ dark side
                if (loc.locId) {
                    const langLoc = (await cache.getOne(
                        config.mongodb.swapidb,
                        "locations",
                        {
                            id: loc.locId,
                            language: interaction.swgohLanguage.toLowerCase(),
                        },
                        {},
                    )) as { id: string; language: string; langKey: string } | null;

                    if (!langLoc) continue;

                    // If it's a proving grounds event, stick the unit name after
                    if (loc.locId === "EVENT_CONQUEST_UNIT_TRIALS_NAME") {
                        outList.push(`${toProperCase(langLoc.langKey)} - ${character.name}`);
                    } else {
                        outList.push(`${toProperCase(langLoc.langKey)} ${loc.level}`);
                    }
                } else {
                    loc.type = loc.type.replace("Hard Modes (", "").replace(")", "");
                    if (loc.type === "L") {
                        outList.push(`Light Side Hard ${loc.level}`);
                    } else if (loc.type === "D") {
                        outList.push(`Dark Side Hard ${loc.level}`);
                    } else if (loc.type === "Fleet") {
                        outList.push(`Fleet Hard ${loc.level}`);
                    } else if (loc.type === "Cantina") {
                        outList.push(`Cantina ${loc.level}`);
                    }
                }
            } else if (loc.name) {
                // This will be any of the events
                outList.push(expandSpaces(`__${loc.type}__: ${loc.name}`));
            } else if (loc.locId) {
                // Just has the location id, so probably a marquee
                const langLoc = (await cache.getOne(
                    config.mongodb.swapidb,
                    "locations",
                    {
                        id: loc.locId,
                        language: interaction.swgohLanguage.toLowerCase(),
                    },
                    {},
                )) as { id: string; language: string; langKey: string } | null;
                if (!langLoc) continue;
                outList.push(toProperCase(langLoc.langKey));
            }
        }
        if (!outList.length) {
            return super.error(interaction, interaction.language.get("COMMAND_FARM_CHAR_UNAVAILABLE"));
        }
        return interaction.reply({
            embeds: [
                {
                    author: {
                        name: character.name + interaction.language.get("COMMAND_FARM_LOCATIONS"),
                    },
                    color: getSideColor(character.side),
                    description: `**${outList.map((f) => `* ${f}`).join("\n")}**`,
                },
            ],
        });
    }
}
