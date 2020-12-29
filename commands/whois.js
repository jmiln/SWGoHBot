const Command = require("../base/Command");
const {inspect} = require("util"); // eslint-disable-line no-unused-vars

// To get the player's arena info (Adapted from shittybill#3024's Scorpio)
class WhoIs extends Command {
    constructor(Bot) {
        super(Bot, {
            name: "whois",
            category: "Misc",
            aliases: ["wi", "who"],
            permissions: ["EMBED_LINKS"],
            flags: {}
        });
    }

    async run(Bot, message, [name], options) { // eslint-disable-line no-unused-vars
        if (!name?.length) return super.error(message, "Missing name");
        if (name.length > 50) return super.error(message, "Invalid name, max length is 50 characters");
        const players = await Bot.swgohAPI.playerByName(name);

        if (!players.length) {
            return message.channel.send("No results found for that name.\n Probably a wrong name or that person is not registered with the bot.");
        } else {
            return message.channel.send(`>>> **Results for search: \`${name}\`**\n` + players.map(p => `\`${p.allyCode}\` - ${p.name}`), {split: {char: "\n"}});
        }
    }
}

module.exports = WhoIs;
