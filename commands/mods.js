const Command = require('../base/Command');

class Mods extends Command {
    constructor(client) {
        super(client, {
            name: 'mods',
            aliases: ['m', 'mod'],
            category: 'Star Wars'
        });
    }

    run(client, message, args) {
        const config = client.config;
        const charList = client.characters;

        // Remove any junk from the name
        const searchName = args.join(' ');

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
            return message.channel.send(message.language.get('COMMAND_MODS_NEED_CHARACTER', config.prefix, this.help.usage)).then(msg => msg.delete(4000)).catch(console.error);
        }

        // Find any characters that match that
        const chars = client.findChar(searchName, charList);
        if (chars.length <= 0) {
            return message.channel.send(message.language.get('COMMAND_MODS_INVALID_CHARACTER', config.prefix, this.help.usage)).then(msg => msg.delete(4000)).catch(console.error);        
        }

        chars.forEach(character => {
            if (embeds) { // if Embeds are enabled
                const fields = [];
                for (var modSet in character.mods) {
                    const mods = character.mods[modSet];      
                    const modSetString = "* " + mods.sets.join("\n* ");                
                    
                    let modPrimaryString = message.language.get('COMMAND_MODS_EMBED_STRING1', mods.square, mods.arrow, mods.diamond);
                    modPrimaryString += message.language.get('COMMAND_MODS_EMBED_STRING2', mods.triangle, mods.circle, mods.cross);

                    fields.push({
                        "name": modSet,
                        "value": message.language.get('COMMAND_MODS_EMBED_OUTPUT', modSetString, modPrimaryString),
                        "inline": true
                    });
                }
                const embed = {
                    "color": `${character.side === "light" ? 0x5114e0 : 0xe01414}`,
                    "author": {
                        "name": character.name,
                        "url": character.url,
                        "icon_url": character.avatarURL
                    },
                    "footer": { 
                        "icon_url": 'https://cdn.discordapp.com/attachments/329514150105448459/361268366180352002/crouchingRancor.png',
                        "text": "Mods via apps.crouchingrancor.com" 
                    }
                };
                if (!fields.length) { // If there are no sets there
                    embed.description = message.language.get('COMMAND_NO_MODSETS');
                } else {
                    embed.fields = fields;
                }
                message.channel.send({
                    embed: embed
                });
            } else { // Embeds are disabled
                for (modSet in character.mods) {
                    const mods = character.mods[modSet];
                    const modSetString = "* " + mods.sets.join("\n* ");                

                    let modPrimaryString = message.language.get('COMMAND_MODS_CODE_STRING1', mods.square, mods.arrow, mods.diamond);
                    modPrimaryString += message.language.get('COMMAND_MODS_CODE_STRING2', mods.triangle, mods.circle, mods.cross);

                    return message.channel.send(message.language.get('COMMAND_MODS_CODE_OUTPUT', character.name, modSetString, modPrimaryString), { code: 'md', split: true });
                }
            } 
        });
    }
}

module.exports = Mods;

