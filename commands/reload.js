const Command = require("../base/Command");
// const {inspect} = require("util");

class Reload extends Command {
    constructor(client) {
        super(client, {
            name: "reload",
            aliases: ["r"],
            permLevel: 10,
            category: "Dev"
        });
    }

    async run(client, message, [commandName]) {
        let command;
        if (client.commands.has(commandName)) {
            command = client.commands.get(commandName);
        } else if (client.aliases.has(commandName)) {
            command = client.commands.get(client.aliases.get(commandName));
        }
        if (!command) {
            return super.error(message, message.language.get("COMMAND_RELOAD_INVALID_CMD", commandName));
        } else {
            command = command.help.name;
            message.channel.send(`Reloading: ${command}`)
                .then(async msg => {
                    if (client.shard && client.shard.count > 0) {
                        await client.shard.broadcastEval(`
                                this.reloadCommand("${command}");
                            `)
                            .then(() => {
                                msg.edit(message.language.get("COMMAND_RELOAD_SUCCESS", command));
                            })
                            .catch(e => {
                                super.error(message, (message.language.get("COMMAND_RELOAD_FAILURE",command, e.stack)), {edit: true});
                            });
                    } else {
                        client.reloadCommand(command)
                            .then(() => {
                                msg.edit(message.language.get("COMMAND_RELOAD_SUCCESS", command));
                            })
                            .catch(e => {
                                super.error(message, (message.language.get("COMMAND_RELOAD_FAILURE", command, e.stack)), {edit: true});
                            });
                    }
                });
        }
    }
}

module.exports = Reload;

