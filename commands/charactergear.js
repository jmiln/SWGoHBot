exports.run = (client, message, args) => {
    const config = client.config;
    const charList = client.characters;


    // The current possible gear levels
    const gearLevels = ['g1', 'g2', 'g3', 'g4', 'g5', 'g6', 'g7', 'g8', 'g9', 'g10', 'g11',// 'g12',
        'gear1', 'gear2', 'gear3', 'gear4', 'gear5', 'gear6', 'gear7', 'gear8',
        'gear9', 'gear10', 'gear11'//, 'gear12'
    ];

    // Figure out where the gear level is in the command, and grab it
    let gearLvl = '';
    let arg0 = args[0].toLowerCase();
    if (gearLevels.includes(arg0)) {
        gearLvl = 'Gear ' + arg0.replace(/\D/g, '');
        args.splice(0, 1);
    } else if (gearLevels.includes(args[args.length - 1].toLowerCase())) {
        gearLvl = 'Gear ' + args[args.length - 1].toLowerCase().replace(/\D/g, '');
        args.splice(-1, 1);
    }

    // Remove any junk from the name
    const searchName = String(args.join(' ')).toLowerCase().replace(/[^\w\s]/gi, '');

    // Check if it should send as an embed or a code block
    const guildConf = message.guildSettings;
    let embeds = true;
    if (message.guild) {
        if (guildConf['useEmbeds'] !== true || !message.channel.permissionsFor(client.user).has('EMBED_LINKS')) {
            embeds = false;
        }
    }

    // Make sure they gave a character to find
    if (searchName === "") {
        message.channel.send(`Need a character. Usage is \`${config.prefix}${this.help.usage}\``).then(msg => msg.delete(4000)).catch(console.error);
    }

    // Find any characters that match that
    const chars = client.findChar(searchName, charList);
    if (chars.length <= 0) {
        message.channel.send(`Invalid character. Usage is \`${config.prefix}${this.help.usage}\``).then(msg => msg.delete(4000)).catch(console.error);
    }

    if (gearLvl === '') {
        chars.forEach(character => {
            const allGear = {};

            for (var level in character.gear) {
                const thisLvl = character.gear[level];
                for (var ix = 0; ix < thisLvl.length; ix++) {
                    if (!allGear[thisLvl[ix]]) { // If it's not been checked yet
                        allGear[thisLvl[ix]] = 1;
                    } else { // It's already in there
                        allGear[thisLvl[ix]] = allGear[thisLvl[ix]] + 1;
                    }
                }
            }

            let gearString = '';
            for (var key in allGear) {
                gearString += `* ${allGear[key]}x ${key}\n`;
            }
            message.channel.send(` * ${character.name} * \n### All Gear Needed ### \n${gearString}`, {
                code: 'md',
                split: true
            });
        });
    } else {
        // Format and send the requested data back
        chars.forEach(character => {
            const thisGear = character.gear[gearLvl];
            if (embeds) { // if Embeds are enabled
                message.channel.send({
                    embed: {
                        "color": `${character.side === "light" ? 0x5114e0 : 0xe01414}`,
                        "author": {
                            "name": character.name,
                            "url": character.url,
                            "icon_url": character.avatarURL
                        },
                        "fields": [{
                            "name": gearLvl,
                            "value": `* ${thisGear.length > 0 ? thisGear.join('\n* ') : 'This gear has not been entered yet' }`
                        }]
                    }
                });
            } else { // Embeds are disabled
                message.channel.send(` * ${character.name} * \n### ${gearLvl} ### \n* ${character.gear[gearLvl].join('\n* ')}`, {
                    code: 'md'
                });
            }
        });
    }
};

exports.conf = {
    enabled: true,
    guildOnly: false,
    aliases: ['chargear', 'gear'],
    permLevel: 0
};

exports.help = {
    name: 'charactergear',
    category: 'Star Wars',
    description: 'Shows the gear requirements for the specified character/ lvl.',
    usage: 'charactergear <character> [gearLvl]'
};
