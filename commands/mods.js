exports.run = (client, message, args) => {
    const config = client.config;
    const charList = client.characters;

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
        message.channel.send(`Need a character. Usage is \`${config.prefix}${this.help.name} [character]\``).then(msg => msg.delete(4000)).catch(console.error);
    }

    // Find any characters that match that
    const chars = client.findChar(searchName, charList);
    if (chars.length <= 0) {
        message.channel.send(`Invalid character. Usage is \`${config.prefix}${this.help.name} [character]\``).then(msg => msg.delete(4000)).catch(console.error);        
    }

    chars.forEach(character => {
        if (embeds) { // if Embeds are enabled
            const fields = [];
            for (var modSet in character.mods) {
                const mods = character.mods[modSet];      
                const modSetString = "* " + mods.sets.join("\n* ");                

                let modPrimaryString = `**Square:**      ${mods.square}\n**Arrow:**       ${mods.arrow}\n**Diamond:**  ${mods.diamond}\n`;
                modPrimaryString += `**Triangle:**   ${mods.triangle}\n**Circle:**        ${mods.circle}\n**Cross:**        ${mods.cross}`;

                fields.push({
                    "name": modSet,
                    "value": `**### Sets ###**\n${modSetString}\n**### Primaries ###**\n${modPrimaryString}`,
                    "inline": true
                });
            }
            message.channel.send({
                embed: {
                    "color": `${character.side === "light" ? 0x5114e0 : 0xe01414}`,
                    "author": {
                        "name": character.name,
                        "url": character.url,
                        "icon_url": character.avatarURL
                    },
                    "fields": fields
                }
            });
        } else { // Embeds are disabled
            for (modSet in character.mods) {
                const mods = character.mods[modSet];
                const modSetString = "* " + mods.sets.join("\n* ");                

                let modPrimaryString = `* Square:   ${mods.square}  \n* Arrow:    ${mods.arrow} \n* Diamond:  ${mods.diamond}\n`;
                modPrimaryString += `* Triangle: ${mods.triangle}\n* Circle:   ${mods.circle}\n* Cross:    ${mods.cross}`;

                message.channel.send(` * ${character.name} * \n### Sets ### \n${modSetString}\n### Primaries ###\n${modPrimaryString}`, {
                    code: 'md'
                });
            }
        } 
    });
};

exports.conf = {
    enabled: true,
    guildOnly: false,
    aliases: ['m', 'mod'],
    permLevel: 0
};

exports.help = {
    name: 'mods',
    category: 'Star Wars',
    description: 'Shows some suggested mods for the specified character.',
    usage: 'mods [character]'
};
