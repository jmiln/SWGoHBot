import { ApplicationCommandOptionType, codeBlock, InteractionContextType } from "discord.js";
import Command from "../base/slashCommand.ts";
import { characters } from "../data/constants/units.ts";
import { getAllyCode } from "../modules/functions.ts";
import logger from "../modules/Logger.ts";
import { fetchPlayerWithCooldown } from "../modules/patreonFuncs.ts";
import swgohAPI from "../modules/swapi.ts";
import type { SWAPIUnit } from "../types/swapi_types.ts";
import type { BotUnit, CommandContext } from "../types/types.ts";

export default class Randomchar extends Command {
    static readonly metadata = {
        name: "randomchar",
        description: "Grabs a random squad",
        category: "Gamedata",

        guildOnly: false,
        contexts: [InteractionContextType.Guild, InteractionContextType.BotDM],
        options: [
            {
                name: "allycode",
                description: "The ally code for the user you want to look up",
                type: ApplicationCommandOptionType.String,
                autocomplete: true,
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
    };
    constructor() {
        super(Randomchar.metadata);
    }

    async run({ interaction, language }: CommandContext) {
        let chars: SWAPIUnit[] | BotUnit[] = [];
        const MAX_CHARACTERS = 5;

        let star = interaction.options.getInteger("rarity");
        if (!star) star = 1;

        let count = interaction.options.getInteger("count");
        if (!count) count = MAX_CHARACTERS;

        const ac = interaction.options.getString("allycode");
        const allyCode = await getAllyCode(interaction, ac, false);

        if (allyCode) {
            // If there is a valid ally code provided, grab the user's roster
            const player = await fetchPlayerWithCooldown(interaction, allyCode);
            if (!player) {
                return super.error(interaction, "Sorry, I couldn't fetch player data right now.", {
                    title: language.get("BASE_SOMETHING_BROKE"),
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
        if (allyCode && chars?.length) {
            // chars is SWAPIUnit[] when allycode is provided
            const swapiChars = chars as SWAPIUnit[];
            while (charOut.length < count) {
                const newIndex = Math.floor(Math.random() * swapiChars.length);
                const newChar = swapiChars[newIndex];
                try {
                    const playerChar = await swgohAPI.units(newChar.defId);
                    const name = playerChar.nameKey;
                    if (!charOut.includes(name)) charOut.push(name);
                } catch (err) {
                    const errorMessage = err instanceof Error ? err.message : String(err);
                    logger.error(`[slash/randomchar] Failed to fetch unit ${newChar.defId}: ${errorMessage}`);
                    // Skip this character and try another
                }
            }
        } else {
            // No chars available or not using allycode
            if (!chars.length) {
                return super.error(interaction, "No characters available to select from.");
            }
            // chars is BotUnit[] when no allycode
            const botChars = chars as BotUnit[];
            while (charOut.length < count) {
                const newIndex = Math.floor(Math.random() * botChars.length);
                const newChar = botChars[newIndex];
                const name = newChar.name;
                if (!charOut.includes(name)) charOut.push(name);
            }
        }
        const charString = charOut.join("\n");
        return interaction.reply({ content: codeBlock(charString) });
    }
}
