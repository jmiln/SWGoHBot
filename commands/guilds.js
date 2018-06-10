const Command = require('../base/Command');

class Guilds extends Command {
    constructor(client) {
        super(client, {
            name: 'guilds',
            category: "SWGoH",
            aliases: ['guild'],
            permissions: ['EMBED_LINKS'],
            flags: {
                'min': {
                    aliases: ['minimal', 'minimize', 'm']
                }
            }
        });
    }

    async run(client, message, [userID, ...args], options) { // eslint-disable-line no-unused-vars
        // Basic, with no args, shows the top ## guilds (Based on how many have registered)
        // <allyCode | mention | guildName >
        
        // Shows your guild's total GP, average GP, and a list of your members
        // Not trying to get any specific guild, show em the top ones
        if (!userID) {
            message.channel.send('I cannot currently list the top guilds, that should be coming soon**™**.\nPlease specify an Ally Code, discord ID, or guild name.');
            // const guilds = [];
            // await connection.query('CALL getAllGuilds();', function(err, results) {
            //     results[0].forEach((row, ix) => {
            //         if (ix < 20) {
            //             guilds.push(`\`[${row.count > 9 ? row.count : '0' + row.count}] ${' '.repeat(10 - row.gp.toString().length) + row.gp.toLocaleString()} GP\` - **${row.guildName}**`);
            //         }
            //     });
            //     
            //     const desc = guilds.join('\n');
            //     message.channel.send({embed: {
            //         author: {
            //             name: `Top ${Object.keys(guilds).length}/${results[0].length} Guilds`
            //         },
            //         description: desc,
            //         fields: [
            //             {
            //                 name: message.language.get('COMMAND_GUILDS_MORE_INFO'),
            //                 value: '```;guilds <mention|allyCode|guildName>```'
            //             }
            //         ]
            //     }});
            // });
        } else {    // Else they want a specific guild
            let acType = true;
            
            // Get the user's ally code from the message or psql db
            if (userID === "me" || client.isUserID(userID) || client.isAllyCode(userID)) {
                userID = await client.getAllyCode(message, userID);
                if (!userID.length) {
                    return message.channel.send('I cannot find a guild for that user.');
                }
                userID = userID[0];
            } else {
                // Or, if they don't have one of those, try getting the guild by name
                userID += args.length ? ' ' + args.join(' ') : '';
                acType = false;
            }

            if (acType) {
                try {
                    const player = await client.swgohAPI.getPlayer(userID, 'ENG_US', 6);
                    userID = player.guildName;
                } catch (e) {
                    console.error(e);
                }
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
            const sortedGuild = guild.sort((p, c) => p.gpFull > c.gpFull ? 1 : -1);

            let totalGP = 0; 
            const users = [];
            sortedGuild.forEach(p => {
                totalGP += parseInt(p.gpFull);
                users.push(`\`[${' '.repeat(9 - p.gpFull.toLocaleString().length) + p.gpFull.toLocaleString()} GP]\` - **${p.name}**`);
            });
            const averageGP = Math.floor(totalGP/users.length);
            message.channel.send({embed: {
                author: {
                    name: `${users.length} Players in ${userID}`
                },
                description: options.flags.min ? '' : users.join('\n'),
                fields: [
                    {
                        name: 'Registered Guild GP',
                        value: '```Total GP: ' + totalGP.toLocaleString() + '\nAverage : ' + averageGP.toLocaleString() + '```'
                    }
                ]
            }});
        }
    }
}

module.exports = Guilds;

