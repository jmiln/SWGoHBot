const Discord = require("discord.js");
const moment = require("moment");
require("moment-duration-format");
const os = require("os");

exports.run = (client, message, args) => {
    const duration = moment.duration(client.uptime).format(" D [days], H [hrs], m [mins], s [secs]");
    message.channel.send(`= STATISTICS =

• Mem Usage  :: ${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)} MB
• CPU Load   :: ${Math.round(require("os").loadavg()[0]*10000)/100}%
• Uptime     :: ${duration}
• Users      :: ${client.guilds.reduce((a, b) => a + b.memberCount, 0).toLocaleString()}
• Servers    :: ${client.guilds.size.toLocaleString()}
• Channels   :: ${client.channels.size.toLocaleString()}
• Discord.js :: ${Discord.version}
• Node.js    :: ${process.version}
• OS         :: ${os.platform()} v${os.release()}`, {code: "asciidoc"});
};

exports.conf = {
    enabled: true,
    guildOnly: false,
    aliases: [],
    permLevel: 4,
    type: 'owner'
};

exports.help = {
    name: 'stats',
    description: 'Shows the bot\'s stats',
    usage: 'stats'
};

