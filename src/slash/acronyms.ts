import SlashCommand from "../base/slashCommand";
import { Interaction } from "discord.js";
import { BotInteraction, BotType } from "../modules/types";

/**
 * The list of acronyms defined in data/acronym.json was transposed from the SWGoH forum. Any update there will need to make it's way into here.
 * //https://forums.galaxy-of-heroes.starwars.ea.com/discussion/154048/guide-to-the-acronyms-and-terms-of-star-wars-galaxy-of-heroes-swgoh
 */
class Acronyms extends SlashCommand {
    constructor(Bot: BotType) {
        super(Bot, {
            name: "acronyms",
            description: "Spit out what common acronyms mean",
            category: "Misc",
            guildOnly: false,
            options: [{
                name: "acronym",
                type: Bot.constants.optionType.STRING,
                description: "The acronym to look for",
                required: true,
            }]
        });
    }

    async run(Bot: BotType, interaction: BotInteraction) {
        const acronymsLookup = Bot.acronyms;
        const acronyms = Object.keys(acronymsLookup);

        // Get whatever the user put in
        const acronym = interaction.options.getString("acronym");

        if (!acronym?.length) {
            // Apparently this should never happen because it's set as a required argument, but who knows/ just in case
            return super.error(interaction, interaction.language.get("COMMAND_ACRONYMS_INVALID"), {example: "acronym cls"});
        }

        // Split it up in case they're looking for more than one
        const lookupList = acronym.split(" ").map((a: string) => a.trim().toLowerCase());

        // Match up as many of the entered ones as possible
        const matchingItems = acronyms.filter(acr => lookupList.includes(acr.toLowerCase()));

        if (!matchingItems.length) {
            // If there were no matches, go ahead and let the user know
            return super.error(interaction, interaction.language.get("COMMAND_ACRONYMS_NOT_FOUND"));
        }

        let acronymMeaningMessage = "";
        for (let i = 0; i < matchingItems.length; i++) {
            if (acronymMeaningMessage !== "") {
                acronymMeaningMessage += "\n";
            }
            /*
             * TODO This next line won't translate well, as is. BUT we could move this to
             * const acronymMeaning = message.language.get("COMMAND_ACRONYM_" + matchingItems[i]);
             * acronymMeaningMessage += `**${matchingItems[i]}**: ${acronymMeaning}`;
             */
            acronymMeaningMessage += `**${matchingItems[i]}**: ${acronymsLookup[matchingItems[i]]}`;
        }

        await interaction.reply({embeds: [
            {
                description: `**Acronyms for:**\n${lookupList.map((acr: string) => `- ${acr}`).join("\n")}`,
                fields: [
                    {
                        name: "Results",
                        value: acronymMeaningMessage
                    }
                ]
            }
        ]});
    }
}

module.exports = Acronyms;

