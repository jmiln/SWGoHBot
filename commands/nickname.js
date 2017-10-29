exports.run = (client, message, args) => {
    try {
        if (args.length > 0) {
            const  name = String(args.join(' '));
            message.guild.member(client.user).setNickname(name);
        } else {
            message.guild.member(client.user).setNickname("");
        }
    } catch (e) {
        client.log('Broke', 'I broke while trying to set a nickname');
    }
};

exports.conf = {
    enabled: true,
    guildOnly: true,
    aliases: ['nick'],
    permLevel: 3
};

exports.help = {
    name: 'nickname',
    category: 'Admin',
    description: 'Changes the bot\'s nickname on the server',
    usage: 'nickname <name>',
    example: `;nickname swgohBot`,
    extended: `\`\`\`asciidoc
name    :: The name you're wanting to change it to.
    \`\`\``
};
