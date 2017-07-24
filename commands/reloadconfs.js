const PersistentCollection = require("djs-collection-persistent");
const util = require('util');

exports.run = (client, message, args) => {
    config = client.config;
    const guildSettings = client.guildSettings;
    const defaultSettings = client.defaultSettings;

    if(args[0] === 'all') {  // Reload the configs for all guilds
        const guildList = client.guilds.keyArray();
        guildList.forEach(g => {
            guildConf = guildSettings.get(g);
            if(!guildConf) {
                guildConf = {};
            }
            // message.channel.send(`Settings for **${g}**: \`\`\`${util.inspect(guildConf)}\`\`\``);

            // If the generic guild settings in my settings file has new fields, add em into the other configs
            for(val in defaultSettings) {
                if(!guildConf[val]) {
                    guildConf[val] = defaultSettings[val];
                }
            }
            // message.channel.send(`Settings for **${message.guild.name}** (${message.guild.id}) after: \`\`\`${util.inspect(guildConf)}\`\`\``);
            guildSettings.set(g, guildConf);
        });
    } else {  // Reload the config for the current guild
        guildConf = guildSettings.get(message.guild.id);
        if(!guildConf) {
            guildConf = {};
        }
        message.channel.send(`Settings for **${message.guild.name}** (${message.guild.id}): \`\`\`${util.inspect(guildConf)}\`\`\``);

        // If the generic guild settings in my settings file has new fields, add em into the other configs
        for(val in defaultSettings) {
            if(!guildConf[val]) {
                guildConf[val] = defaultSettings[val];
            }
        }
        message.channel.send(`Settings for **${message.guild.name}** (${message.guild.id}) after: \`\`\`${util.inspect(guildConf)}\`\`\``);
        guildSettings.set(message.guild.id, guildConf);
    }
};

exports.conf = {
    enabled: true,
    guildOnly: false,
    aliases: [],
    permLevel: 10
};

exports.help = {
    name: 'reloadconfs',
    category: 'Dev',
    description: 'Reload the configs for all guilds the bot is in.',
    usage: 'reloadconfs [all]'
};
