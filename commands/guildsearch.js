const Command = require('../base/Command');
const mysql = require('mysql');
const {inspect} = require('util');

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
        const charRarity = {
            "ONE_STAR":   1,
            "TWO_STAR":   2,
            "THREE_STAR": 3,
            "FOUR_STAR":  4,
            "FIVE_STAR":  5,
            "SIX_STAR":   6,
            "SEVEN_STAR": 7
        };

        let ships = options.flags.ships;
        let starLvl = null;
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
            searchChar = [userID].concat(searchChar).join(' ');
            userID = await client.getAllyCode(message, message.author.id);
        }
        const chars = !ships ? client.findChar(searchChar, client.characters) : client.findChar(searchChar, client.ships);
        let character, charURL;
        if (!searchChar) {
            return message.channel.send(message.language.get('COMMAND_GUILDSEARCH_MISSING_CHAR'));
        } 
        
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
            charURL = character.avatarURL;
        }

         
		
        try {
            const player = await client.swgohAPI.getPlayer(userID, 'ENG_US');
            console.log('Player: ' + player);
            userID = player.guildName;
        } catch (e) {
            console.error(e);
        }

        let guild = null;
        try {
            const swData = require('../swgohAPI/swgohService/swgohData');
            guild = await swData.query('getGuildRoster', {guildName: userID});
        } catch (e) {
            console.log('ERROR: ' + e);
        }

        if (!guild || !guild.length) {
            return message.channel.send('I cannot find any users for that guild. \nPlease make sure you have spelled the name correctly, and that the capitalization is correct.');
        }
        const sortedGuild = guild.sort((p, c) => p.name.toLowerCase() > c.name.toLowerCase() ? 1 : -1);

        const charOut = {};
        for (let member of sortedGuild) {
            const charL = member.roster.filter(c => (c.name === character.name || c.name === character.uniqueName));

            const thisStar = charL.length ? charL[0].rarity : 0;
            const uStr = thisStar > 0 ? `\`g${charL[0].gear}\` ${member.name}` : member.name;
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
                })
            }
        });


		message.channel.send({embed: {
            author: {
                name: `${userID}'s ${character.name}`
            },
            fields: fields
        }});



        // const pool = mysql.createPool({
        //     host     : client.config.mySqlDB.host,
        //     user     : client.config.mySqlDB.user,
        //     password : client.config.mySqlDB.password,
        //     database : client.config.mySqlDB.database,
        //     connectionLimit : 100
        // });
        // let guildName;
        // const allyCodes = [];
        // const charList = {};
        // await pool.query(`CALL getGuildMembersFromAlly(${allyCode})`, async function(err, results) {
        //     results[0].forEach(row => {
        //         allyCodes.push(row.allyCode);
        //         guildName = row.guildName;
        //     });
        //     for (var i = 0; i < allyCodes.length; i++) {
        //         const res = await getResult(`call getCharFromAlly(${allyCodes[i]}, '${character.uniqueName}');`);
        //         if (res[0][0]) {
        //             const thisRes = res[0][0];
        //             const rarity = charRarity[thisRes.rarity];
        //             if (!charList[rarity]) {
        //                 charList[rarity] = [thisRes.name];
        //             } else {
        //                 charList[rarity].push(thisRes.name);
        //             }
        //         }
        //     }
        //     pool.end();
        //     const fields = [];
        //     Object.keys(charList).forEach((tier) => {
        //         // Sort the names of everyone 
        //         const sorted = charList[tier].sort((p, c) => p.toLowerCase() > c.toLowerCase() ? 1 : -1);
        //         if (starLvl && starLvl !== parseInt(tier)) return; 
        //         // In case the names become too long for one field
        //         if (sorted.join('\n').length > 1800) {
        //             const out = {
        //                 first: [],
        //                 last: []
        //             };
        //             const hLen = sorted.length/2; 
        //             sorted.forEach((u, ix) => {
        //                 if (ix < hLen) {
        //                     out.first.push(u);
        //                 } else {
        //                     out.last.push(u);
        //                 }
        //             });
        //             fields.push({
        //                 name: message.language.get('COMMAND_GUILDSEARCH_FIELD_HEADER', tier, charList[tier].length, '1/2'),
        //                 value: out.first.join('\n')
        //             });
        //             fields.push({
        //                 name: message.language.get('COMMAND_GUILDSEARCH_FIELD_HEADER', tier, charList[tier].length, '2/2'),
        //                 value: out.last.join('\n')
        //             });
        //         } else {
        //             fields.push({
        //                 name: message.language.get('COMMAND_GUILDSEARCH_FIELD_HEADER', tier, charList[tier].length),
        //                 value: sorted.join('\n')
        //             });
        //         }
        //     });
        //     if (fields.length === 0) {
        //         if (starLvl) {
        //             fields.push({
        //                 name: starLvl + ' Star (0)',
        //                 value:  message.language.get('COMMAND_GUILDSEARCH_NO_CHAR_STAR', starLvl)
        //             });
        //         } else {
        //             fields.push({
        //                 name: '(0)',
        //                 value:  message.language.get('COMMAND_GUILDSEARCH_NO_CHAR')
        //             });
        //         }
        //     }
        //     message.channel.send({embed: {
        //         color: 0x000000,
        //         author: {
        //             name: `${guildName}'s ${character.name}`,
        //             icon_url: charURL
        //         },
        //         fields: fields
        //     }});
        // });

        function getResult(sql) {
            return new Promise(function(resolve,reject) {
                pool.query(sql, function(err, result) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(result);
                    }
                });
            });
        }
    }
}

module.exports = GuildSearch;

