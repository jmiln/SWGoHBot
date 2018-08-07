const Command = require('../base/Command');
const {inspect} = require('util'); // eslint-disable-line no-unused-vars

// To get the player's arena info (Adapted from shittybill#3024's Scorpio)
class MyArena extends Command {
    constructor(client) {
        super(client, {
            name: 'myarena',
            category: "SWGoH",
            aliases: ['ma', 'userarena', 'ua'],
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
            // player = await client.swgohAPI.getPlayer(allyCode, lang);
            player = await client.swgohAPI.player(allyCode, lang);
        } catch (e) {
            console.log('Broke getting player in myarena: ' + e);
        }
         
        const fields = [];
        const positions = [ "L|", "2|", "3|", "4|", "5|" ];
        const sPositions = [ "L|", "2|", "3|", "4|", "B|", "B|", "B|", "B|" ];

        if (player.arena.ship.squad.length) {
            const sArena = [];
            player.arena.ship.squad.forEach((ship, ix) => {
                sArena.push(`\`${sPositions[ix]}\` ${ship.name}`);
            });
            fields.push({
                name: message.language.get('COMMAND_MYARENA_FLEET', player.arena.ship.rank),
                value: sArena.join('\n') + '\n`------------------------------`',
                inline: true
            });
        }

        const cArena = [];
        player.arena.char.squad.forEach((char, ix) => {
            const thisChar = player.roster.filter(c => c.id === char.id)[0];        // Get the character
            const thisZ = thisChar.skills.filter(s => s.isZeta && s.tier === 8);    // Get the zetas of that character
            cArena.push(`\`${positions[ix]}\` ${'z'.repeat(thisZ.length)}${char.name}`);
        });
        fields.push({
            name: message.language.get('COMMAND_MYARENA_ARENA', player.arena.char.rank),
            value: cArena.join('\n') + '\n`------------------------------`',
            inline: true
        });


        return message.channel.send({embed: {
            author: {
                name: message.language.get('COMMAND_MYARENA_EMBED_HEADER', player.name)
            },
            footer: {
                text: message.language.get('BASE_SWGOH_LAST_UPDATED', client.duration(player.updated, message))
            },
            fields: fields
        }});
    }
}

module.exports = MyArena;

