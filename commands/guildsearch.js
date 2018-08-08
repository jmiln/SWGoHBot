const Command = require('../base/Command');
// const {inspect} = require('util');

class GuildSearch extends Command {
    constructor(client) {
        super(client, {
            name: 'guildsearch',
            category: "SWGoH",
            aliases: ['search', 'gs'],
            permissions: ['EMBED_LINKS'],
            flags: {
                'ships': {
                    aliases: ['s', 'ship']
                },
                reverse: {
                    aliases: ['rev']
                }
            },
            subArgs: {
                sort: {
                    aliases: [],
                    default: 'name'
                }
            }
        });
    }

    async run(client, message, [userID, ...searchChar], options) { // eslint-disable-line no-unused-vars
        let starLvl = 0;
        const sortType = options.subArgs.sort ? options.subArgs.sort.toLowerCase() : 'name';
        const reverse = options.flags.reverse;

        // If there's enough elements in searchChar, and it's in the format of a number*
        if (searchChar.length > 0 && !isNaN(parseInt(searchChar[searchChar.length-1]))) {
            starLvl = parseInt(searchChar.pop());
            if (starLvl < 0 || starLvl > 7) {
                return message.channel.send(message.language.get('COMMAND_GUILDSEARCH_BAD_STAR'));
            }
        }
        
        // Need to get the allycode from the db, then use that
        if (!userID) {
            return message.channel.send(message.language.get('COMMAND_GUILDSEARCH_MISSING_CHAR'));
        }
        if (userID === "me" || client.isUserID(userID) || client.isAllyCode(userID)) {
            userID = await client.getAllyCode(message, userID);
            if (!userID.length) {
                return message.channel.send(message.language.get('BASE_SWGOH_NO_GUILD_FOR_USER', message.guildSettings.prefix));
            }
            userID = userID[0];
        } else {
            // If they're just looking for a character for themselves, get the char
            searchChar = [userID].concat(searchChar);
            userID = await client.getAllyCode(message, message.author.id);
            if (!userID.length) {
                return message.channel.send(message.language.get('BASE_SWGOH_NO_GUILD_FOR_USER', message.guildSettings.prefix));
            }
            userID = userID[0];
        }

        if (!searchChar.length) {
            return message.channel.send(message.language.get('COMMAND_GUILDSEARCH_MISSING_CHAR'));
        } 
        
        searchChar = searchChar.join(' ');
        
        const chars = !options.flags.ships ? client.findChar(searchChar, client.characters) : client.findChar(searchChar, client.ships, true);
        
        let character;
        
        if (chars.length === 0) {
            return message.channel.send(message.language.get('COMMAND_GUILDSEARCH_NO_RESULTS', searchChar));
        } else if (chars.length > 1) {
            const charL = [];
            const charS = chars.sort((p, c) => p.name > c.name ? 1 : -1);
            charS.forEach(c => {
                charL.push(c.name);
            });
            return message.channel.send(message.language.get('COMMAND_GUILDSEARCH_CHAR_LIST', charL.join('\n')));
        } else {
            character = chars[0];
        }

        let player = null;
        try {
            player = await client.swgohAPI.player(userID);
        } catch (e) {
            console.log('ERROR: ' + e);
        }


        let guild = null;
        try {
            guild = await client.swgohAPI.guildGG(userID);
        } catch (e) {
            console.log('ERROR: ' + e);
        }

        if (!guild) {
            return message.channel.send(message.language.get('BASE_SWGOH_NO_GUILD'));
        }

        // Get the list of people with that character
        const guildChar = guild[character.uniqueName];
        
        // Fill in everyone that does not have it since everyone is guaranteed to have jedi consular
        guild['JEDIKNIGHTCONSULAR'].forEach(j => {
            // If they have both the targeted character and consular, get em
            const filtered = guildChar.filter(p => p.player === j.player);

            // If they don't, it'll be a 0 length array, so fill it in with 0 stats
            if (!filtered.length) {
                guildChar.push({
                    id: j.id,           // Ally code
                    gear_level: 0,
                    power: 0,
                    level: 0,
                    combat_type: 1,
                    rarity: 0,
                    player: j.player,   // Player name
                    zetas: []
                });
            }
        });

        let maxZ = 0;
        for (const member of guildChar) {
            if (member.zetas.length > maxZ) {
                maxZ = member.zetas.length;
            }
        }

        let sortedGuild = [];
        if (sortType === 'name') {
            // Sort by name
            if (!reverse) {
                sortedGuild = guildChar.sort((p, c) => p.player.toLowerCase() > c.player.toLowerCase() ? 1 : -1);
            } else {
                sortedGuild = guildChar.sort((p, c) => p.player.toLowerCase() < c.player.toLowerCase() ? 1 : -1);
            }
        } else if (sortType === 'gp') {
            // Sort by gp
            if (!reverse) {
                sortedGuild = guildChar.sort((p, c) => p.power - c.power);
            } else {
                sortedGuild = guildChar.sort((p, c) => c.power - p.power);
            }
        } else {
            return message.channel.send(message.language.get('COMMAND_GUILDSEARCH_BAD_SORT', sortType, ['name', 'gp']));
        }

        const charOut = {};
        for (const member of sortedGuild) {
            const gearStr = '⚙' + member.gear_level + ' '.repeat(2 - member.gear_level.toString().length);
            const zetas = ' | ' + '+'.repeat(member.zetas.length) + ' '.repeat(maxZ - member.zetas.length);
            const gpStr = member.power.toLocaleString();
            
            let uStr = member.rarity > 0 ? `**\`[${gearStr} | ${gpStr + ' '.repeat(6 - gpStr.length)}${maxZ > 0 ? zetas : ''}]\`** ${member.player}` : member.player;

            uStr = client.expandSpaces(uStr);

            if (!charOut[member.rarity]) {
                charOut[member.rarity] = [uStr];
            } else {
                charOut[member.rarity].push(uStr);
            }
        }

        const fields = [];
        const outArr = reverse ? Object.keys(charOut).reverse() : Object.keys(charOut);
        outArr.forEach(star => {
            if (star >= starLvl) {
                const msgArr = client.msgArray(charOut[star], '\n', 1000);
                msgArr.forEach((msg, ix) => {
                    const name = star === 0 ? message.language.get('COMMAND_GUILDSEARCH_NOT_ACTIVATED', charOut[star].length) : message.language.get('COMMAND_GUILDSEARCH_STAR_HEADER', star, charOut[star].length);
                    fields.push({
                        name: msgArr.length > 1 ? name + ` (${ix+1}/${msgArr.length})` : name,
                        value: msgArr[ix]
                    });
                });
            }
        });

        message.channel.send({embed: {
            author: {
                name: message.language.get('BASE_SWGOH_NAMECHAR_HEADER', player.guildName, character.name)
            },
            fields: fields
        }});
    }
}

module.exports = GuildSearch;

