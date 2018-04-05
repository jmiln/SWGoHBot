const util = require('util');
const Command = require('../base/Command');

class Showconf extends Command {
    constructor(client) {
        super(client, {
            name: 'showconf',
            aliases: ['showconfs', 'showconfig', 'showconfigs'],
            category: 'Admin',
            permLevel: 3
        });
    }

    async run(client, message, args, level) {
        let guildID = message.guild.id;
        let guildName = '';
        // If I or an adminHelper adds a guild ID here, pull up that instead
        if (args[0] && level >= 9) {
            let found = false;
            if (!client.guilds.has(args[0]) && client.shard) {
                const names = await client.shard.broadcastEval(`
                    if (this.guilds.has('${args[0]}')) {
                        this.guilds.get('${args[0]}').name;
                    }
                `);
                names.forEach(gName => {
                    if (gName !== null) {
                        found = true;
                        guildName = gName;
                    }
                });
            } else {
                guildName = client.guilds.get(guildID).name;
                found = true;
            }
            if (found) {
                guildID = args[0];
            } else {
                return message.channel.send(`Sorry, but I don't seem to be in the guild ${args[0]}.`);
            }

        } else {
            guildName = message.guild.name;
        }

        const guildConf = await client.guildSettings.findOne({where: {guildID: guildID}, attributes: Object.keys(client.config.defaultSettings)});

        var array = [];
        if (guildConf) {
            for (var key in guildConf.dataValues) {
                array.push(`* ${key}: ${util.inspect(guildConf[key])}`);
            }
            var configKeys = array.join('\n');
            return message.channel.send(message.language.get('COMMAND_SHOWCONF_OUTPUT', configKeys, guildName));
        } else {
            console.log('Something broke in showconf');
        }
    }
}

module.exports = Showconf;
