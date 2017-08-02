var moment = require('moment-timezone');

exports.run = (client, message, args) => {
    const config = client.config;

    if (!message.guild) return message.channel.send(`Sorry, something went wrong, please try again`);

    const guildConf = client.guildSettings.get(message.guild.id);

    let day = '';

    if (!args[0]) {
        day = moment().tz(guildConf['timezone']).format('ddd').toLowerCase();
    } else {
        day = String(args[0]).toLowerCase();
    }
    
    switch (day) {
        case 'sun':
        case 'sunday':
            message.channel.send(`== Before Reset == \nComplete Arena Battles \nSave Cantina Energy \nSave Normal Energy
                                 \n== After Reset == \nSpend Cantina Energy \nSave Normal Energy`, {code:'asciidoc'});
            break;
        case 'mon':
        case 'monday':
            message.channel.send(`== Before Reset == \nSpend Cantina Energy \nSave Normal Energy \nSave Galactic War (unless reset available)
                                 \n== After Reset == \nSpend Normal Energy on Light Side Battles \nSave Galactic War (unless reset available)`, {code:'asciidoc'});
            break;
        case 'tue':
        case 'tuesday':
            message.channel.send(`== Before Reset == \nSpend Normal Energy on Light Side Battles \nSave Galactic War
                                 \n== After Reset == \nComplete Galactic War Battles \nSave Normal Energy`, {code:'asciidoc'});
            break;
        case 'wed':
        case 'wednesday':
            message.channel.send(`== Before Reset == \nComplete Galactic War Battles \nSave Normal Energy
                                 \n== After Reset == \nSpend Normal Energy on Hard Mode Battles`, {code:'asciidoc'});
            break;
        case 'thu':
        case 'thursday':
            message.channel.send(`== Before Reset == \nSpend Normal Energy on Hard Mode Battles \nSave Challenges
                                 \n== After Reset == \nComplete Challenges \nSave Normal Energy`, {code:'asciidoc'});
            break;
        case 'fri':
        case 'friday':
            message.channel.send(`== Before Reset == \nComplete Challenges \nSave Normal Energy
                                 \n== After Reset == \nSpend Normal Energy on Dark Side Battles`, {code:'asciidoc'});
            break;
        case 'sat':
        case 'saturday':
            message.channel.send(`== Before Reset == \nSpend Normal Energy on Dark Side Battles \nSave Arena Battles \nSave Cantina Energy
                                 \n== After Reset == \nComplete Arena Battles \nSave Cantina Energy`, {code:'asciidoc'});
            break;
        default: 
            message.channel.send("Invalid date, usage is \`" + config.prefix + "activities [day]\`");
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
    usage: 'activities [day]'
};
