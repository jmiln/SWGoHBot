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
        
        // const lang = message.guildSettings.swgohLanguage;
            
        // Shows your guild's total GP, average GP, and a list of your members
        // Not trying to get any specific guild, show em the top ones
        if (!userID) {
            userID = 'me';
        } 
        
        const msg = await message.channel.send("Please wait while I update your guild's info.");

        // Get the user's ally code from the message or psql db
        if (userID === "me" || client.isUserID(userID) || client.isAllyCode(userID)) {
            userID = await client.getAllyCode(message, userID);
            if (!userID.length) {
                return message.channel.send('I cannot find a guild for that user.');
            }
            userID = userID[0];
        } else {
            // Or, if they don't have one of those, try getting the guild by name
            // userID += args.length ? ' ' + args.join(' ') : '';
            // acType = false;
            return msg.edit("I currently do not support looking up guilds by name, please use an ally code, or mention someone that has registered.");
        }

        let guild = null;
        try {
            // guild = await client.swgohAPI.fetchGuild(userID, 'details', lang);
            guild = await client.swgohAPI.guild(userID);
        } catch (e) {
            console.log('ERROR: ' + e);
        }

        if (!guild || !guild.roster.length) {
            return msg.edit('I cannot find any users for that guild. \nPlease make sure you have spelled the name correctly, and that the capitalization is correct.');
        }
        const sortedGuild = guild.roster.sort((p, c) => c.gp - p.gp);

        const users = [];
        sortedGuild.forEach(p => {
            users.push(`\`[${' '.repeat(9 - p.gp.toLocaleString().length) + p.gp.toLocaleString()} GP]\` - **${p.name}**`);
        });
        return msg.edit({embed: {
            author: {
                name: `${users.length} Players in ${guild.name}`
            },
            description: options.flags.min ? '' : users.join('\n'),
            fields: [
                {
                    name: 'Registered Guild GP',
                    value: '```Total GP: ' + guild.gp.toLocaleString() + '\nAverage : ' + Math.floor(guild.gp/users.length).toLocaleString() + '```'
                }
            ]
        }});
    }
}

module.exports = Guilds;

