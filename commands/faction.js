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

    let factionChars = [];

    if(searchName !== "") {
        for(ix = 0; ix < charList.length; ix++) {
            var character = charList[ix];
            for(jx = 0; jx < character.factions.length; jx++) {
                if(searchName.toLowerCase() === character.factions[jx].toLowerCase()) {
                    // Found the character, now just need to show it
                    found = true;

                    factionChars.push(character.name);
                }
            }
        }
        if(found) {
            if (embeds) { // if Embeds are enabled
                charString = factionChars.join('\n');
                fields = []
                fields.push({
                    "name": searchName.toProperCase(),
                    "value": charString 
                });
                message.channel.send({embed:{"fields": fields}});
            } else { // Embeds are disabled
                charString = '* ' + factionChars.join('\n* ');
                message.channel.send(`# Characters in ${searchName.toProperCase()} # \n${charString}`, { code: 'md' });
            }
        } else {
            message.channel.send("Invalid faction, usage is \`" + config.prefix + "faction [faction]\`");
        }
    } else {
        message.channel.send("Invalid faction, usage is \`" + config.prefix + "faction [faction]\`");
    }

};

exports.conf = {
    enabled: true,
    guildOnly: false,
    aliases: ['factions'],
    permLevel: 0
};

exports.help = {
    name: 'faction',
    category: 'Star Wars',
    description: 'Shows the list of characters in the specified faction.',
    usage: 'faction [faction]'
};
