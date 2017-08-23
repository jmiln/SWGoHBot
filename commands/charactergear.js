exports.run = (client, message, args) => {
    const config = client.config;
    const charList = client.characters;


    // The current possible gear levels
    const gearLevels = ['g1', 'g2', 'g3', 'g4', 'g5', 'g6', 'g7', 'g8', 'g9', 'g10', 'g11',
                        'gear1', 'gear2', 'gear3', 'gear4', 'gear5', 'gear6', 'gear7', 'gear8',
                        'gear9', 'gear10', 'gear11']

    // Figure out where the gear level is in the command, and grab it
    let gearLvl = '';
    if(gearLevels.includes(args[0])) {
        gearLvl = args[0];
        args.splice(0,1)
    } else if(gearLevels.includes(args[args.length-1])) {
        gearLvl = args[args.length-1];
        args.splice(-1,1)
    } else {
        return message.channel.send(`Correct usage: ${config.prefix}${this.help.usage}`).then(msg => msg.delete(4000)).catch(console.error);
    }

    // Grab the number and make it compatible
    gearLvl = 'Gear ' + gearLvl.replace(/\D/g,'');

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

    // Format and send the requested data back
    chars.forEach(character => {
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
                        "value": `* ${character.gear[gearLvl].join('\n* ')}`
                    }]
                }
            });
        } else { // Embeds are disabled
            message.channel.send(` * ${character.name} * \n### ${gearLvl} ### \n* ${character.gear[gearLvl].join('\n* ')}`, { code: 'md' });
        }
    });
};

exports.conf = {
    enabled: true,
    guildOnly: false,
    aliases: ['chargear'],
    permLevel: 0
};

exports.help = {
    name: 'charactergear',
    category: 'Star Wars',
    description: 'Shows the gear requirements for the specified character/ lvl.',
    usage: 'charactergear [character] [gearLvl]'
};
