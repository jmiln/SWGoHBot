exports.run = (client, message, args) => {
    if(args.length > 0) {
        let name = String(args.join(' '));

        message.guild.member(client.user).setNickname(name);
    } else {
        message.guild.member(client.user).setNickname("");
    }
};

exports.conf = {
    enabled: true,
    guildOnly: false,
    aliases: ['nick'],
    permLevel: 4,
    type: "mod"
};

exports.help = {
    name: 'nickname',
    description: 'Changes the bot\'s nickname on the server',
    usage: 'nickname [name]'
};
