const util = require('util');
const Command = require('../base/Command');

class Showconf extends Command {
    constructor(client) {
        super(client, {
            name: 'showconf',
            aliases: ['showconfs', 'showconfig', 'showconfigs'],
            category: 'Admin',
            description: 'Shows the current configs for your server.',
            usage: 'showconf',
        });
    }

    async run(client, message, args, level) {
        let guildID = message.guild.id;
        // If I or an adminHelper adds a guild ID here, pull up that instead
        if (args[0] && level >= 9) {
            guildID = args[0];
        }

        const guildConf = await client.guildSettings.findOne({where: {guildID: guildID}, attributes: Object.keys(client.config.defaultSettings)});

        var array = [];
        if (guildConf) {
            for (var key in guildConf.dataValues) {
                array.push(`* ${key}: ${util.inspect(guildConf[key])}`);
            }
            var configKeys = array.join('\n');
            return message.channel.send(message.language.COMMAND_SHOWCONF_OUTPUT(configKeys));
        } else {
            console.log('Something broke in showconf');
        }
    }
}

module.exports = Showconf;