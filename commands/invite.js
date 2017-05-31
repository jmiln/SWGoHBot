exports.run = (client, message) => {
    message.author.send("https://discordapp.com/oauth2/authorize?permissions=67624000&scope=bot&client_id=315739499932024834");
};

exports.conf = {
    enabled: true,
    guildOnly: false,
    aliases: ['inv'],
    permLevel: 0
};

exports.help = {
    name: 'invite',
    description: 'Sends the link to invite the bot',
    usage: 'invite'
};
