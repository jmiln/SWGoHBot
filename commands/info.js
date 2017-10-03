exports.run = (client, message) => {

    message.channel.send(`**### INFORMATION ###** \n**Links**\nJoin the bot support server here \n<http://swgohbot.com/server>\nInvite the bot with this link\n<http://swgohbot.com/invite>`);//\n\n**Recent Changes**\n${changes.slice(Math.max(changes.length - 4, 1)).join('\n')}`);
};

exports.conf = {
    enabled: true,
    guildOnly: false,
    aliases: [],
    permLevel: 0
};

exports.help = {
    name: 'info',
    category: 'Misc',
    description: 'Shows useful links pertaining to the bot.',
    usage: 'info',
    example: `;info`,
    extended: `\`\`\`asciidoc
No extended help for this command.
    \`\`\``
};
