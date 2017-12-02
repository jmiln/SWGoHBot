exports.run = (client, message, args) => {
    const config = client.config;
    const charList = client.characters;


    // The current max possible gear level
    const MAX_GEAR = 12;

    // Figure out where the gear level is in the command, and grab it
    let gearLvl = '';
    if (!args[0]) return message.channel.send(`Need a character. Usage is \`${config.prefix}${this.help.usage}\``).then(msg => msg.delete(4000)).catch(console.error);

    if (args[1]) {
        gearLvl = parseInt(args[args.length - 1].replace(/\D/g, ''));
        if (gearLvl.isNaN() || gearLvl < 1 || gearLvl > MAX_GEAR) {
            gearLvl = '';
        } else {
            // There is a valid gear level being requested
            gearLvl = 'Gear ' + gearLvl;
            args.splice(args.length - 1);
        }
    } else {
        gearLvl = '';
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
        return message.channel.send(`Need a character. Usage is \`${config.prefix}${this.help.usage}\``).then(msg => msg.delete(4000)).catch(console.error);
    }

    // Find any characters that match that
    const chars = client.findChar(searchName, charList);
    if (!chars || chars.length <= 0) {
        return message.channel.send(`Invalid character. Usage is \`${config.prefix}${this.help.usage}\``).then(msg => msg.delete(4000)).catch(console.error);
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
    usage: 'charactergear <character> [gearLvl]',
    example: `;charactergear rex gear11`,
    extended: `\`\`\`asciidoc
character   :: The character you want to look up the gear for.
gearlvl     :: (Optional) The specific gear level you want to look up.
    \`\`\``
};
