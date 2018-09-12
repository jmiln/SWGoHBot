const Command = require('../base/Command');
const moment = require('moment');

class Zetas extends Command {
    constructor(client) {
        super(client, {
            name: 'zetas',
            category: "SWGoH",
            aliases: ['zeta', 'z'],
            permissions: ['EMBED_LINKS'],
            flags: {
                'r': {
                    aliases: ['rec', 'recommend', 'recommendations']
                }
            }
        });
    }

    async run(client, message, [userID, ...searchChar], options) { // eslint-disable-line no-unused-vars
        let allyCode;
        const filters = ['pit', 'pvp', 'sith', 'tank', 'tb', 'tw'];
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
        
        searchChar = searchChar.join(' ').trim();
        
        if (searchChar.length && !filters.includes(searchChar.toLowerCase())) { 
            return message.channel.send(message.language.get('COMMAND_ZETA_REC_BAD_FILTER', filters.join(', ')));
        }             
        
        const msg = await message.channel.send(message.language.get('BASE_SWGOH_PLS_WAIT_FETCH', 'zetas'));

        const cooldown = client.getPlayerCooldown(message.author.id);
        let player;

        try {
            player = await client.swgohAPI.player(allyCode, null, cooldown);
        } catch (e) {
            console.log('Error: Broke while trying to get player data in zetas: ' + e);
            return msg.edit(message.language.get('BASE_SWGOH_NO_ACCT'));
        }

        if (!options.flags.r) {
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

            const zetas = {};
            let count = 0;
            player.roster.forEach(char => {
                // If they are not looking for a specific character, check em all
                if (!character || character.uniqueName === char.defId) {
                    if (!char.name) {
                        const tmp = client.characters.filter(c => c.uniqueName === char.defId);
                        if (tmp.length) {
                            char.name = tmp[0].name;
                        }
                    }
                    char.skills.forEach(skill => {
                        if (skill.isZeta && skill.tier === 8) {
                            count++;
                            // If the character is not already listed, add it
                            if (!zetas[char.name]) {
                                zetas[char.name] = ['`[' + skill.id.charAt(0) + ']` ' + skill.name];
                            } else {
                                zetas[char.name].push('`[' + skill.id.charAt(0) + ']` ' + skill.name);
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
                desc.push(message.language.get('COMMAND_ZETA_MORE_INFO'));
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
        } else {
            // Zeta recommendations
            const zetas = client.zetaRec;
            const myZetas = [];

            const sortBy = searchChar.length ? searchChar : 'versa';
            const zetaSort = sortBy ? zetas.zetas.sort((a, b) => a[sortBy] - b[sortBy]) : zetas.zetas.sort((a, b) => a.toon - b.toon);
            for (let ix = 0; ix < zetaSort.length; ix ++) {
                if (myZetas.length >= 5) {
                    break;
                }
                if (zetaSort[ix][sortBy] === 0) continue;
                const char = player.roster.find(c => zetaSort[ix].toon === c.name);
                let skill = null;
                if (char) {
                    skill = char.skills.find(a => a.name === zetaSort[ix].name);
                }
                if (skill && skill.tier < 8 && char.level >= 80) {
                    skill.toon = char.name;
                    skill.gearLvl = char.gear;
                    skill.lvl = char.level;
                    skill.star = char.rarity;
                    myZetas.push(skill);
                }
            }

            let desc = message.language.get('COMMAND_ZETA_REC_HEADER');
            desc += '\n`' + filters.join(', ') + '`\n`------------------------------`\n';
            myZetas.forEach(z => {
                desc += `**${z.name}**\n${z.toon}\n\`${message.language.get('BASE_LEVEL_SHORT')}${z.lvl} | ⚙${z.gearLvl} | ${z.star}*\`\n${client.zws}\n`;
            });

            const zetaLen = `${myZetas.length} ${sortBy === 'versa' ? '' : sortBy + ' '}`;
            return msg.edit({embed: {
                author: {
                    name: message.language.get('COMMAND_ZETA_REC_AUTH', zetaLen, player.name)
                },
                description: desc
            }});
        }
    }
}

module.exports = Zetas;

