exports.run = (client, message, args) => {
    let command;
    if (client.commands.has(args[0])) {
        command = args[0];
    } else if (client.aliases.has(args[0])) {
        command = client.aliases.get(args[0]);
    }
    if (!command) {
        return message.channel.send(message.language.COMMAND_RELOAD_INVALID_CMD(args[0])).then(msg => msg.delete(4000)).catch(console.error);
    } else {
        message.channel.send(`Reloading: ${command}`)
            .then(m => {
                client.reload(command)
                    .then(() => {
                        m.edit(message.language.COMMAND_RELOAD_SUCCESS(command));
                    })
                    .catch(e => {
                        m.edit(message.language.COMMAND_RELOAD_FAILURE(command, e.stack));
                    });
            });
    }
};

exports.conf = {
    enabled: true,
    guildOnly: false,
    aliases: ['r'],
    permLevel: 10
};

exports.help = {
    name: 'reload',
    category: 'Dev',
    description: 'Reloads the command file, if it\'s been updated or modified.',
    usage: 'reload <command>',
    example: `;reload help`,
    extended: `\`\`\`asciidoc
command     :: The command you're wanting to reload.
    \`\`\``
};
