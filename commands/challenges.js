const challenges = {
    "Training Droids": ['Sunday', 'Monday', 'Saturday'],
    "Ability Mats": ['Sunday', 'Wednesday', 'Saturday'],
    "Bounty Hunter": ['Sunday', 'Tuesday', 'Friday'],
    "Agility Gear": ['Sunday', 'Tuesday', 'Friday'],
    "Strength Gear": ['Sunday', 'Monday', 'Thursday'],
    "Tactics Gear": ['Sunday', 'Wednesday', 'Saturday']
};

exports.run = (client, message, args) => {
    const config = client.config;

    if (!args[0]) return message.channel.send('You need to specify a day');
    const day = String(args[0]).toLowerCase();

    switch (day) {
        case 'sun':
        case 'sunday':
            return message.channel.send(dayString('Sunday'), {code:'asciidoc'});
        case 'mon':
        case 'monday':
            return message.channel.send(dayString('Monday'), {code:'asciidoc'});
        case 'tue':
        case 'tuesday':
            return message.channel.send(dayString('Tuesday'), {code:'asciidoc'});
        case 'wed':
        case 'wednesday':
            return message.channel.send(dayString('Wednesday'), {code:'asciidoc'});
        case 'thu':
        case 'thursday':
            return message.channel.send(dayString('Thursday'), {code:'asciidoc'});
        case 'fri':
        case 'friday':
            return message.channel.send(dayString('Friday'), {code:'asciidoc'});
        case 'sat':
        case 'saturday':
            return message.channel.send(dayString('Saturday'), {code:'asciidoc'});
        default:
            return message.channel.send(`Invalid date, usage is \`${config.prefix}${this.help.usage}\``).then(msg => msg.delete(4000)).catch(console.error);
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
    usage: 'challenges <dayOfWeek>'
};

function dayString(day) {
    let dayString = `== Challenges for ${day} ==`;
    for (var challenge in challenges) {
        if (challenges[challenge].includes(day)) {
            dayString += `\n* ${challenge}`;
        }
    }
    return dayString;
}
