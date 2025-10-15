import { ApplicationCommandOptionType } from "discord.js";
import type slashCommand from "../base/slashCommand.ts";
import Command from "../base/slashCommand.ts";
import type { BotClient, BotInteraction, BotType } from "../types/types.ts";

export default class Reload extends Command {
    constructor(Bot: BotType) {
        super(Bot, {
            name: "reload",
            guildOnly: true,
            permLevel: 10,
            options: [
                {
                    name: "command",
                    autocomplete: true,
                    type: ApplicationCommandOptionType.String,
                    description: "The command to reload",
                    required: true,
                },
            ],
        });
    }

    async run(Bot: BotType, interaction: BotInteraction) {
        let command: slashCommand;
        const commandName = interaction.options.getString("command");
        const client: BotClient = interaction.client;
        if (client.slashcmds.has(commandName)) {
            command = client.slashcmds.get(commandName);
        }
        if (!command) {
            return super.error(interaction, interaction.language.get("COMMAND_RELOAD_INVALID_CMD", commandName));
        }

        await interaction.reply(`Reloading ${commandName}...`);
        if (interaction.client.shard && interaction.client.shard.count > 0) {
            await interaction.client.shard
                .broadcastEval((client, cmd) => client.reloadSlash(cmd), { context: commandName })
                .then(() => {
                    interaction.editReply({ content: interaction.language.get("COMMAND_RELOAD_SUCCESS", commandName) });
                })
                .catch((e: Error) => {
                    super.error(interaction, interaction.language.get("COMMAND_RELOAD_FAILURE", commandName, e.stack));
                });
        } else {
            Bot.logger.log("Trying to reload out of shards");
            client
                .reloadSlash(commandName)
                .then(() => {
                    interaction.editReply({ content: interaction.language.get("COMMAND_RELOAD_SUCCESS", commandName) });
                })
                .catch((e: Error) => {
                    super.error(interaction, interaction.language.get("COMMAND_RELOAD_FAILURE", commandName, e.stack));
                });
        }
    }
}
