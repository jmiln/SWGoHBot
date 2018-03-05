var moment = require('moment-timezone');

const Command = require('../base/Command');

class Time extends Command {
    constructor(client) {
        super(client, {
            name: 'time',
            category: 'Misc',
            description: 'Used to check the time with the guild\'s configured timezone',
            usage: 'time [timezone] \n;time',
            example: ';time US/Pacific',
            extended: `\`\`\`asciidoc
timezone    :: If you want a different timezone than your guild's, put it here. \`\`\``,
        });
    }

    run(client, message, args) {
        const guildConf = message.guildSettings;

        if (args[0]) {
            if (moment.tz.zone(args[0])) { // Valid time zone
                return message.channel.send(message.language.COMMAND_TIME_CURRENT(moment.tz(args[0]).format('DD/MM/YYYY [at] H:mm:ss'), args[0])); 
            } else { // Not so valid
                return message.reply(message.language.COMMAND_TIME_INVALID_ZONE(moment.tz(guildConf['timezone']).format('DD/MM/YYYY [at] H:mm:ss'), guildConf['timezone'])).then(msg => msg.delete(10000)).catch(console.error);
            }
        }

        if (!guildConf['timezone']) {
            return message.channel.send(message.language.COMMAND_TIME_NO_ZONE(moment().format('DD/MM/YYYY [at] H:mm:ss')));
        } else {
            return message.channel.send(message.language.COMMAND_TIME_WITH_ZONE(moment.tz(guildConf['timezone']).format('DD/MM/YYYY [at] H:mm:ss'), guildConf['timezone'])); 
        }
    }
}

module.exports = Time;