const PersistentCollection = require("djs-collection-persistent");
const util = require('util');


exports.run = (client, message, args) => {
    const guildSettings = client.guildSettings;

    const guilds = client.guilds.map((value, key) => `${value} (${key})`).join("\n"); 

    if(args[0]) {
        if(args[0].toLowerCase() === 'guilds') {
            // guildList = "";
            // guildIDs.forEach(g => {
            //     guildList += client.guilds[g] + " (" +g + ")\n";
            // });
            //
            message.channel.send(`Guilds: \`\`\`${guilds}\`\`\``);
            // message.channel.send(`Guilds: \`\`\`${util.inspect(guildIDs)}\`\`\``);
        } else if(args[0].toLowerCase() === 'roles') {
            message.channel.send(`Roles: \`\`\`${util.inspect(message.member.roles)}\`\`\``);
        }

        // message.channel.send(`Settings: \`\`\`${util.inspect(guildSettings.keyArray())}\`\`\``);
        
        // guilds = client.guilds.keyArray();
        // guilds.forEach(guild => {
        //     message.channel.send(`Config for guild ${guild} is \n\`\`\`${util.inspect(guildSettings.get(guild))}\`\`\``);
        // });
    }
};

exports.conf = {
    enabled: true,
    guildOnly: false,
    aliases: [],
    permLevel: 4,
    type: 'owner'
};

exports.help = {
    name: 'list',
    description: 'List stats about the bot.',
    usage: 'list [guilds]'
};

