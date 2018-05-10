const Command = require('../base/Command');

class Reload extends Command {
    constructor(client) {
        super(client, {
            name: 'reload',
            aliases: ['r'],
            permLevel: 10,
            category: 'Dev'
        });
    }

    async run(client, message, [command]) {
        if (!command) {
            return message.channel.send(message.language.get('COMMAND_RELOAD_INVALID_CMD', command)).then(msg => msg.delete(4000)).catch(console.error);
        } else {
            message.channel.send(`Reloading: ${command}`)
                .then(async m => {
                    if (client.shard && client.shard.count > 0) {
                        await client.shard.broadcastEval(`
                            this.reloadCommand('${command}');
                        `)
                            .then((name) => {
                                m.edit(message.language.get('COMMAND_RELOAD_SUCCESS', name));
                            })
                            .catch(e => {
                                m.edit(message.language.get('COMMAND_RELOAD_FAILURE',command, e.stack));
                            });
                    } else {
                        client.reloadCommand(command)
                            .then((name) => {
                                m.edit(message.language.get('COMMAND_RELOAD_SUCCESS', name));
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

