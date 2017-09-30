exports.run = (client, message) => {
    message.channel.send(`* Critical Chance:  2\n* Critical Damage:  4\n* Defense:  2\n* Health:   2\n* Offense:  4\n* Potency:  2\n* Speed:    4\n* Tenacity: 2`, {code: 'md'});
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
    \`\`\``
};
