exports.run = (client, message, args) => {
    const charCount = client.characters.length;
    const MAX_CHARACTERS = 5;
    let count = 1;

    const charOut = [];

    if (args > 0) {
        count = parseInt(args[0]);
        if (isNaN(count) || count < 0 || count > MAX_CHARACTERS) {
            return message.channel.send(`Sorry, but you need a number from 1-${MAX_CHARACTERS} there.`);
        }
    }

    for (let ix = 0; ix < count; ix++) {
        const newChar = client.characters[Math.floor(Math.random()*charCount)].name;
        if (charOut.includes(newChar)) {    // If it's already picked a character, don't let it pick them again
            ix--;
        } else {
            charOut.push(newChar);
        }
    }

    message.channel.send('```' + charOut.join('\n') + '```');
};

exports.conf = {
    enabled: true,
    guildOnly: false,
    aliases: ['random', 'rand'],
    permLevel: 0
};

exports.help = {
    name: 'randomchar',
    category: 'Star Wars',
    description: 'Picks up to 5 random characters to form a squad.',
    usage: 'randomchar [numberOfChars]',
    example: `;randomchar 5`,
    extended: `\`\`\`asciidoc
No extended help for this command.
    \`\`\``
};
