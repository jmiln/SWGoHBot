const Command = require('../base/Command');
// const {inspect} = require('util');

class Reload extends Command {
    constructor(client) {
        super(client, {
            name: 'reload',
            aliases: ['r'],
            permLevel: 10,
            category: 'Dev'
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
            return message.channel.send(message.language.get('COMMAND_RELOAD_INVALID_CMD', commandName)).then(msg => msg.delete(4000)).catch(console.error);
        } else {
            command = command.help.name;
            message.channel.send(`Reloading: ${command}`)
                .then(async m => {
                    if (client.shard && client.shard.count > 0) {
                        await client.shard.broadcastEval(`
                                this.reloadCommand('${command}');
                            `)
                            .then(() => {
                                m.edit(message.language.get('COMMAND_RELOAD_SUCCESS', command));
                            })
                            .catch(e => {
                                m.edit(message.language.get('COMMAND_RELOAD_FAILURE',command, e.stack));
                            });
                    } else {
                        client.reloadCommand(command)
                            .then(() => {
                                m.edit(message.language.get('COMMAND_RELOAD_SUCCESS', command));
                            })
                            .catch(e => {
                                m.edit(message.language.get('COMMAND_RELOAD_FAILURE', command, e.stack));
                            });
                    }
                });
        }
    }
}

module.exports = Reload;

