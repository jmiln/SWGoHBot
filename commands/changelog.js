exports.run = (client, message) => {
    let logMsg = message.content.split(' ');
    logMsg.splice(0, 1);
    logMsg = logMsg.join(' ');
    console.log(logMsg);

    if (client.config.changelog.sendChangelogs) {
        client.channels
            .get(client.config.changelog.changelogChannel)
            .send(`**[${client.myTime()}]**\n${logMsg}`);
    }

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
    description: 'Adds a changelog to the db, and sends it to the changelog channel',
    usage: 'changelog <message>',
    example: ``,
    extended: `\`\`\`asciidoc
Nothing to see here, move along
    \`\`\``
};
