exports.run = (client, message, args) => {
    let name = String(args.join(' '));

    message.guild.member(client.user).setNickname(name);
};

exports.conf = {
    enabled: true,
    guildOnly: false,
    aliases: ['nick'],
    permLevel: 4
};

exports.help = {
    name: 'nickname',
    description: 'Changes the bot\'s nickname on the server',
    usage: 'nickname [name]'
};
