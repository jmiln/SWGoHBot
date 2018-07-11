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
        let starLvl = null;
        const sortType = options.subArgs.sort.toLowerCase();
        const reverse = options.flags.reverse;
        const lang = message.guildSettings.swgohLanguage;

        // If there's enough elements in searchChar, and it's in the format of a number*
        if (searchChar.length > 0 && searchChar[searchChar.length-1].match(/\d\*/)) {
            starLvl = parseInt(searchChar.pop().replace('*', ''));
            if (starLvl < 1 || starLvl > 7) {
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
        }

        if (!searchChar.length) {
            return message.channel.send(message.language.get('COMMAND_GUILDSEARCH_MISSING_CHAR'));
        } 
        
        searchChar = searchChar.join(' ');
        
        const chars = !options.flags.ships ? client.findChar(searchChar, client.characters) : client.findChar(searchChar, client.ships);
        
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
            player = await client.swgohAPI.getPlayer(userID, 'ENG_US', 6);
            userID = player.guildName;
        } catch (e) {
            console.error(e);
        }

        let guild = null;
        try {
            guild = await client.swgohAPI.report('getGuildRoster', {guildName: userID});
        } catch (e) {
            console.log('ERROR: ' + e);
        }

        if (!guild || !guild.length) {
            return message.channel.send(message.language.get('BASE_SWGOH_NO_GUILD'));
        }

        let maxZ = 0;
        for (const member of guild) {
            member.roster = member.roster.filter(c => (c.name === character.name || c.name === character.uniqueName));
            if (member.roster[0] && member.roster[0].zetas) {
                if (member.roster[0].zetas.length > maxZ) {
                    maxZ = member.roster[0].zetas.length;
                }
            }
        }

        let sortedGuild = [];
        if (sortType === 'name') {
            // Sort by name
            if (!reverse) {
                sortedGuild = guild.sort((p, c) => p.name.toLowerCase() > c.name.toLowerCase() ? 1 : -1);
            } else {
                sortedGuild = guild.sort((p, c) => p.name.toLowerCase() < c.name.toLowerCase() ? 1 : -1);
            }
        } else if (sortType === 'gp') {
            // Sort by gp
            if (!reverse) {
                sortedGuild = guild.sort((p, c) => (p.roster[0] && c.roster[0]) ? p.roster[0].gp - c.roster[0].gp : -1);
            } else {
                sortedGuild = guild.sort((p, c) => (p.roster[0] && c.roster[0]) ? c.roster[0].gp - p.roster[0].gp : -1);
            }
        } else {
            return message.channel.send(message.language.get('COMMAND_GUILDSEARCH_BAD_SORT', sortType, ['name', 'gp']));
        }

        const charOut = {};
        for (const member of sortedGuild) {
            const charL = member.roster;

            const thisStar = charL.length ? charL[0].rarity : 0;
            let zetas = '', gpStr = '', zLen = 0;
            if (thisStar) {
                zLen = charL[0].zetas ? charL[0].zetas.length : 0;
                zetas = ' | ' + '+'.repeat(zLen) + ' '.repeat(maxZ - zLen);
                gpStr = charL[0].gp ? parseInt(charL[0].gp).toLocaleString() : '';
            }
            
            const uStr = thisStar > 0 ? `**\`[⛭${charL[0].gear < 10 ? charL[0].gear + ' ' : charL[0].gear } | ${gpStr + ' '.repeat(6 - gpStr.length)}${maxZ > 0 ? zetas : ''}]\`** ${member.name}` : member.name;
            if (!charOut[thisStar]) {
                charOut[thisStar] = [uStr];
            } else {
                charOut[thisStar].push(uStr);
            }
        }

        const fields = [];
        let outArr = reverse ? Object.keys(charOut).reverse() : Object.keys(charOut);
        outArr.forEach(star => {
            if (star >= starLvl) {
                const msgArr = client.msgArray(charOut[star], '\n', 1000);
                msgArr.forEach((msg, ix) => {
                    const name = star === '0' ? message.language.get('COMMAND_GUILDSEARCH_NOT_ACTIVATED', charOut[star].length) : message.language.get('COMMAND_GUILDSEARCH_STAR_HEADER', star, charOut[star].length);
                    fields.push({
                        name: msgArr.length > 1 ? name + ` (${ix+1}/${msgArr.length})` : name,
                        value: msgArr[ix]
                    });
               })
            }
        });

        message.channel.send({embed: {
            author: {
                name: message.language.get('BASE_SWGOH_NAMECHAR_HEADER', userID, character.name)
            },
            fields: fields
        }});
    }
}

module.exports = GuildSearch;

