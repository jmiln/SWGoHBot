import { ApplicationCommandOptionType } from "discord.js";
import Command from "../base/slashCommand.ts";
import { acronyms } from "../data/constants/units.ts";
import type { BotInteraction, BotType } from "../types/types.ts";

const usageExample = "/acronyms acronym:CLS";

/**
 * The list of acronyms defined in data/acronym.json was transposed from the SWGoH forum. Any update there will need to make it's way into here.
 * //https://forums.galaxy-of-heroes.starwars.ea.com/discussion/154048/guide-to-the-acronyms-and-terms-of-star-wars-galaxy-of-heroes-swgoh
 */
export default class Acronyms extends Command {
    constructor(Bot: BotType) {
        super(Bot, {
            name: "acronyms",
            description: "Show what common acronyms mean",
            guildOnly: false,
            options: [
                {
                    name: "acronym",
                    type: ApplicationCommandOptionType.String,
                    description: "The acronym to look for",
                    required: true,
                },
            ],
        });
    }

    async run(_Bot: BotType, interaction: BotInteraction) {
        // Get whatever the user put in
        const acronym = interaction.options.getString("acronym");

        if (!acronym?.length) {
            // Apparently this should never happen because it's set as a required argument, but who knows/ just in case
            return this.handleError(interaction, "COMMAND_ACRONYMS_INVALID");
        }

        const matchingItems = this.findMatchingAcronyms(acronym, acronyms);

        if (!matchingItems.length) {
            // If there were no matches, go ahead and let the user know
            return this.handleError(interaction, "COMMAND_ACRONYMS_NOT_FOUND");
        }

        const acronymMeaningMessage = this.formatAcronymMessage(matchingItems, acronyms);

        await interaction.reply({
            embeds: [
                {
                    description: `**Acronyms for:**\n${acronym
                        .split(" ")
                        .map((l) => `- ${l}`)
                        .join("\n")}`,
                    fields: [
                        {
                            name: "Results",
                            value: acronymMeaningMessage,
                        },
                    ],
                },
            ],
        });
    }

    // Split it up in case they're looking for more than one
    private parseAcronymInput(acronym: string) {
        return acronym.split(" ").map((a) => a.trim().toLowerCase());
    }

    // Match up as many of the entered ones as possible
    private findMatchingAcronyms(acronym: string, acronymsLookup: Record<string, string>) {
        const acronyms = Object.keys(acronymsLookup);
        const lookupList = this.parseAcronymInput(acronym);
        return acronyms.filter((acr) => lookupList.includes(acr.toLowerCase()));
    }

    private formatAcronymMessage(matchingItems: string[], acronymsLookup: Record<string, string>) {
        let acronymMeaningMessage = "";
        for (let ix = 0; ix < matchingItems.length; ix++) {
            if (acronymMeaningMessage !== "") {
                acronymMeaningMessage += "\n";
            }
            acronymMeaningMessage += `**${matchingItems[ix]}**: ${acronymsLookup[matchingItems[ix]]}`;
        }
        return acronymMeaningMessage;
    }

    private async handleError(interaction: BotInteraction, errorKey: string) {
        const errorMessage = interaction.language.get(errorKey);
        return super.error(interaction, errorMessage, { title: "Error", example: usageExample });
    }
}
