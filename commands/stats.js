const moment = require("moment");
require("moment-duration-format");

exports.run = (client, message) => {
    const duration = moment.duration(client.uptime).format(" D [days], H [hrs], m [mins], s [secs]");
    message.channel.send(message.language.COMMAND_STATS_OUTPUT((process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2), 
        Math.round(require("os").loadavg()[0]*10000)/100, 
        duration, 
        client.users.size.toLocaleString(),
        client.guilds.size.toLocaleString(),
        client.channels.size.toLocaleString()
    ), {code: "asciidoc"});
};

exports.conf = {
    enabled: true,
    guildOnly: false,
    aliases: [],
    permLevel: 3
};

exports.help = {
    name: 'stats',
    category: 'Admin',
    description: 'Shows the bot\'s stats',
    usage: 'stats',
    example: `;stats`,
    extended: `\`\`\`asciidoc
Shows the current total of users, servers, channels etc.
    \`\`\``
};

