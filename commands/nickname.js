exports.run = (client, message, args) => {
    if (args.length > 0) {
        const  name = String(args.join(' '));
        message.guild.member(client.user).setNickname(name);
    } else {
        message.guild.member(client.user).setNickname("");
    }
};

exports.conf = {
    enabled: true,
    guildOnly: false,
    aliases: ['nick'],
    permLevel: 3
};

exports.help = {
    name: 'nickname',
    category: 'Admin',
    description: 'Changes the bot\'s nickname on the server',
    usage: 'nickname [name]'
};
