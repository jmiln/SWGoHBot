const Command = require("../base/Command");
// const {inspect} = require("util");

class Reload extends Command {
    constructor(Bot) {
        super(Bot, {
            name: "reload",
            aliases: ["r"],
            permLevel: 10,
            category: "Dev"
        });
    }

    async run(Bot, message, [commandName]) {
        let command;
        const client = message.client;
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
                    if (message.client.shard && message.client.shard.count > 0) {
                        console.log("Trying to reload in shards: ");
                        await message.client.shard.broadcastEval(`this.reloadCommand("${command}");`)
                            .then(() => {
                                msg.edit(message.language.get("COMMAND_RELOAD_SUCCESS", command));
                            })
                            .catch(e => {
                                super.error(msg, (message.language.get("COMMAND_RELOAD_FAILURE",command, e.stack)), {edit: true});
                            });
                    } else {
                        console.log("Trying to reload out of shards");
                        Bot.reloadCommand(command)
                            .then(() => {
                                msg.edit(message.language.get("COMMAND_RELOAD_SUCCESS", command));
                            })
                            .catch(e => {
                                super.error(msg, (message.language.get("COMMAND_RELOAD_FAILURE", command, e.stack)), {edit: true});
                            });
                    }
                });
        }
    }
}

module.exports = Reload;

