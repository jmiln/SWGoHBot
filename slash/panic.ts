import { ApplicationCommandOptionType, InteractionContextType } from "discord.js";
import Command from "../base/slashCommand.ts";
import { env } from "../config/config.ts";
import { characters, journeyReqs, ships } from "../data/constants/units.ts";
import { getAllyCode } from "../modules/functions.ts";
import logger from "../modules/Logger.ts";
import { fetchPlayerWithCooldown } from "../modules/patreonFuncs.ts";
import type { CommandContext, UnitSide } from "../types/types.ts";

export default class Panic extends Command {
    static readonly metadata = {
        name: "panic",
        description: "Show how close you are to being ready for character events",
        category: "Gamedata",

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

    async run({ interaction, language }: CommandContext) {
        const searchUnit = interaction.options.getString("unit");
        const ac = interaction.options.getString("allycode");
        const allyCode = await getAllyCode(interaction, ac);

        if (!allyCode) {
            return super.error(interaction, language.get("BASE_INVALID_ALLY_CODE"));
        }

        if (!searchUnit) {
            return super.error(interaction, language.get("COMMAND_PANIC_UNIT_NOT_FOUND", ""));
        }
        const thisReq = journeyReqs?.[searchUnit] || null;
        if (!thisReq) {
            return super.error(interaction, language.get("COMMAND_PANIC_UNIT_NOT_FOUND", searchUnit));
        }
        const targetUnit =
            characters.find((unit) => unit.uniqueName === searchUnit) || ships.find((unit) => unit.uniqueName === searchUnit);

        await interaction.reply({ content: language.get("BASE_SWGOH_PLS_WAIT_FETCH") });

        // Grab the player's info
        const player = await fetchPlayerWithCooldown(interaction, allyCode);
        if (!player?.roster) return super.error(interaction, language.get("COMMAND_PANIC_ROSTER_ERROR"));

        const reqsOut: {
            defId: string;
            name: string | undefined;
            charUrl: string | undefined;
            rarity: number;
            gear: number;
            level: number;
            relic: number;
            side: UnitSide;
            gp: number;
            gpReq: number;
            gearReq: number;
            relicReq: number;
            rarityReq: number;
            isShip: boolean;
            isRequired: boolean;
            isValid: boolean;
        }[] = [];
        for (const unitReq of thisReq.reqs) {
            const baseChar = characters.find((u) => u.uniqueName === unitReq.defId) || ships.find((u) => u.uniqueName === unitReq.defId);
            const playerUnit = player.roster.find((u) => u.defId === unitReq.defId);

            // Set some defaults so we can adjust what are needed for everything
            const reqs = { gear: 0, rarity: 0 };
            let isValid = false;
            switch (unitReq.type) {
                case "GP": {
                    isValid = (playerUnit?.gp ?? 0) >= unitReq.tier;
                    break;
                }
                case "STAR": {
                    isValid = (playerUnit?.rarity ?? 0) >= unitReq.tier;
                    break;
                }
                case "GEAR": {
                    isValid = (playerUnit?.gear ?? 0) >= unitReq.tier;
                    if (unitReq.tier > 11) {
                        reqs.rarity = 7;
                    }
                    break;
                }
                case "RELIC": {
                    isValid = (playerUnit?.relic?.currentTier ?? 0) - 2 >= unitReq.tier;
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
                side: baseChar?.side ?? "neutral",
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
        let imageOut: Buffer | null = null;
        try {
            imageOut = await fetch(`${env.IMAGE_SERVER_URL}/panic/`, {
                method: "post",
                body: JSON.stringify({
                    header: `${player.name}'s ${targetUnit?.name} requirements`,
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
            const errorMessage = err instanceof Error ? err.message : String(err);
            logger.error(`[slash/panic] Failed to generate image: ${errorMessage}`);
            return super.error(interaction, language.get("COMMAND_PANIC_IMAGE_ERROR"));
        }

        if (!imageOut) {
            return super.error(interaction, language.get("COMMAND_PANIC_GENERIC_ERROR"));
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
