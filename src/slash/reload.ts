import { Interaction } from "discord.js";
import SlashCommand from "../base/slashCommand";
import { BotInteraction, BotType } from "../modules/types";
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
        const client = interaction.client;

        if (!commandName || !client.slashcmds.has(commandName)) {
            return super.error(interaction, interaction.language.get("COMMAND_RELOAD_INVALID_CMD", commandName));
        } else {
            if (interaction.client.shard && interaction.client.shard.count > 0) {
                await interaction.client.shard.broadcastEval((client, {Bot, commandName}) => Bot.reloadSlash(commandName), {context: {commandName, Bot}})
                    .then(() => {
                        interaction.reply({content: interaction.language.get("COMMAND_RELOAD_SUCCESS", commandName)});
                    })
                    .catch(e => {
                        super.error(interaction, (interaction.language.get("COMMAND_RELOAD_FAILURE", commandName, e.stack)));
                    });
            } else {
                Bot.logger.log("Trying to reload out of shards");
                Bot.reloadSlash(commandName)
                    .then(() => {
                        interaction.reply({content: interaction.language.get("COMMAND_RELOAD_SUCCESS", commandName)});
                    })
                    .catch((e: Error) => {
                        super.error(interaction, (interaction.language.get("COMMAND_RELOAD_FAILURE", commandName, e.stack)));
                    });
            }
        }
    }
}

module.exports = Reload;

