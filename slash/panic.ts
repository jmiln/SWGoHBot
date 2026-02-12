import { ApplicationCommandOptionType, InteractionContextType } from "discord.js";
import Command from "../base/slashCommand.ts";
import config from "../config.ts";
import { characters, journeyReqs, ships } from "../data/constants/units.ts";
import { getAllyCode } from "../modules/functions.ts";
import logger from "../modules/Logger.ts";
import patreonFuncs from "../modules/patreonFuncs.ts";
import swgohAPI from "../modules/swapi.ts";
import type { CommandContext } from "../types/types.ts";

export default class Panic extends Command {
    static readonly metadata = {
        name: "panic",
        description: "Show how close you are to being ready for character events",
        guildOnly: false,
        contexts: [InteractionContextType.Guild, InteractionContextType.BotDM],
        options: [
            {
                name: "unit",
                autocomplete: true,
                required: true,
                type: ApplicationCommandOptionType.String,
                description: "The character you want to show the reqs of",
            },
            {
                name: "allycode",
                description: "The ally code for whoever you're wanting to look up",
                type: ApplicationCommandOptionType.String,
                autocomplete: true,
            },
        ],
    };
    constructor() {
        super(Panic.metadata);
    }

    async run({ interaction }: CommandContext) {
        const searchUnit = interaction.options.getString("unit");
        const ac = interaction.options.getString("allycode");
        const allycode = await getAllyCode(interaction, ac);

        if (!allycode) {
            return super.error(interaction, "I could not find a valid allycode. Please make sure you've type it in correctly.");
        }

        const thisReq = journeyReqs?.[searchUnit] || null;
        if (!thisReq) {
            return super.error(interaction, `Please select one of the autocompleted options, I couldn't find a match for ${searchUnit}`);
        }
        const targetUnit =
            characters.find((unit) => unit.uniqueName === searchUnit) || ships.find((unit) => unit.uniqueName === searchUnit);

        await interaction.reply({ content: "Please wait while I process your request." });

        // Grab the player's info
        const cooldown = await patreonFuncs.getPlayerCooldown(interaction.user.id, interaction?.guild?.id);
        const playerArr = await swgohAPI.unitStats(Number.parseInt(allycode, 10), cooldown);

        const player = playerArr[0];
        if (!player?.roster)
            return super.error(
                interaction,
                "Sorry, but I'm having a hard time loading your roster. Please double check your ally code or try again in a bit.",
            );

        const reqsOut = [];
        for (const unitReq of thisReq.reqs) {
            const baseChar = characters.find((u) => u.uniqueName === unitReq.defId) || ships.find((u) => u.uniqueName === unitReq.defId);
            const playerUnit = player.roster.find((u) => u.defId === unitReq.defId);

            // Set some defaults so we can adjust what are needed for everything
            const reqs = { gear: 0, rarity: 0 };
            let isValid = false;
            switch (unitReq.type) {
                case "GP": {
                    isValid = playerUnit?.gp >= unitReq.tier;
                    break;
                }
                case "STAR": {
                    isValid = playerUnit?.rarity >= unitReq.tier;
                    break;
                }
                case "GEAR": {
                    isValid = playerUnit?.gear >= unitReq.tier;
                    if (unitReq.tier > 11) {
                        reqs.rarity = 7;
                    }
                    break;
                }
                case "RELIC": {
                    isValid = playerUnit?.relic?.currentTier - 2 >= unitReq.tier;
                    if (unitReq.tier > 0) {
                        reqs.rarity = 7;
                        reqs.gear = 13;
                    }
                    break;
                }
                default:
                    isValid = false;
                    break;
            }

            reqsOut.push({
                // Basic unit info & stats
                defId: unitReq.defId,
                name: baseChar?.name,
                charUrl: baseChar?.avatarURL,
                rarity: playerUnit?.rarity || 0,
                gear: playerUnit?.gear || 0,
                level: playerUnit?.level || 0,
                relic: playerUnit?.relic?.currentTier || 0,
                side: baseChar.side,
                gp: playerUnit?.gp || 0,

                // The target bits from the journeyReqs
                gpReq: unitReq.type === "GP" ? unitReq.tier : 0,
                gearReq: unitReq.type === "GEAR" ? unitReq.tier : reqs.gear,
                relicReq: unitReq.type === "RELIC" ? unitReq.tier : 0,
                rarityReq: unitReq.type === "STAR" ? unitReq.tier : reqs.rarity,

                // If it's a ship and/ or a specifically required unit
                isShip: unitReq.ship || false,
                isRequired: unitReq.required || false,
                isValid,
            });
        }

        // Now that we have the units all formatted to send over to the image generator, go ahead and send it
        let imageOut = null;
        try {
            imageOut = await fetch(`${config.imageServIP_Port}/panic/`, {
                method: "post",
                body: JSON.stringify({
                    header: `${player.name}'s ${targetUnit.name} requirements`,
                    units: reqsOut,
                }),
                headers: { "Content-Type": "application/json" },
            }).then(async (response) => {
                if (!response.ok) {
                    logger.error(`[slash/panic] Image server returned error status: ${response.status} ${response.statusText}`);
                    return null;
                }
                const resBuf = await response.arrayBuffer();
                if (!resBuf) return null;
                return Buffer.from(resBuf);
            });
        } catch (err) {
            logger.error(`[getUnitImage] Something broke while requesting image.\n${err}`);
            logger.error(`[slash/panic] Error: ${err}`);
            return null;
        }

        if (!imageOut) {
            return super.error(interaction, "Sorry, but something went wrong.  Please try again later.");
        }

        return interaction.editReply({
            content: null,
            files: [
                {
                    attachment: imageOut,
                    name: "image.png",
                },
            ],
        });
    }
}
