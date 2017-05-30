var fs = require("fs");
var charList = JSON.parse(fs.readFileSync("data/mods.json"));


exports.run = (client, message, args) => {
    let searchName = String(args.join(' ')).toLowerCase().replace(/[^\w\s]/gi, '');

    for(ix = 0; ix < charList.length; ix++) {
        var character = charList[ix];
        for(jx = 0; jx < character.aliases.length; jx++) {
            if(searchName.toLowerCase() === character.aliases[jx].toLowerCase()) {
                if(message.channel.permissionsFor(client.user).has('EMBED_LINKS')) {    // Check to make sure the bot can post embeds
                    if(character.set3 === "") { // If the character only has 2 recommended sets (one is a set of 4)
                        message.channel.send({embed:{ "color": 12339987, "author": { "name": character.name, "url": character.url, "icon_url": character.avatarURL }, "fields": [ { "name": "**### Sets ###**", "value": `* ${character.set1}\n* ${character.set2}` }, { "name": "**### Primaries ###**", "value": `**Square:**      ${character.square}\n**Arrow:**       ${character.arrow}\n**Diamond:**  ${character.diamond}\n**Triangle:**   ${character.triangle}\n**Circle:**        ${character.circle}\n**Cross:**        ${character.cross}` } ] }});
                    } else {
                        message.channel.send({embed:{ "color": 12339987, "author": { "name": character.name, "url": character.url, "icon_url": character.avatarURL }, "fields": [ { "name": "**### Sets ###**", "value": `* ${character.set1}\n* ${character.set2}\n* ${character.set3}` }, { "name": "**### Primaries ###**", "value": `**Square:**      ${character.square}\n**Arrow:**       ${character.arrow}\n**Diamond:**  ${character.diamond}\n**Triangle:**   ${character.triangle}\n**Circle:**        ${character.circle}\n**Cross:**        ${character.cross}` } ] }});
                    }
                } else {    // Else, just post it as a codeblock
                    if(character.set3 === "") { // If the character only has 2 recommended sets (one is a set of 4)
                        message.channel.send(` * ${character.name} * \n### Sets ### \n* ${character.set1} \n* ${character.set2}\n### Primaries ###\n* Square:   ${character.square}\n* Arrow:    ${character.arrow}\n* Diamond:  ${character.diamond}\n* Triangle: ${character.triangle}\n* Circle:   ${character.circle}\n* Cross:    ${character.cross}`, { code: 'md' });
                    } else {
                        message.channel.send(` * ${character.name} * \n### Sets ### \n* ${character.set1} \n* ${character.set2}\n* ${character.set3}\n### Primaries ###\n* Square:   ${character.square}\n* Arrow:    ${character.arrow}\n* Diamond:  ${character.diamond}\n* Triangle: ${character.triangle}\n* Circle:   ${character.circle}\n* Cross:    ${character.cross}`, { code: 'md' });
                    }
                }
            }
        }
    }

};

exports.conf = {
    enabled: true,
    guildOnly: false,
    aliases: ['m', 'mod'],
    permLevel: 0
};

exports.help = {
    name: 'mods',
    description: 'Shows the mods for a character',
    usage: 'mods [character]'
};
