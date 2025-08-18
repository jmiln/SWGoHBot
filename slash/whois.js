import { ApplicationCommandOptionType } from "discord.js";
import Command from "../base/slashCommand.js";

// To get the player's arena info (Adapted from shittybill#3024's Scorpio)
export default class WhoIs extends Command {
    constructor(Bot) {
        super(Bot, {
            name: "whois",
            guildOnly: false,
            options: [
                {
                    name: "name",
                    type: ApplicationCommandOptionType.String,
                    description: "The player that you're looking for",
                    required: true,
                },
            ],
        });
    }

    async run(Bot, interaction) {
        const PLAYER_LIMIT = 25;
        const name = interaction.options.getString("name");
        if (name.length > 50) return super.error(interaction, "Invalid name, max length is 50 characters");

        await interaction.deferReply();

        const players = await Bot.swgohAPI.playerByName(name);

        if (!players.length) {
            return interaction.editReply({
                content: "No results found for that name.\nProbably a wrong name or the player is not registered with the bot.",
            });
        }
        const playerLen = players.length;
        return interaction.editReply({
            content: `>>> **Results for search: \`${name}\`** ${
                playerLen > PLAYER_LIMIT ? `\n**Showing (${PLAYER_LIMIT}/${playerLen})**` : ""
            }\n${players.slice(0, PLAYER_LIMIT).map((p) => `\`${p.allyCode}\` - ${p.name}`).join("\n")}`,
        }); //TODO , {split: {char: "\n"}});
    }
}
