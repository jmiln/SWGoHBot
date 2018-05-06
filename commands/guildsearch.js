const Command = require('../base/Command');
const mysql = require('mysql');

class GuildSearch extends Command {
    constructor(client) {
        super(client, {
            name: 'guildsearch',
            category: "SWGoH",
            aliases: ['search'],
            permissions: ['EMBED_LINKS']
        });
    }

    async run(client, message, [userID, ...searchChar]) { // eslint-disable-line no-unused-vars
        const charRarity = {
            "ONE_STAR":   1,
            "TWO_STAR":   2,
            "THREE_STAR": 3,
            "FOUR_STAR":  4,
            "FIVE_STAR":  5,
            "SIX_STAR":   6,
            "SEVEN_STAR": 7
        };

        const shipArr = ['-ships', '-s', '-ship'];
        let ships = false;
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
        if (shipArr.includes(userID) && searchChar.length) {
            ships = true;
            userID = searchChar.splice(0, 1)[0];
        } else if (shipArr.filter(e => searchChar.includes(e)).length > 0) {
            const comp = shipArr.filter(e => searchChar.includes(e));
            ships = true;
            comp.forEach(e => {
                searchChar.splice(searchChar.indexOf(e));
            });
        }
        if (userID === "me") {
            userID = message.author.id;
        } else if (userID.match(/\d{17,18}/)) {
            userID = userID.replace(/[^\d]*/g, '');
        } else {
            // If they're just looking for a character for themselves, get the char
            searchChar = [userID].concat(searchChar);
            userID = message.author.id;
        }
        searchChar = searchChar.join(' ');
        const chars = !ships ? client.findChar(searchChar, client.characters) : client.findChar(searchChar, client.ships);
        let character;
        let charURL;
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

        const ally = await client.allyCodes.findOne({where: {id: userID}});
        if (!ally) {
            return message.channel.send(message.language.get('BASE_SWGOH_NOT_REG', client.users.get(userID).tag));
        }       
        const allyCode = ally.dataValues.allyCode;

        const pool = mysql.createPool({
            host     : client.config.mySqlDB.host,
            user     : client.config.mySqlDB.user,
            password : client.config.mySqlDB.password,
            database : client.config.mySqlDB.database,
            connectionLimit : 100
        });
        let guildName;
        const allyCodes = [];
        const charList = {};
        await pool.query(`CALL getGuildMembersFromAlly(${allyCode})`, async function(err, results) {
            results[0].forEach(row => {
                allyCodes.push(row.allyCode);
                guildName = row.guildName;
            });
            for (var i = 0; i < allyCodes.length; i++) {
                const res = await getResult(`call getCharFromAlly(${allyCodes[i]}, '${character.uniqueName}');`);
                if (res[0][0]) {
                    const thisRes = res[0][0];
                    const rarity = charRarity[thisRes.rarity];
                    if (!charList[rarity]) {
                        charList[rarity] = [thisRes.name];
                    } else {
                        charList[rarity].push(thisRes.name);
                    }
                }
            }
            pool.end();
            const fields = [];
            Object.keys(charList).forEach((tier) => {
                // Sort the names of everyone 
                const sorted = charList[tier].sort((p, c) => p.toLowerCase() > c.toLowerCase() ? 1 : -1);
                if (starLvl && starLvl !== parseInt(tier)) return; 
                // In case the names become too long for one field
                if (sorted.join('\n').length > 1800) {
                    const out = {
                        first: [],
                        last: []
                    };
                    const hLen = sorted.length/2; 
                    sorted.forEach((u, ix) => {
                        if (ix < hLen) {
                            out.first.push(u);
                        } else {
                            out.last.push(u);
                        }
                    });
                    fields.push({
                        name: message.language.get('COMMAND_GUILDSEARCH_FIELD_HEADER', tier, charList[tier].length, '1/2'),
                        value: out.first.join('\n')
                    });
                    fields.push({
                        name: message.language.get('COMMAND_GUILDSEARCH_FIELD_HEADER', tier, charList[tier].length, '2/2'),
                        value: out.last.join('\n')
                    });
                } else {
                    fields.push({
                        name: message.language.get('COMMAND_GUILDSEARCH_FIELD_HEADER', tier, charList[tier].length),
                        value: sorted.join('\n')
                    });
                }
            });
            if (fields.length === 0) {
                if (starLvl) {
                    fields.push({
                        name: starLvl + ' Star (0)',
                        value:  message.language.get('COMMAND_GUILDSEARCH_NO_CHAR_STAR', starLvl)
                    });
                } else {
                    fields.push({
                        name: '(0)',
                        value:  message.language.get('COMMAND_GUILDSEARCH_NO_CHAR')
                    });
                }
            }
            message.channel.send({embed: {
                color: 0x000000,
                author: {
                    name: `${guildName}'s ${character.name}`,
                    icon_url: charURL
                },
                fields: fields
            }});
        });

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

