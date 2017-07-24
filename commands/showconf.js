exports.run = (client, message, args) => {
    const guildSettings = client.guildSettings;

    if(!message.guild) return message.reply(`Sorry, something went wrong, please try again`);

    const guildConf = guildSettings.get(message.guild.id);

    if(guildConf) {
        var array = [];
        for(key in guildConf) {
            array.push("* " + key + ": " + guildConf[key]);
        }
        configKeys = array.join('\n');
        message.channel.send(`The following are the server's current configuration: \`\`\`${configKeys}\`\`\``);
    } else {
        guildSettings.set(message.guild.id, client.config.defaultSettings);

        var array = [];
        for(key in guildConf) {
            array.push("* " + key + ": " + guildConf[key]);
        }
        configKeys = array.join('\n');
        message.channel.send(`Here's your server's new configuration: \`\`\`${configKeys}\`\`\``);
    }
};

exports.conf = {
    enabled: true,
    guildOnly: false,
    aliases: ['showconfs', 'showconfig', 'showconfigs'],
    permLevel: 3
};

exports.help = {
    name: 'showconf',
    category: 'Admin',
    description: 'Shows the current configs for your server.',
    usage: 'showconf'
};

