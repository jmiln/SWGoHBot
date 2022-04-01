import { Interaction } from "discord.js";
import SlashCommand from "../base/slashCommand";
import { BotInteraction, BotType, PlayerStatsAccount } from "../modules/types";

// To get the player's arena info (Adapted from shittybill#3024's Scorpio)
class WhoIs extends SlashCommand {
    constructor(Bot: BotType) {
        super(Bot, {
            name: "whois",
            category: "Misc",
            guildOnly: false,
            permissions: ["EMBED_LINKS"],
            options: [
                {
                    name: "name",
                    type: Bot.constants.optionType.STRING,
                    description: "The player that you're looking for",
                    required: true
                }
            ]
        });
    }

    async run(Bot: BotType, interaction: BotInteraction) { // eslint-disable-line no-unused-vars
        const name = interaction.options.getString("name");
        if (name.length > 50) return super.error(interaction, "Invalid name, max length is 50 characters");

        let players: PlayerStatsAccount[] = await Bot.swgohAPI.playerByName(name);

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
