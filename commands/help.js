const Command = require('../base/Command');

class Help extends Command {
    constructor(client) {
        super(client, {
            name: 'help',
            aliases: ['h'],
            category: 'Misc',
            permissions: ['EMBED_LINKS']
        });
    }



    run(client, message, args, options) {
        const level = options.level;
        const config = client.config;

        const help = {};

        if (!args[0]) { // Show the list of commands
            const commandList = client.commands.filter(c => c.conf.permLevel <= level && !c.conf.hidden);
            const longest = commandList.keyArray().reduce((long, str) => Math.max(long, str.length), 0);

            let output = message.language.get('COMMAND_HELP_HEADER', config.prefix);

            commandList.forEach(c => {
                const cat = c.help.category.toProperCase();
                // If the categry isn't there, then make it
                if (!help[cat]) {
                    help[cat] = `${client.config.prefix}${c.help.name}${" ".repeat(longest - c.help.name.length)} :: ${message.language.get(`COMMAND_${c.help.name.toUpperCase()}_HELP`).description}\n`;
                } else {
                    help[cat] += `${client.config.prefix}${c.help.name}${" ".repeat(longest - c.help.name.length)} :: ${message.language.get(`COMMAND_${c.help.name.toUpperCase()}_HELP`).description}\n`;
                }
            });
            const sortedCat = Object.keys(help).sort((p, c) => p > c ? 1 : -1);
            sortedCat.forEach(category => {
                output += `\n== ${category} ==\n${help[category]}`;
            });
            message.channel.send(output, { code: 'asciidoc', split: true });
        } else { // Show the help for a specific command
            let command;
            if (client.commands.has(args[0])) {
                command = client.commands.get(args[0]);
            } else if (client.aliases.has(args[0])) {
                command = client.commands.get(client.aliases.get(args[0]));
            } else {
                return message.channel.send(message.language.get('COMMAND_RELOAD_INVALID_CMD', args[0]));
            }
            
            client.helpOut(message, command);
        }
    }
}

module.exports = Help;
