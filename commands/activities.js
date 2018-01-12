var moment = require('moment-timezone');

exports.run = (client, message, args) => {
    const config = client.config;

    // Check if it should send as an embed or a code block
    const guildConf = message.guildSettings;
    
    let day = '';

    if (!args[0]) {
        if (!guildConf['timezone']) {
            day = moment().format('ddd').toLowerCase();
        } else {
            day = moment().tz(guildConf['timezone']).format('ddd').toLowerCase();
        }
    } else {
        day = String(args[0]).toLowerCase();
    }

    switch (day) {
        case message.language.DAYSOFWEEK.SUNDAY.SHORT:
        case message.language.DAYSOFWEEK.SUNDAY.LONG:
            message.channel.send(message.language.COMMAND_ACTIVITIES_SUNDAY, {code:'asciidoc'});
            break;
        case message.language.DAYSOFWEEK.MONDAY.SHORT:
        case message.language.DAYSOFWEEK.MONDAY.LONG:
            message.channel.send(message.language.COMMAND_ACTIVITIES_MONDAY, {code:'asciidoc'});
            break;
        case message.language.DAYSOFWEEK.TUESDAY.SHORT:
        case message.language.DAYSOFWEEK.TUESDAY.LONG:
            message.channel.send(message.language.COMMAND_ACTIVITIES_TUESDAY, {code:'asciidoc'});
            break;
        case message.language.DAYSOFWEEK.WEDNESDAY.SHORT:
        case message.language.DAYSOFWEEK.WEDNESDAY.LONG:
            message.channel.send(message.language.COMMAND_ACTIVITIES_WEDNESDAY, {code:'asciidoc'});
            break;
        case message.language.DAYSOFWEEK.THURSDAY.SHORT:
        case message.language.DAYSOFWEEK.THURSDAY.LONG:
            message.channel.send(message.language.COMMAND_ACTIVITIES_THURSDAY, {code:'asciidoc'});
            break;
        case message.language.DAYSOFWEEK.FRIDAY.SHORT:
        case message.language.DAYSOFWEEK.FRIDAY.LONG:
            message.channel.send(message.language.COMMAND_ACTIVITIES_FRIDAY, {code:'asciidoc'});
            break;
        case message.language.DAYSOFWEEK.SATURDAY.SHORT:
        case message.language.DAYSOFWEEK.SATURDAY.LONG:
            message.channel.send(message.language.COMMAND_ACTIVITIES_SATURDAY, {code:'asciidoc'});
            break;
        default:
            message.channel.send(message.language.COMMAND_ACTIVITIES_ERROR(config.prefix, this.help.usage)).then(msg => msg.delete(4000)).catch(console.error);
    }
};

exports.conf = {
    enabled: true,
    guildOnly: false,
    aliases: ['act'],
    permLevel: 0
};

exports.help = {
    name: 'activities',
    category: 'Star Wars',
    description: 'Shows the daily guild activites.',
    usage: 'activities [dayOfWeek]',
    example: `;activities monday`,
    extended: `\`\`\`asciidoc
Day of the week can be the full name or the general 3 character name (Ex. Monday vs Mon).
    \`\`\``
};
