const Command = require('../base/Command');
// const moment = require('moment');
// const {inspect} = require('util');

class MyProfile extends Command {
    constructor(client) {
        super(client, {
            name: 'myprofile',
            category: "SWGoH",
            aliases: ['mp', 'userprofile', 'up'],
            permissions: ['EMBED_LINKS']    // Starts with ['SEND_MESSAGES', 'VIEW_CHANNEL'] so don't need to add them
        });
    }

    async run(client, message, [user], level) { // eslint-disable-line no-unused-vars
        const lang = message.guildSettings.swgoghLanguage;
        const allyCodes = await client.getAllyCode(message, user);
        if (!allyCodes.length) {
            return message.channel.send(message.language.get('BASE_SWGOH_NO_ALLY'));
        } else if (allyCodes.length > 1) {
            return message.channel.send('Found ' + allyCodes.length + ' matches. Please try being more specific');
        }
        const allyCode = allyCodes[0];

        let player;
        try {
            // player = await client.swgohAPI.fetchPlayer(allyCode, null, lang);
            player = await client.swgohAPI.player(allyCode, lang);
        } catch (e) {
            console.log('Broke getting player in myprofile: ' + e);
        }

        const fields = [];
        const charList = player.roster.filter(u => u.type === 'char');
        let zetaCount = 0;
        charList.forEach(char => {
            const thisZ = char.skills.filter(s => s.isZeta && s.tier === 8);    // Get all zetas for that character
            zetaCount += thisZ.length;
        });
        const charOut = message.language.get('COMMAND_MYPROFILE_CHARS', player.gpChar.toLocaleString(), charList, zetaCount);
        fields.push({
            name: charOut.header,
            value: [
                '```asciidoc',
                charOut.stats,
                '```'
            ].join('\n')
        });

        const shipList = player.roster.filter(u => u.type === 'ship');
        const shipOut = message.language.get('COMMAND_MYPROFILE_SHIPS', player.gpShip.toLocaleString(), shipList);
        fields.push({
            name: shipOut.header,
            value: [
                '```asciidoc',
                shipOut.stats,
                '```'
            ].join('\n')
        });

        return message.channel.send({embed: {
            author: {
                name: message.language.get('COMMAND_MYPROFILE_EMBED_HEADER', player.name, player.allyCode),
            },
            description: message.language.get('COMMAND_MYPROFILE_DESC', player.guildName, player.level, player.arena.char.rank, player.arena.ship.rank, player.gpFull.toLocaleString()),
            footer: {
                text: message.language.get('BASE_SWGOH_LAST_UPDATED', client.duration(player.updated, message))
            },
            fields: fields
        }});
    }
}

module.exports = MyProfile;
