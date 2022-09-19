const Command = require("../base/slashCommand");
const { ApplicationCommandOptionType } = require("discord.js");

// To get the player's arena info (Adapted from shittybill#3024's Scorpio)
class WhoIs extends Command {
    constructor(Bot) {
        super(Bot, {
            name: "whois",
            guildOnly: false,
            options: [
                {
                    name: "name",
                    type: ApplicationCommandOptionType.String,
                    description: "The player that you're looking for",
                    required: true
                }
            ]
        });
    }

    async run(Bot, interaction) { // eslint-disable-line no-unused-vars
        const name = interaction.options.getString("name");
        if (name.length > 50) return super.error(interaction, "Invalid name, max length is 50 characters");

        let players = await Bot.swgohAPI.playerByName(name);

        if (!players.length) {
            return interaction.reply({content: "No results found for that name.\n Probably a wrong name or that person is not registered with the bot."});
        } else {
            const playerLen = players.length;
            if (playerLen > 25) {
                players = players.slice(0, 25);
            }
            return interaction.reply({content: `>>> **Results for search: \`${name}\`** ${playerLen > players.length ? `\n**Showing (${players.length}/${playerLen})**` : ""}\n` + players.map(p => `\`${p.allyCode}\` - ${p.name}`).join("\n")}); //TODO , {split: {char: "\n"}});
        }
    }
}

module.exports = WhoIs;
