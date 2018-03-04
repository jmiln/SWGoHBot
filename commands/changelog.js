exports.run = (client, message) => {
    let logMsg = message.content.split(' ');
    logMsg.splice(0, 1);
    logMsg = logMsg.join(' ');

    // If it's set up, send the changelog to a Discord channel
    if (client.config.changelog.sendChangelogs) {
        const clMessage = `[${client.myTime()}]\n${logMsg
                .replace('[Fixed]',   '**[Fixed]**')
                .replace('[Updated]', '**[Updated]**')
                .replace('[Added]',   '**[Added]**')
                .replace('[Removed]', '**[Removed]**')}`;

        client.sendChangelog(clMessage);
    }

    // Adds it to the db with an auto-incrementing ID
    client.changelogs.create({logText: logMsg});
};

exports.conf = {
    enabled: true,
    guildOnly: false,
    aliases: [],
    permLevel: 10
};

exports.help = {
    name: 'changelog',
    category: 'Dev',
    description: 'Adds a changelog to the db, and sends it to the changelog channel\nUse [Updated], [Fixed], [Removed], and [Added] to organize the changes.',
    usage: 'changelog <message>',
    example: '',
    extended: `\`\`\`asciidoc
    \`\`\``
};



