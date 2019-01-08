const Command = require("../base/Command");


/**
 * The list of acronyms defined in data/acronym.json was transposed from the SWGoH forum. Any update there will need to make it's way into here.
 * //https://forums.galaxy-of-heroes.starwars.ea.com/discussion/154048/guide-to-the-acronyms-and-terms-of-star-wars-galaxy-of-heroes-swgoh
 */
class Acronyms extends Command {
    constructor(client) {
        super(client, {
            name: "acronyms",
            category: "Misc",
            aliases: ["acr", "acronym"],
        });
    }

    async run(client, message, [ ...acronym ], options) { // eslint-disable-line no-unused-vars
        const acronymsLookup = client.acronyms;
        const acronyms = Object.keys(acronymsLookup);

        if (!acronym.length) {
            return super.error(message, message.language.get("COMMAND_ACRONYMS_INVALID"), {example: "acronym cls"});
        }

        const lookupList = acronym.map(a => a.trim().toLowerCase());
        const matchingItems = acronyms.filter(acr => lookupList.includes(acr.toLowerCase()));

        if (!matchingItems.length) {
            return super.error(message, message.language.get("COMMAND_ACRONYMS_NOT_FOUND"), {example: "acronym cls"});
        } 
        
        let acronymMeaningMessage = "";
        for (let i = 0; i < matchingItems.length; i++) {
            if (acronymMeaningMessage !== "") {
                acronymMeaningMessage += "\n";
            }
            /* 
             * TODO
             * This next line won't translate well, as is. BUT we could move this to 
             * const acronymMeaning = message.language.get("COMMAND_ACRONYM_" + matchingItems[i]);
             * acronymMeaningMessage += `**${matchingItems[i]}**: ${acronymMeaning}`;
             */
            acronymMeaningMessage += `**${matchingItems[i]}**: ${acronymsLookup[matchingItems[i]]}`;
        }

        return message.channel.send(acronymMeaningMessage);
    }
}

module.exports = Acronyms;

