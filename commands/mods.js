var fs = require("fs");
var charList = JSON.parse(fs.readFileSync("data/characters.json"));

exports.run = (client, message, args) => {
    const config = client.config;
    const guildSettings = client.guildSettings;

    if(!message.guild) return message.reply(`Sorry, something went wrong, please try again`);
    const guildConf = guildSettings.get(message.guild.id);

    let searchName = String(args.join(' ')).toLowerCase().replace(/[^\w\s]/gi, '');

    let found = false;

    embeds = false;
    if(guildConf['useEmbeds'] === true && message.channel.permissionsFor(client.user).has('EMBED_LINKS')) {
        embeds = true;
    }

    if(searchName !== "") {
        for(ix = 0; ix < charList.length; ix++) {
            var character = charList[ix];
            for(jx = 0; jx < character.aliases.length; jx++) {
                if(searchName.toLowerCase() === character.aliases[jx].toLowerCase()) {
                    // Found the character, now just need to show it
                    found = true;

                    if(embeds) {  // if Embeds are enabled
                        let fields = [];
                        for(modSet in character.mods) {
                            let mods = character.mods[modSet];
                            let modSetString =  "* " + mods.sets.join("\n* ");

                            let modPrimaryString = `**Square:**      ${mods.square}\n**Arrow:**       ${mods.arrow}\n**Diamond:**  ${mods.diamond}\n`;
                            modPrimaryString +=    `**Triangle:**   ${mods.triangle}\n**Circle:**        ${mods.circle}\n**Cross:**        ${mods.cross}`;

                            fields.push({
                                "name": modSet,
                                "value": `**### Sets ###**\n${modSetString}\n**### Primaries ###**\n${modPrimaryString}`,
                                "inline": true
                            });
                        }
                        message.channel.send({embed:{ "color": `${character.side === "light" ? 0x5114e0 : 0xe01414}`, "author": { "name": character.name, "url": character.url, "icon_url": character.avatarURL }, "fields": fields }});
                    } else {  // Embeds are disabled
                        for(modSet in character.mods) {
                            let mods = character.mods[modSet];
                            let modSetString = "";

                            modSetString = "* " + mods.sets.join("\n* ");

                            let modPrimaryString = `* Square:   ${mods.square}  \n* Arrow:    ${mods.arrow} \n* Diamond:  ${mods.diamond}\n`;
                            modPrimaryString +=    `* Triangle: ${mods.triangle}\n* Circle:   ${mods.circle}\n* Cross:    ${mods.cross}`;

                            message.channel.send(` * ${character.name} * \n### Sets ### \n${modSetString}\n### Primaries ###\n${modPrimaryString}`, { code: 'md' });
                        }
                    }
                }
            }
        }

        if(found === false) {
            message.channel.send("Invalid character, usage is \`" + config.prefix + "mods [character]\`");
        }
    } else {
        message.channel.send("Invalid character, usage is \`" + config.prefix + "mods [character]\`");
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
    category: 'Star Wars',
    description: 'Shows some suggested mods for the specified character.',
    usage: 'mods [character]'
};
