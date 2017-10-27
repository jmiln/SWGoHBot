const util = require('util');

exports.run = async (client, message) => {
    const guildConf = await client.guildSettings.findOne({where: {guildID: message.guild.id}, attributes: ['adminRole', 'enableWelcome', 'useEmbeds', 'welcomeMessage', 'timezone', 'announceChan', 'useEventPages']});

    var array = [];
    if (guildConf) {
        for (var key in guildConf.dataValues) {
            array.push(`* ${key}: ${util.inspect(guildConf[key])}`);
        }
        var configKeys = array.join('\n');
        return message.channel.send(`The following is this server's current configuration: \`\`\`${configKeys}\`\`\``);
    } else {
        console.log('Something broke in showconf');
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
No extended help for this command.
    \`\`\``
};

