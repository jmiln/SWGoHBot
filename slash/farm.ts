import { ApplicationCommandOptionType, InteractionContextType } from "discord.js";
import Command from "../base/slashCommand.ts";
import { env } from "../config/config.ts";
import { characters, charLocs, shipLocs, ships } from "../data/constants/units.ts";
import cache from "../modules/cache.ts";
import { charListFromSearch, expandSpaces, findCharOrShip, getSideColor, toProperCase } from "../modules/functions.ts";
import logger from "../modules/Logger.ts";
import swgohAPI from "../modules/swapi.ts";
import type { CommandContext } from "../types/types.ts";

export default class Farm extends Command {
    static readonly metadata = {
        name: "farm",
        description: "Finds the farming locations for units",
        category: "General",
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
        super(Farm.metadata);
    }

    async run({ interaction, language, swgohLanguage }: CommandContext) {
        // Grab the character they're looking for
        const searchChar = interaction.options.getString("character");

        const { units: chars, isShip } = findCharOrShip(searchChar, characters, ships);
        if (!chars?.length) {
            // Didn't find one
            return super.error(interaction, language.get("BASE_SWGOH_NO_CHAR_FOUND", searchChar));
        }
        if (chars.length > 1) {
            // Found too many
            return super.error(interaction, language.get("BASE_SWGOH_CHAR_LIST", charListFromSearch(chars)));
        }

        // There was only one result, so lets use it
        const character = chars[0];

        const unit = await swgohAPI.units(character.uniqueName, swgohLanguage);
        if (!unit) {
            return super.error(interaction, "[FARM] Broke trying to get the unit.");
        }

        const outList = [];
        let unitLocs = null;
        if (isShip) {
            unitLocs = shipLocs.find((s) => s.defId === character.uniqueName);
        } else {
            unitLocs = charLocs.find((c) => c.defId === character.uniqueName);
        }

        if (!unitLocs) {
            return super.error(interaction, `I couldn't get the location data for *${character.name}*`);
        }

        type LangLoc = { id: string; language: string; langKey: string };

        const locIds: string[] = [
            ...new Set<string>(unitLocs.locations.map((loc) => loc.locId as string | undefined).filter((id): id is string => !!id)),
        ];
        const locMap = new Map<string, LangLoc>();
        if (locIds.length > 0) {
            const langLocs = (await cache.get(
                env.MONGODB_SWAPI_DB,
                "locations",
                { id: { $in: locIds }, language: swgohLanguage.toLowerCase() },
                {},
            )) as LangLoc[];
            for (const langLoc of langLocs) {
                locMap.set(langLoc.id, langLoc);
            }
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
                    const langLoc = locMap.get(loc.locId) ?? null;

                    if (!langLoc) {
                        logger.debug(`[slash/farm] Missing localized location for ${loc.locId} in language ${swgohLanguage}`);
                        continue;
                    }

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
                    } else {
                        logger.debug(`[slash/farm] Unknown location type: ${loc.type} for ${character.name}`);
                    }
                }
            } else if (loc.name) {
                // This will be any of the events
                outList.push(expandSpaces(`__${loc.type}__: ${loc.name}`));
            } else if (loc.locId) {
                // Just has the location id, so probably a marquee
                const langLoc = locMap.get(loc.locId) ?? null;
                if (!langLoc) {
                    logger.debug(`[slash/farm] Missing localized location for ${loc.locId} in language ${swgohLanguage}`);
                    continue;
                }
                outList.push(toProperCase(langLoc.langKey));
            } else {
                // Location has no recognizable properties
                logger.debug(
                    `[slash/farm] Skipping location with no recognizable properties for ${character.name}: ${JSON.stringify(loc)}`,
                );
            }
        }
        if (!outList.length) {
            return super.error(interaction, language.get("COMMAND_FARM_CHAR_UNAVAILABLE"));
        }
        return interaction.reply({
            embeds: [
                {
                    author: {
                        name: character.name + language.get("COMMAND_FARM_LOCATIONS"),
                    },
                    color: getSideColor(character.side),
                    description: `**${outList.map((f) => `* ${f}`).join("\n")}**`,
                },
            ],
        });
    }
}
