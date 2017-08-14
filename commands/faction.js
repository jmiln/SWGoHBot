var fs = require("fs");
var charList = JSON.parse(fs.readFileSync("data/characters.json"));

exports.run = (client, message, args) => {
    const config = client.config;

    // Check if it should send as an embed or a code block
    const guildConf = message.guildSettings;
    let embeds = true;
    if (message.guild) {
        if (guildConf['useEmbeds'] !== true || !message.channel.permissionsFor(client.user).has('EMBED_LINKS')) {
            embeds = false;
        }
    }

    const searchName = String(args.join(' ')).toLowerCase().replace(/[^\w\s]/gi, '');

    let found = false;

    const factionChars = [];

    if (searchName === "") {
        return message.channel.send(`Invalid faction, usage is \`${config.prefix}faction [faction]\``).then(msg => msg.delete(4000)).catch(console.error);
    }
    for (var ix = 0; ix < charList.length; ix++) {
        var character = charList[ix];
        for (var jx = 0; jx < character.factions.length; jx++) {
            if (searchName.toLowerCase() === character.factions[jx].toLowerCase()) {
                // Found the character, now just need to show it
                found = true;

                factionChars.push(character.name);
            }
        }
    }
    if (found) {
        if (embeds) { // if Embeds are enabled
            var charString = factionChars.join('\n');
            const fields = [];
            fields.push({
                "name": searchName.toProperCase(),
                "value": charString
            });
            message.channel.send({
                embed: {
                    "fields": fields
                }
            });
        } else { // Embeds are disabled
            charString = '* ' + factionChars.join('\n* ');
            message.channel.send(`# Characters in the ${searchName.toProperCase()} faction # \n${charString}`, {
                code: 'md'
            });
        }
    } else {
        message.channel.send(`Invalid faction, usage is \`${config.prefix}faction [faction]\``).then(msg => msg.delete(4000)).catch(console.error);
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
