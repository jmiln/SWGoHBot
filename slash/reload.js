const Command = require("../base/slashCommand");
// const {inspect} = require("util");

class Reload extends Command {
    constructor(Bot) {
        super(Bot, {
            name: "reload",
            guildOnly: true,
            aliases: ["r"],
            permLevel: 10,
            category: "Dev",
            options: [
                {
                    name: "command",
                    type: "STRING",
                    description: "The command to reload",
                    required: true
                }
            ]
        });
    }

    async run(Bot, interaction) {
        let command;
        const commandName = interaction.options.getString("command");
        const client = interaction.client;
        if (client.slashcmds.has(commandName)) {
            command = client.commands.get(commandName);
        }
        if (!command) {
            return super.error(interaction, interaction.language.get("COMMAND_RELOAD_INVALID_CMD", commandName));
        } else {
            command = command.help.name;
            if (interaction.client.shard && interaction.client.shard.count > 0) {
                await interaction.client.shard.broadcastEval((client, command) => client.reloadSlash(command), {context: command})
                    .then(() => {
                        interaction.reply({content: interaction.language.get("COMMAND_RELOAD_SUCCESS", command)});
                    })
                    .catch(e => {
                        super.error(interaction, (interaction.language.get("COMMAND_RELOAD_FAILURE",command, e.stack)));
                    });
            } else {
                Bot.logger.log("Trying to reload out of shards");
                Bot.reloadSlash(command)
                    .then(() => {
                        interaction.reply({content: interaction.language.get("COMMAND_RELOAD_SUCCESS", command)});
                    })
                    .catch(e => {
                        super.error(interaction, (interaction.language.get("COMMAND_RELOAD_FAILURE", command, e.stack)));
                    });
            }
        }
    }
}

module.exports = Reload;

