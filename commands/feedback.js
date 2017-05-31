exports.run = (client, message, args) => {
    const feedback = args.join(" ");
    // client.users.get("124579977474736129").send(feedback);
    client.channels.get("319362969374949387").send(feedback);
};

exports.conf = {
    enabled: true,
    guildOnly: false,
    aliases: ['feed'],
    permLevel: 0
};

exports.help = {
    name: 'feedback',
    description: 'Send feedback or suggestions for the bot.',
    usage: 'feedback [message]'
};
