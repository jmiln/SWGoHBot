import { Interaction } from "discord.js";
import SlashCommand from "../base/slashCommand";
import { BotInteraction, BotType, BotClient } from "../modules/types";
// const {inspect} = require("util");

class Reload extends SlashCommand {
    constructor(Bot: BotType) {
        super(Bot, {
            name: "reload",
            guildOnly: true,
            permLevel: 10,
            category: "Dev",
            options: [
                {
                    name: "command",
                    type: Bot.constants.optionType.STRING,
                    description: "The command to reload",
                    required: true
                }
            ]
        });
    }

    async run(Bot: BotType, interaction: BotInteraction) {
        const commandName = interaction.options.getString("command")?.toLowerCase();

        if (!commandName || !interaction.client.slashcmds.has(commandName)) {
            return super.error(interaction, interaction.language.get("COMMAND_RELOAD_INVALID_CMD", commandName));
        } else {
            interaction.client.shard.broadcastEval((client: BotClient, {commandName}) => {return client.reloadSlash(commandName)}, {context: {commandName}})
                .then(() => {
                    interaction.reply({content: interaction.language.get("COMMAND_RELOAD_SUCCESS", commandName)});
                })
                .catch((e: Error) => {
                    super.error(interaction, (interaction.language.get("COMMAND_RELOAD_FAILURE", commandName, e.stack)));
                });
        }
    }
}

module.exports = Reload;

