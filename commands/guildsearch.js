const Command = require('../base/Command');
// const {inspect} = require('util');

class GuildSearch extends Command {
    constructor(client) {
        super(client, {
            name: 'guildsearch',
            category: "SWGoH",
            aliases: ['search'],
            permissions: ['EMBED_LINKS'],
            flags: {
                'ships': {
                    aliases: ['s', 'ship']
                }
            }
        });
    }

    async run(client, message, [userID, ...searchChar], options) { // eslint-disable-line no-unused-vars
        let starLvl = null;
        const lang = message.guildSettings.swgohLanguage;
        // If there's enough elements in searchChar, and it's in the format of a numer*
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
                return message.channel.send('I cannot find a guild for that user.');
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
        
        try {
            const player = await client.swgohAPI.getPlayer(userID, lang, 6);
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
            return message.channel.send('I cannot find any users for that guild. \nPlease make sure you have spelled the name correctly, and that the capitalization is correct.');
        }
        const sortedGuild = guild.sort((p, c) => p.name.toLowerCase() > c.name.toLowerCase() ? 1 : -1);

        const charOut = {};
        for (const member of sortedGuild) {
            const charL = member.roster.filter(c => (c.name === character.name || c.name === character.uniqueName));

            const thisStar = charL.length ? charL[0].rarity : 0;
            if (charL.length && charL[0].gp) {
                console.log('GOT GP: ' + charL[0]);
            } else if (member.name === 'Reaper1395') {
                console.log(charL[0]);
            }
            const uStr = thisStar > 0 ? `\`${charL[0].level} g${charL[0].gear} ${charL[0].gp ? charL[0].gp + 'GP' : ''}\` ${member.name}` : member.name;
            if (!charOut[thisStar]) {
                charOut[thisStar] = [uStr];
            } else {
                charOut[thisStar].push(uStr);
            }
        }

        const fields = [];
        Object.keys(charOut).forEach(star => {
            if (star >= starLvl) {
                fields.push({
                    name: star === '0' ? `Not Activated (${charOut[star].length})` : `${star} Star (${charOut[star].length})`,
                    value: charOut[star].join('\n')
                });
            }
        });

        message.channel.send({embed: {
            author: {
                name: `${userID}'s ${character.name}`
            },
            fields: fields
        }});
    }
}

module.exports = GuildSearch;

