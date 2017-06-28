const settings = require('../settings.json');

exports.run = (client, message, args) => {
    const feedback = args.join(" ");
    if(feedback !== "") {  // If there are args/ if they left a message
        client.channels.get("319362969374949387").send({embed: {
            color: 3447003,
            author: {
                name: `${message.author.username} (${message.author.id})`,
                icon_url: message.member.user.avatarURL
            },
            title: `${message.guild.name} #${message.channel.name}`,
            url: '',
            description: feedback
        }});
        message.channel.send(`Thanks for your feedback ${message.author.username}. \nIf you're interested in seeing what's going on with the bot, you're welcome to join \`https://discord.gg/FfwGvhr\`, where I will be posting changelogs and such.`);
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
