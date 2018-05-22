const Command = require('../base/Command');

class ReloadData extends Command {
    constructor(client) {
        super(client, {
            name: 'reloaddata',
            category: "Dev",
            enabled: true, 
            aliases: ['rdata', 'rd'],
            permLevel: 10
        });
    }

    async run(client, message, [action, ...args], options) { // eslint-disable-line no-unused-vars
        const id = message.channel.id;
        switch (action) {
            case 'com':
            case 'commands': // Reloads all the commands, 
                if (client.shard && client.shard.count > 0) {
                    client.shard.broadcastEval(`this.reloadAllCommands('${id}'); `);
                } else {
                    client.reloadAllCommands(id);
                }
                break;
            case 'ev':
            case 'events': // Reload the events
                if (client.shard && client.shard.count > 0) {
                    client.shard.broadcastEval(`this.reloadAllEvents('${id}'); `);
                } else {
                    client.reloadAllEvents(id);
                }
                break;
            case 'func':
            case 'funct':
            case 'functs':
            case 'function':
            case 'functions': // Reload the functions file
                if (client.shard && client.shard.count > 0) {
                    client.shard.broadcastEval(`this.reloadFunctions('${id}'); `);
                } else {
                    client.reloadFunctions(id);
                }
                break;
            case 'data': // Reload the character/ ship data files
                if (client.shard && client.shard.count > 0) {
                    client.shard.broadcastEval(`this.reloadDataFiles('${id}'); `);
                } else {
                    client.reloadDataFiles(id);
                }
                break;
            case 'lang':
            case 'language':
            case 'languages':
                if (client.shard && client.shard.count > 0) {
                    client.shard.broadcastEval(`this.reloadLanguages('${id}'); `);
                } else {
                    client.reloadLanguages(id);
                }
                break;
            default:
                return message.channel.send('You can only choose `commands, events, functions, languages, or data.`');

        }
    }
}

module.exports = ReloadData;

