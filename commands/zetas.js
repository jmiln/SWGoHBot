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

    async run(client, message, [userID, ...args], level) { // eslint-disable-line no-unused-vars
        // Need to get the allycode from the db, then use that
        if (!userID) {
            userID = message.author.id;
        } else {
            userID += args.length ? ' ' + args.join(' ') : '';
        }
        const allyCodes = await client.getAllyCode(message, userID);
        let allyCode;
        if (!allyCodes.length) {
            // Tell em no match found
            return message.channel.send("I didn't find any results for that user");
        } else if (allyCodes.length > 1) {
            // Tell em there's too many
            return message.channel.send('Found ' + allyCodes.length + ' matches. Please try being more specific');
        } else {
            allyCode = allyCodes[0];
        }

        const msg = await message.channel.send(message.language.get('BASE_SWGOH_PLS_WAIT_FETCH', 'zetas'));

        let results = await client.sqlQuery('CALL getZetasFromAlly( ? )', [allyCode]);

        const zetas = {};
        let playerName, lastUpdated;
        if (results) {
            results = results[0];
            let count = 0;
            results.forEach((row, ix) => {
                if (ix === 0) {
                    playerName = row.Name;
                    lastUpdated = moment.duration(Math.abs(moment(row.updated).diff(moment()))).format("d [days], h [hrs], m [min]");
                }
                row.Character = row.Character.replace(/[\\"]/g, '');
                count += 1;
                row.aName = `\`[${row.ID.toUpperCase()[0]}]\` ${row.aName.replace(/"/g, '')}`;
                if (zetas.hasOwnProperty(row.Character)) {
                    zetas[row.Character].push(row.aName);
                } else {
                    zetas[row.Character] = [row.aName];
                }
            });
            const fields = [];
            const sorted = Object.keys(zetas).sort((p, c) => p > c ? 1 : -1);
            sorted.forEach(character => {
                fields.push({
                    name: `(${zetas[character].length}) ${character}`,
                    value: zetas[character].join('\n') + '\n`' + '-'.repeat(30) + '`',
                    inline: true
                });
            });
            const auth = message.guild.members.get(userID);
            const author = {name: `${playerName}'s Zetas (${count})`};
            if (auth) {
                author.icon_url = auth.user.avatarURL;
            } else {
                author.name = `${playerName ? playerName : client.users.get(userID).username}'s Zetas (${count})`;
            }
            let desc;
            if (fields.length === 0) {
                desc = message.language.get('COMMAND_ZETA_NO_ZETAS');
            } else {
                desc = message.language.get('COMMAND_ZETA_OUT_DESC');
            }
            msg.edit({embed: {
                color: 0x000000,
                author: author,
                description: desc, 
                fields: fields,
                footer: {
                    text: message.language.get('BASE_SWGOH_LAST_UPDATED', lastUpdated)
                }
            }});
        } else {
            msg.edit(message.language.get('BASE_SWGOH_NO_ACCT'));
        }
    }
}

module.exports = Zetas;

