var moment = require('moment-timezone');

exports.run = (client, message) => {
    const guildConf = message.guildSettings;

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
    usage: 'time',
    example: 'time'
};
