exports.run = (client, message, args, level) => {
    const config = client.config;

    const help = {};

    if (!args[0]) { // Show the list of commands
        const commandList = client.commands.filter(c => c.conf.permLevel <= level);
        const longest = commandList.keyArray().reduce((long, str) => Math.max(long, str.length), 0);

        let output = `= Command List =\n\n[Use ${client.config.prefix}help <commandname> for details]\n`;

        commandList.forEach(c => {
            const cat = c.help.category.toProperCase();
            // If the categry isn't there, then make it
            if (!help[cat]) {
                help[cat] = `${client.config.prefix}${c.help.name}${" ".repeat(longest - c.help.name.length)} :: ${c.help.description}\n`;
            } else {
                help[cat] += `${client.config.prefix}${c.help.name}${" ".repeat(longest - c.help.name.length)} :: ${c.help.description}\n`;
            }
        });
        const sortedCat = Object.keys(help).sort((p, c) => p > c ? 1 : -1);
        sortedCat.forEach(category => {
            output += `\n== ${category} ==\n${help[category]}`;
        });
        message.channel.send(output, { code: "asciidoc" });
    } else { // Show the help for a specific command
        let command = args[0];
        if (client.commands.has(command)) {
            command = client.commands.get(command);
            message.channel.send(`= ${command.help.name} = \n${command.help.description} \nAliases:: ${command.conf.aliases.join(", ")}\nUsage:: ${config.prefix}${command.help.usage}`, { code: 'asciidoc' });
        }
    }
};

exports.conf = {
    enabled: true,
    guildOnly: false,
    aliases: ['h', 'halp'],
    permLevel: 0
};

exports.help = {
    name: 'help',
    category: 'Misc',
    description: 'Displays info about available commands.',
    usage: 'help [command]',
    example: `;help help`,
    extended: `\`\`\`asciidoc
command     :: The command you want to look up info on.
    \`\`\``
};
