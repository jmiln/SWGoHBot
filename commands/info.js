exports.run = (client, message) => {

    message.channel.send(message.language.COMMAND_INFO_OUTPUT);
};

exports.conf = {
    enabled: true,
    guildOnly: false,
    aliases: ['invite', 'inv'],
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
