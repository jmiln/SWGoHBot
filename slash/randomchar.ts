import { ApplicationCommandOptionType, codeBlock } from "discord.js";
import Command from "../base/slashCommand.ts";
import { characters } from "../data/constants/units.ts";
import { getAllyCode } from "../modules/functions.ts";
import logger from "../modules/Logger.ts";
import patreonFuncs from "../modules/patreonFuncs.ts";
import swgohAPI from "../modules/swapi.ts";
import type { SWAPIPlayer, SWAPIUnit } from "../types/swapi_types.ts";
import type { BotInteraction, BotType } from "../types/types.ts";

export default class Randomchar extends Command {
    constructor(Bot: BotType) {
        super(Bot, {
            name: "randomchar",
            guildOnly: false,
            options: [
                {
                    name: "allycode",
                    description: "The ally code for the user you want to look up",
                    type: ApplicationCommandOptionType.String,
                },
                {
                    name: "rarity",
                    description: "Choose a minimum rarity (Star level) to filter by",
                    type: ApplicationCommandOptionType.Integer,
                    choices: [
                        { name: "1*", value: 1 },
                        { name: "2*", value: 2 },
                        { name: "3*", value: 3 },
                        { name: "4*", value: 4 },
                        { name: "5*", value: 5 },
                        { name: "6*", value: 6 },
                        { name: "7*", value: 7 },
                    ],
                },
                {
                    name: "count",
                    description: "The number of characters to grab",
                    type: ApplicationCommandOptionType.Integer,
                    choices: [
                        { name: "1", value: 1 },
                        { name: "2", value: 2 },
                        { name: "3", value: 3 },
                        { name: "4", value: 4 },
                        { name: "5", value: 5 },
                    ],
                },
            ],
        });
    }

    async run(Bot: BotType, interaction: BotInteraction) {
        let chars: SWAPIUnit[] | any[] = [];
        const MAX_CHARACTERS = 5;

        let star = interaction.options.getInteger("rarity");
        if (!star) star = 1;

        let count = interaction.options.getInteger("count");
        if (!count) count = MAX_CHARACTERS;

        let allycode = interaction.options.getString("allycode");
        allycode = await getAllyCode(interaction, allycode, false);

        if (allycode) {
            // If there is a valid allycode provided, grab the user's roster
            const cooldown = await patreonFuncs.getPlayerCooldown(interaction.user.id, interaction?.guild?.id);
            let player: SWAPIPlayer = null;
            try {
                const playerRes = await swgohAPI.unitStats(Number.parseInt(allycode, 10), cooldown);
                player = playerRes?.[0] || null;
            } catch (e) {
                logger.error(`[slash/randomchar] Error fetching player: ${e}`);
                return super.error(interaction, codeBlock(e.message), {
                    title: interaction.language.get("BASE_SOMETHING_BROKE"),
                    footer: "Please try again in a bit.",
                });
            }

            // Filter out all the ships from the player's roster, so it only shows characters
            // Replace the default list with this
            chars = player.roster.filter((c) => c.combatType === 1);

            // If they're looking for a certain min star lvl, filter out everything lower
            if (star) {
                chars = chars.filter((c) => c.rarity >= star);
            }

            // In case a new player tries using it before they get enough characters?
            if (chars.length < MAX_CHARACTERS) count = chars.length;
        } else {
            // No allycode provided, use all bot characters
            chars = characters;
        }

        const charOut: string[] = [];
        if (allycode && chars?.length) {
            while (charOut.length < count) {
                const newIndex = Math.floor(Math.random() * chars.length);
                const newChar = chars[newIndex];
                const playerChar = await swgohAPI.units(newChar.defId);
                const name = playerChar.nameKey;
                if (!charOut.includes(name)) charOut.push(name);
            }
        } else {
            // No chars available or not using allycode
            if (!chars.length) {
                return super.error(interaction, "No characters available to select from.");
            }
            while (charOut.length < count) {
                const newIndex = Math.floor(Math.random() * chars.length);
                const newChar = chars[newIndex];
                const name = newChar.name;
                if (!charOut.includes(name)) charOut.push(name);
            }
        }
        const charString = charOut.join("\n");
        return interaction.reply({ content: codeBlock(charString) });
    }
}
