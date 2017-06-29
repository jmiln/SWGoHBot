var fs = require("fs");
var charList = JSON.parse(fs.readFileSync("data/mods.json"));
var settings = require("../settings.json");
const PersistentCollection = require("djs-collection-persistent");


exports.run = (client, message, args) => {
    const guildSettings = client.guildSettings;
    const guildConf = guildSettings.get(message.guild.id);

    let searchName = String(args.join(' ')).toLowerCase().replace(/[^\w\s]/gi, '');

    let found = false;

    if(searchName !== "") {
        for(ix = 0; ix < charList.length; ix++) {
            var character = charList[ix];
            for(jx = 0; jx < character.aliases.length; jx++) {
                if(searchName.toLowerCase() === character.aliases[jx].toLowerCase()) {
                    found = true;
                    if((guildConf['fancyMods'] === true || guildConf['fancyMods'] === 'true')&& message.channel.permissionsFor(client.user).has('EMBED_LINKS')) {    // Check to make sure the bot can post embeds
                        if(character.set3 === "") { // If the character only has 2 recommended sets (one is a set of 4)
                            message.channel.send({embed:{ "color": `${character.side === "light" ? 0x5114e0 : 0xe01414}`, "author": { "name": character.name, "url": character.url, "icon_url": character.avatarURL }, "fields": [ { "name": "**### Sets ###**", "value": `* ${character.set1}\n* ${character.set2}` }, { "name": "**### Primaries ###**", "value": `**Square:**      ${character.square}\n**Arrow:**       ${character.arrow}\n**Diamond:**  ${character.diamond}\n**Triangle:**   ${character.triangle}\n**Circle:**        ${character.circle}\n**Cross:**        ${character.cross}` } ] }});
                        } else {
                            message.channel.send({embed:{ "color": `${character.side === "light" ? 0x5114e0 : 0xe01414}`, "author": { "name": character.name, "url": character.url, "icon_url": character.avatarURL }, "fields": [ { "name": "**### Sets ###**", "value": `* ${character.set1}\n* ${character.set2}\n* ${character.set3}` }, { "name": "**### Primaries ###**", "value": `**Square:**      ${character.square}\n**Arrow:**       ${character.arrow}\n**Diamond:**  ${character.diamond}\n**Triangle:**   ${character.triangle}\n**Circle:**        ${character.circle}\n**Cross:**        ${character.cross}` } ] }});
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

        if(found === false) {
            message.channel.send("Invalid character, usage is \`" + settings.prefix + "mods [character]\`");
        }
    } else {
        message.channel.send("Invalid character, usage is \`" + settings.prefix + "mods [character]\`");
    }

};

exports.conf = {
    enabled: true,
    guildOnly: false,
    aliases: ['m', 'mod'],
    permLevel: 0,
    type: 'starwars'
};

exports.help = {
    name: 'mods',
    description: 'Shows some suggested mods for the specified character.',
    usage: 'mods [character]'
};
