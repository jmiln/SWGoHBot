exports.run = (client, message) => {
    message.author.send("Use the link below for an invite to the bot's server!\n" + "https://discord.gg/FfwGvhr");
};

exports.conf = {
    enabled: true,
    guildOnly: false,
    aliases: [],
    permLevel: 0
};

exports.help = {
    name: 'changelog',
    description: 'Sends a link to join the test server where the changelog and announcements about the bot are.',
    usage: 'changelog'
};
