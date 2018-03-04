exports.run = (client, message) => {
    message.channel.send(message.language.COMMAND_MODSETS_OUTPUT, {code: 'md'});
};

exports.conf = {
    enabled: true,
    guildOnly: false,
    aliases: [],
    permLevel: 0
};

exports.help = {
    name: 'modsets',
    category: "Star Wars",
    description: 'Shows how many of each kind of mod you need for a set.',
    usage: 'modsets',
    example: `;modsets`,
    extended: `\`\`\`asciidoc
No extended help for this command.
    \`\`\``
};

