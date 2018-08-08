const Command = require('../base/Command');
const moment = require('moment');

class Zetas extends Command {
    constructor(client) {
        super(client, {
            name: 'zetas',
            guildOnly: true,
            category: "SWGoH",
            aliases: ['zeta', 'z'],
            permissions: ['EMBED_LINKS']
        });
    }

    async run(client, message, [userID, ...searchChar], options) { // eslint-disable-line no-unused-vars
        let allyCode;
        // Need to get the allycode from the db, then use that
        if (!userID || userID === "me" || client.isUserID(userID) || client.isAllyCode(userID)) {
            const allyCodes = await client.getAllyCode(message, userID);
            if (!allyCodes.length) {
                return message.channel.send(message.language.get('BASE_SWGOH_NO_USER', message.guildSettings.prefix));
            }
            allyCode = allyCodes[0];
        } else {
            // If they're just looking for a character for themselves, get the char
            searchChar = [userID].concat(searchChar);
            const allyCodes = await client.getAllyCode(message, message.author.id);
            if (!allyCodes.length) {
                return message.channel.send(message.language.get('BASE_SWGOH_NO_USER', message.guildSettings.prefix));
            }
            allyCode = allyCodes[0];
        }
        
        searchChar = searchChar.join(' ');
        
        const chars = client.findChar(searchChar, client.characters);
        
        let character = null;
        
        if (chars.length > 1) {
            const charL = [];
            const charS = chars.sort((p, c) => p.name > c.name ? 1 : -1);
            charS.forEach(c => {
                charL.push(c.name);
            });
            return message.channel.send(message.language.get('COMMAND_GUILDSEARCH_CHAR_LIST', charL.join('\n')));
        } else if (chars.length === 1) {
            character = chars[0];
        }
        
        const msg = await message.channel.send(message.language.get('BASE_SWGOH_PLS_WAIT_FETCH', 'zetas'));

        let player;
        try {
            player = await client.swgohAPI.player(allyCode);
        } catch (e) {
            console.log('Error: Broke while trying to get player data in zetas: ' + e);
            return msg.edit(message.language.get('BASE_SWGOH_NO_ACCT'));
        }

        const zetas = {};
        let count = 0;
        player.roster.forEach(char => {
            // If they are not looking for a specific character, check em all
            if (!character || character.uniqueName === char.defId) {
                char.skills.forEach(skill => {
                    if (skill.isZeta && skill.tier === 8) {
                        count++;
                        // If the character is not already listed, add it
                        if (!zetas[char.name]) {
                            zetas[char.name] = ['`[' + skill.defId.charAt(0) + ']` ' + skill.name];
                        } else {
                            zetas[char.name].push('`[' + skill.defId.charAt(0) + ']` ' + skill.name);
                        }
                    }
                });
            }
        });

        const sorted = Object.keys(zetas).sort((p, c) => p > c ? 1 : -1);
        const desc = [], author = {};
        if (!character) {
            author.name = `${player.name}'s Zetas (${count})`;
            desc.push('`------------------------------`');
            sorted.forEach(character => {
                desc.push(`\`(${zetas[character].length})\` ${character}`);
            });
            desc.push('`------------------------------`');
            desc.push('`;zeta <character>` for more info.');
        } else {
            author.name = `${player.name}'s ${character.name} (${count})`;
            author.icon_url = character.avatarURL;
            if (!zetas[sorted[0]] || zetas[sorted[0]].length === 0) {
                desc.push(message.language.get('COMMAND_ZETA_NO_ZETAS'));
            } else {
                desc.push(zetas[sorted[0]].join('\n'));
            }
        }
        
        const lastUpdated = moment.duration(Math.abs(moment(player.updated).diff(moment()))).format("d [days], h [hrs], m [min]");

        msg.edit({embed: {
            color: 0x000000,
            author: author,
            description: desc.join('\n'), 
            footer: {
                text: message.language.get('BASE_SWGOH_LAST_UPDATED', lastUpdated)
            }
        }});
    }
}

module.exports = Zetas;

