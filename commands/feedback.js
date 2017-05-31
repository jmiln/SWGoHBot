exports.run = (client, message, args) => {
    const feedback = args.join(" ");
    client.channels.get("319362969374949387").send(message.author + " suggests: " + feedback);
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
