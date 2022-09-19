const Command = require("../base/slashCommand");
const { ApplicationCommandOptionType } = require("discord.js");

/**
 * The list of acronyms defined in data/acronym.json was transposed from the SWGoH forum. Any update there will need to make it's way into here.
 * //https://forums.galaxy-of-heroes.starwars.ea.com/discussion/154048/guide-to-the-acronyms-and-terms-of-star-wars-galaxy-of-heroes-swgoh
 */
class Acronyms extends Command {
    constructor(Bot) {
        super(Bot, {
            name: "acronyms",
            description: "Spit out what common acronyms mean",
            guildOnly: false,
            options: [{
                name: "acronym",
                type: ApplicationCommandOptionType.String,
                description: "The acronym to look for",
                required: true,
            }]
        });
    }

    async run(Bot, interaction) {
        const acronymsLookup = Bot.acronyms;
        const acronyms = Object.keys(acronymsLookup);

        // Get whatever the user put in
        const acronym = interaction.options.getString("acronym");

        if (!acronym?.length) {
            // Apparently this should never happen because it's set as a required argument, but who knows/ just in case
            return super.error(interaction, interaction.language.get("COMMAND_ACRONYMS_INVALID"), {example: "acronym cls"});
        }

        // Split it up in case they're looking for more than one
        const lookupList = acronym.split(" ").map(a => a.trim().toLowerCase());

        // Match up as many of the entered ones as possible
        const matchingItems = acronyms.filter(acr => lookupList.includes(acr.toLowerCase()));

        if (!matchingItems.length) {
            // If there were no matches, go ahead and let the user know
            return super.error(interaction, interaction.language.get("COMMAND_ACRONYMS_NOT_FOUND"), {example: "acronym cls"});
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
                description: `**Acronyms for:**\n${lookupList.map((l) => `- ${l}`).join("\n")}`,
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

