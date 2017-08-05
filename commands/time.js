var moment = require('moment-timezone');

exports.run = (client, message) => {
    if (!message.guild) return message.channel.send(`Sorry, something went wrong, please try again`);

    const guildSettings = client.guildSettings;
    const guildConf = guildSettings.get(message.guild.id);

    if (!guildConf['timezone']) {
        message.channel.send(`Current time is: ${moment().format('DD/MM/YYYY [at] H:mm:ss')} UTC time`);
    } else {
        message.channel.send(`Current time is: ${moment.tz(guildConf['timezone']).format('DD/MM/YYYY [at] H:mm:ss')} in ${guildConf['timezone']} time`); 
    }
};

exports.conf = {
    enabled: true,
    guildOnly: true,
    aliases: [''],
    permLevel: 0
};

exports.help = {
    name: 'time',
    category: 'Misc',
    description: 'Used to check the time with the guild\'s configured timezone',
    usage: 'time',
    example: 'time'
};
