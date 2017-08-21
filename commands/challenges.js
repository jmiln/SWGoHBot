var moment = require('moment-timezone');

let challenges = {
    "Training Droids": ['Sunday', 'Monday', 'Saturday'],
    "Ability Mats": ['Sunday', 'Wednesday', 'Saturday'],
    "Bounty Hunter": ['Sunday', 'Tuesday', 'Friday'],
    "Agility Gear": ['Sunday', 'Tuesday', 'Friday'],
    "Strength Gear": ['Sunday', 'Monday', 'Thursday'],
    "Tactics Gear": ['Sunday', 'Wednesday', 'Saturday']
}

exports.run = (client, message, args) => {
    const config = client.config;

    // Check if it should send as an embed or a code block
    const guildConf = message.guildSettings;
    
    if(!args[0]) return message.channel.send('You need to specify a day');
    let day = String(args[0]).toLowerCase();

    switch (day) {
        case 'sun':
        case 'sunday':
            return message.channel.send(dayString('Sunday'), {code:'asciidoc'});
            break;
        case 'mon':
        case 'monday':
            return message.channel.send(dayString('Monday'), {code:'asciidoc'});
            break;
        case 'tue':
        case 'tuesday':
            return message.channel.send(dayString('Tuesday'), {code:'asciidoc'});
            break;
        case 'wed':
        case 'wednesday':
            return message.channel.send(dayString('Wednesday'), {code:'asciidoc'});
            break;
        case 'thu':
        case 'thursday':
            return message.channel.send(dayString('Thursday'), {code:'asciidoc'});
            break;
        case 'fri':
        case 'friday':
            return message.channel.send(dayString('Friday'), {code:'asciidoc'});
            break;
        case 'sat':
        case 'saturday':
            return message.channel.send(dayString('Saturday'), {code:'asciidoc'});
            break;
        default:
            message.channel.send(`Invalid date, usage is \`${config.prefix}activities [dayOfWeek]\``).then(msg => msg.delete(4000)).catch(console.error);
    }
};

exports.conf = {
    enabled: true,
    guildOnly: false,
    aliases: ['challenge', 'chal'],
    permLevel: 0
};

exports.help = {
    name: 'challenges',
    category: 'Star Wars',
    description: 'Shows the daily guild challenges.',
    usage: 'challenges [day]'
};

function dayString(day) {
    let dayString = `== Challenges for ${day} ==`;
    for(challenge in challenges) {
        if (challenges[challenge].includes(day)) {
            dayString += `\n* ${challenge}`
        }
    }
    return dayString;
}
