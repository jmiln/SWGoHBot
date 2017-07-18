exports.run = (client, message) => {
    message.author.send("Use the link below to invite me to your server!\n" + "https://discordapp.com/oauth2/authorize?permissions=67624000&scope=bot&client_id=315739499932024834");
};

exports.conf = {
    enabled: true,
    guildOnly: false,
    aliases: ['inv'],
    permLevel: 0,
    type: 'other'
};

exports.help = {
    name: 'invite',
    description: 'Sends the link to invite the bot to your server.',
    usage: 'invite'
};
