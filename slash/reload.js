const Command = require("../base/slashCommand");
const { ApplicationCommandOptionType } = require("discord.js");
// const {inspect} = require("util");

class Reload extends Command {
    constructor(Bot) {
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

    async run(Bot, interaction) {
        let command;
        const commandName = interaction.options.getString("command");
        const client = interaction.client;
        if (client.slashcmds.has(commandName)) {
            command = client.slashcmds.get(commandName);
        }
        if (!command) {
            return super.error(interaction, interaction.language.get("COMMAND_RELOAD_INVALID_CMD", commandName));
        }

        command = command.commandData.name;
        await interaction.reply(`Reloading ${command}...`);
        if (interaction.client.shard && interaction.client.shard.count > 0) {
            await interaction.client.shard
                .broadcastEval((client, command) => client.reloadSlash(command), { context: command })
                .then(() => {
                    interaction.editReply({ content: interaction.language.get("COMMAND_RELOAD_SUCCESS", command) });
                })
                .catch((e) => {
                    super.error(interaction, interaction.language.get("COMMAND_RELOAD_FAILURE", command, e.stack));
                });
        } else {
            Bot.logger.log("Trying to reload out of shards");
            Bot.reloadSlash(command)
                .then(() => {
                    interaction.editReply({ content: interaction.language.get("COMMAND_RELOAD_SUCCESS", command) });
                })
                .catch((e) => {
                    super.error(interaction, interaction.language.get("COMMAND_RELOAD_FAILURE", command, e.stack));
                });
        }
    }
}

module.exports = Reload;
