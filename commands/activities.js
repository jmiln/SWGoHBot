exports.run = (client, message, args) => {
    let day = String(args[0]).toLowerCase();

    switch (day) {
        case 'sun':
        case 'sunday':
            message.channel.sendCode('asciidoc', `== Before Reset: == \nComplete Arena Battles (5) \nSave Cantina Energy \nSave Normal Energy
                                 \n== After Reset == \nSpend Cantina Energy \nSave Normal Energy`);
            break;
        case 'mon':
        case 'monday':
            message.channel.sendCode('asciidoc', `== Before Reset: == \nSpend Cantina Energy \nSave Normal Energy \nSave Galactic War (unless reset available)
                                 \n== After Reset == \nSpend Normal Energy on Light Side Battles \nSave Galactic War (unless reset available)`);
            break;
        case 'tue':
        case 'tuesday':
            message.channel.sendCode('asciidoc', `== Before Reset: == \nSpend Normal Energy on Light Side Battles \nSave Galactic War
                                 \n== After Reset == \nComplete Galactic War Battles (24 with restart) \nSave Normal Energy`);
            break;
        case 'wed':
        case 'wednesday':
            message.channel.sendCode('asciidoc', `== Before Reset: == \nComplete Galactic War Battles \nSave Normal Energy
                                 \n== After Reset == \nSpend Normal Energy on Hard Mode Battles`);
            break;
        case 'thu':
        case 'thursday':
            message.channel.sendCode('asciidoc', `== Before Reset: == \nSpend Normal Energy on Hard Mode Battles \nSave Challenges (Dailies are fine)
                                 \n== After Reset == \nComplete Challenges \nSave Normal Energy`);
            break;
        case 'fri':
        case 'friday':
            message.channel.sendCode('asciidoc', `== Before Reset: == \nComplete Challenges \nSave Normal Energy
                                 \n== After Reset == \nSpend Normal Energy on Dark Side Battles`);
            break;
        case 'sat':
        case 'saturday':
            message.channel.sendCode('asciidoc', `== Before Reset: == \nSpend Normal Energy on Dark Side Battles \nSave Arena Battles \nSave Cantina Energy
                                 \n== After Reset == \nComplete Arena Battles \nSave Cantina Energy`);
            break;
    }
};

exports.conf = {
    enabled: true,
    guildOnly: false,
    aliases: ['a', 'act'],
    permLevel: 0
};

exports.help = {
    name: 'activities',
    description: 'Shows the daily activites',
    usage: 'activities [day]'
};
