exports.run = function (client, message, args) {
    let messagecount = parseInt(args.join(' '));
    if(!message.channel.permissionsFor(client.user).has('MANAGE_MESSAGES')) {
        console.log("Bot does not have the right permisions");
        return;
    }
    if (messagecount > 1 && messagecount <= 100) {
        message.channel.fetchMessages({
            limit: messagecount
        }).then(messages => message.channel.bulkDelete(messages)).catch(console.error);
        console.log(message.author.username + " has purged " + messagecount + " messages.");
    } else {
        console.log("You can ony delete between 2 and 100 messages, try again");
    }
};

exports.conf = {
    enabled: true,
    guildOnly: false,
    aliases: ['p'],
    permLevel: 2
};

exports.help = {
    name: 'purge',
    description: 'Purges X amount of messages from a given channel.',
    usage: 'purge <number>'
};
