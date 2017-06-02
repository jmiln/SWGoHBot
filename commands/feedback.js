const settings = require('../settings.json');

exports.run = (client, message, args) => {
    const feedback = args.join(" ");
    if(feedback !== "") {  // If there are args/ if they left a message
        client.channels.get("319362969374949387").send(message.author + "(" + message.author.username + ") suggests: \n" + feedback);
        message.channel.send(`Thanks for your feedback ${message.author.username}`);
    } else {    // If they left no message, grumble at em
        message.reply("Usage is `" + settings.prefix + "feedback [message]`, and requires a message");
    }
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
