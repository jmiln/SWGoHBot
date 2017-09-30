var moment = require('moment-timezone');

exports.run = (client, message, args) => {
    const guildConf = message.guildSettings;

    if (args[0]) {
        if (moment.tz.zone(args[0])) { // Valid time zone
            return message.channel.send(`Current time is: ${moment.tz(args[0]).format('DD/MM/YYYY [at] H:mm:ss')} in ${args[0]} time`); 
        } else { // Not so valid
            return message.reply(`Invalid timezone, here's your guild's time ${moment.tz(guildConf['timezone']).format('DD/MM/YYYY [at] H:mm:ss')} in ${guildConf['timezone']} time`).then(msg => msg.delete(10000)).catch(console.error);
        }
    }

    if (!guildConf['timezone']) {
        return message.channel.send(`Current time is: ${moment().format('DD/MM/YYYY [at] H:mm:ss')} UTC time`);
    } else {
        return message.channel.send(`Current time is: ${moment.tz(guildConf['timezone']).format('DD/MM/YYYY [at] H:mm:ss')} in ${guildConf['timezone']} time`); 
    }
};

exports.conf = {
    enabled: true,
    guildOnly: false,
    aliases: [],
    permLevel: 0
};

exports.help = {
    name: 'time',
    category: 'Misc',
    description: 'Used to check the time with the guild\'s configured timezone',
    usage: 'time [timezone]',
    example: ';time US/Pacific',
    extended: `\`\`\`asciidoc
timezone    :: If you want a different timezone than your guild's, put it here.
\`\`\``,
};
