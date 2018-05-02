const Command = require('../base/Command');
// const {inspect} = require('util');

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
        let result, playerName;
        const allyCode = await client.getAllyCode(message, user);
        if (!allyCode) {
            return message.channel.send(message.language.get('BASE_SWGOH_NO_ALLY'));
        }
        try {
            result = await fetchPlayer(allyCode);

            if (!result || !result[0] || !result[0].pvpProfileList) { 
                return message.channel.send(message.language.get('COMMAND_MYARENA_NO_USER', (!user || user === 'me') ? 'you' : 'that user')); 
            }
            result = result[0].pvpProfileList;
            playerName = await client.sqlQuery('CALL getNameFromAlly( ? )', allyCode);
            playerName = playerName[0][0].name;
        } catch (e) {
            return console.log('ERROR: ', e);
        }

        const squads = {};

        squads.arena = {};
        squads.arena.rank = result[0].rank;
        squads.arena.units = [];
        for (let u = 0; u < result[0].squad.cellList.length; ++u ) {
            squads.arena.units[result[0].squad.cellList[u].cellIndex] = result[0].squad.cellList[u].unitDefId;
        }

        let cnames = null;
        try {
            cnames = await client.sqlQuery('CALL getCharNames( ? )', `'${squads.arena.units.join("','")}'`);
            if (!cnames) {
                return message.channel.send(message.language.get('COMMAND_MYARENA_NO_CHAR'));
            }
            cnames = cnames[0];
        } catch (e) {
            return console.error('Error getting arena squad names: ', e);
        }

        let snames = null;
        if ( result.length > 1 ) {

            squads.ships = {};
            squads.ships.rank = result[1].rank;
            squads.ships.units = []; 
            for (let u = 0; u < result[1].squad.cellList.length; ++u ) {
                squads.ships.units[result[1].squad.cellList[u].cellIndex] = result[1].squad.cellList[u].unitDefId;
            }

            try {
                snames = await client.sqlQuery('CALL getCharNames( ? )', `'${squads.ships.units.join("','")}'`);
                if (!snames) {
                    return message.channel.send(message.language.get('COMMAND_MYARENA_NO_CHAR'));
                }
                snames = snames[0];
            } catch (e) {
                return console.error('Error getting ship squad names: ', e);
            }

        }

        const fields = [];
        const positions = [ "L|", "2|", "3|", "4|", "5|", "6|", "B|", "B|", "B|", "B|", "B|" ];

        if (snames) {
            const sArr = new Array(snames.length);
            snames.forEach(ch => {
                const ix = squads.ships.units.indexOf(ch.id);
                sArr.splice(ix, 1, `\`${positions[ix]}\` ${ch.name.replace(/"/g, '')}`);
            });
            const stext = sArr.join('\n') + "\n`------------------------------`\n";
            fields.push({ 
                name:   message.language.get('COMMAND_MYARENA_FLEET', squads.ships.rank),
                value:  stext,
                inline: true
            });
        }

        const aArr = new Array(cnames.length);
        cnames.forEach(ch => {
            const ix = squads.arena.units.indexOf(ch.id);
            aArr.splice(ix, 1, `\`${positions[ix]}\` ${ch.name.replace(/"/g, '')}`);
        });
        const atext = aArr.join('\n') + "\n`------------------------------`\n";
        fields.push({ 
            name:   message.language.get('COMMAND_MYARENA_ARENA', squads.arena.rank),
            value:  atext,
            inline: true
        });

        const author = {};
        author.name = message.language.get('COMMAND_MYARENA_EMBED_HEADER', playerName);
        if (!user || user === 'me' || client.isUserID(user)) {
            if (!user || user === 'me') user = message.author.id;
            const auth = message.guild.members.get(user.replace(/[^\d]*/g, ''));
            if (auth) {
                author.icon_url = auth.user.avatarURL;
            }
        } 
        return message.channel.send({embed: {
            author: author,
            footer: {
                text: message.language.get('COMMAND_MYARENA_EMBED_FOOTER', new Date().toISOString().replace(/T/g,' ').replace(/\..*/g,''))
            },
            fields: fields
        }});

        async function fetchPlayer( allycode ) {
            return new Promise( async (resolve, reject) => {
                const settings = {
                    path    : `${process.cwd()}/${client.config.swgohLoc}`,
                    hush    : true,
                    verbose : false,
                    force   : false
                };

                let profile, rpc;

                try {
                    const RpcService = require(`${settings.path}/services/service.rpc.js`);
                    rpc = await new RpcService(settings);

                    /** Start the RPC Service - with no logging**/
                    await rpc.start(`Fetching ${allycode}...\n`, false);

                    profile = await rpc.Player( 'GetPlayerProfile', { "identifier":parseInt(allycode) } );

                    /** End the RPC Service **/
                    await rpc.end("All data fetched");

                } catch (e) {
                    await rpc.end(e.message);
                    reject(e);
                }

                resolve([profile]);
            });
        }
    }
}

module.exports = MyArena;

