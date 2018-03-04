exports.run = (client, message, args) => {
    const charCount = client.characters.length;
    const MAX_CHARACTERS = 5;
    let count;

    const charOut = [];

    if (args.length > 0) {
        count = parseInt(args[0]);
        if (isNaN(count) || count < 1 || count > MAX_CHARACTERS) {
            return message.channel.send(message.language.COMMAND_RANDOMCHAR_INVALID_NUM(MAX_CHARACTERS));
        }
    } else {
        count = 1;
    }

    for (let ix = 0; ix < count; ix++) {
        const newIndex = Math.floor(Math.random()*charCount);
        const newChar = client.characters[newIndex].name;
        if (charOut.includes(newChar)) {    // If it's already picked a character, don't let it pick them again
            ix--;
        } else {    // If it's already picked a character, don't let it pick them again
            charOut.push(newChar);
        }
    }
    const charString = charOut.join('\n');

    message.channel.send('```\n' + charString + '```');
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

