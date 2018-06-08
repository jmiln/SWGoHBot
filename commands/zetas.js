const Command = require('../base/Command');
const moment = require('moment');
const {inspect} = require('util');

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
            return message.channel.send("That user is not registered. `;help register` for more info");
        } else if (allyCodes.length > 1) {
            // Tell em there's too many
            return message.channel.send('Found ' + allyCodes.length + ' matches. Please try being more specific');
        } else {
            allyCode = allyCodes[0];
        }

        const msg = await message.channel.send(message.language.get('BASE_SWGOH_PLS_WAIT_FETCH', 'zetas'));



        let player;
        try {
            player = await client.swgohAPI.getPlayer(allyCode, 'ENG_US', 3);
        } catch (e) {
            console.log('Error: Broke while trying to get player data in zetas: ' + e);
            return msg.edit(message.language.get('BASE_SWGOH_NO_ACCT'));
        }

        const zetas = {};
        let count = 0;
        player.roster.forEach(char => {
            char.skills.forEach(skill => {
                if (skill.isZeta && skill.tier === 8) {
                    count++;
                    if (!zetas[char.name]) {
                        zetas[char.name] = ['`[' + skill.type.charAt(0) + ']` ' + skill.name];
                    } else {
                        zetas[char.name].push('`[' + skill.type.charAt(0) + ']` ' + skill.name);
                    }
                }
            });
        });

        const sorted = Object.keys(zetas).sort((p, c) => p > c ? 1 : -1);
        const fields = [];
        sorted.forEach(character => {
            fields.push({
                name: `(${zetas[character].length}) ${character}`,
                value: zetas[character].join('\n') + '\n`' + '-'.repeat(33) + '`',
                inline: true
            });
        });
        const auth = message.guild.members.get(userID);
        const author = {name: `${player.name}'s Zetas (${count})`};
        if (auth) {
            author.icon_url = auth.user.avatarURL;
        } 
        let desc;
        if (fields.length === 0) {
            desc = message.language.get('COMMAND_ZETA_NO_ZETAS');
        } else {
            desc = message.language.get('COMMAND_ZETA_OUT_DESC');
        }
        
        const lastUpdated = moment.duration(Math.abs(moment(player.updated).diff(moment()))).format("d [days], h [hrs], m [min]");
        // TODO Make sure things are updatin/ not updating as they should
        // console.log(inspect(player))
        // console.log(`Then ${player.updated} vs Now ${moment()} $:$ ${moment().diff(moment(player.updated))} $:$  ${lastUpdated}`)

        // console.log(lastUpdated)
        msg.edit({embed: {
            color: 0x000000,
            author: author,
            description: desc, 
            fields: fields,
            footer: {
                text: message.language.get('BASE_SWGOH_LAST_UPDATED', lastUpdated)
            }
        }});
    }
}

module.exports = Zetas;

