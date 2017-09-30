const util = require('util');

exports.run = (client, message) => {

    const guildConf = message.guildSettings;

    var array = [];
    if (guildConf) {
        for (var key in guildConf) {
            array.push(`* ${key}: ${util.inspect(guildConf[key])}`);
        }
        var configKeys = array.join('\n');
        return message.channel.send(`The following is this server's current configuration: \`\`\`${configKeys}\`\`\``);
    } else {
        message.guildSettings.set(message.guild.id, client.config.defaultSettings);

        for (key in guildConf) {
            array.push("* " + key + ": " + guildConf[key]);
        }
        configKeys = array.join('\n');
        return message.channel.send(`Here's your server's new configuration: \`\`\`${configKeys}\`\`\``);
    }
};

exports.conf = {
    enabled: true,
    guildOnly: true,
    aliases: ['showconfs', 'showconfig', 'showconfigs'],
    permLevel: 3
};

exports.help = {
    name: 'showconf',
    category: 'Admin',
    description: 'Shows the current configs for your server.',
    usage: 'showconf',
    example: `;showconf`,
    extended: `\`\`\`asciidoc
    \`\`\``
};

