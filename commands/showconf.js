const PersistentCollection = require("djs-collection-persistent");
// const settings = require('../settings.json');
const defaultSettings = require('../data/defaultGuildSettings.json');


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
        let guildConf = {};
        // const defaultSettings = settings.defaultSettings;

        for(val in defaultSettings) {
            guildConf[val] = defaultSettings[val];
        }
        guildSettings.set(message.guild.id, guildConf);

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
    permLevel: 3,
    type: 'admin'
};

exports.help = {
    name: 'showconf',
    description: 'Shows the current configs for your server.',
    usage: 'showconf'
};

