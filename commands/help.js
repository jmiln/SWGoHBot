const Command = require("../base/Command");

class Help extends Command {
    constructor(Bot) {
        super(Bot, {
            name: "help",
            aliases: ["h"],
            category: "Misc",
            permissions: ["EMBED_LINKS"]
        });
    }

    run(Bot, message, args, options) {
        const level = options.level;
        const client = message.client;

        const help = {};

        if (!args[0]) { // Show the list of commands
            const commandList = client.commands.filter(c => c.conf.permLevel <= level && !c.conf.hidden);
            const longest = [...commandList.keys()].reduce((long, str) => Math.max(long, str.length), 0);

            let output = message.language.get("COMMAND_HELP_HEADER", Bot.config.prefix);

            commandList.forEach(c => {
                const cat = Bot.toProperCase(c.help.category);
                // If the categry isn't there, then make it
                if (!help[cat]) {
                    help[cat] = `${Bot.config.prefix}${c.help.name}${" ".repeat(longest - c.help.name.length)} :: ${message.language.get(`COMMAND_${c.help.name.toUpperCase()}_HELP`).description}\n`;
                } else {
                    help[cat] += `${Bot.config.prefix}${c.help.name}${" ".repeat(longest - c.help.name.length)} :: ${message.language.get(`COMMAND_${c.help.name.toUpperCase()}_HELP`).description}\n`;
                }
            });
            const sortedCat = Object.keys(help).sort((p, c) => p > c ? 1 : -1);
            sortedCat.forEach(category => {
                output += `\n== ${category} ==\n${help[category]}`;
            });
            const chunkedMsg = Bot.msgArray(output.split("\n"));
            for (const chunk of chunkedMsg) {
                message.channel.send({content: Bot.codeBlock(chunk, "asciidoc")});
            }
        } else { // Show the help for a specific command
            let command;
            if (client.commands.has(args[0])) {
                command = client.commands.get(args[0]);
            } else if (client.aliases.has(args[0])) {
                command = client.commands.get(client.aliases.get(args[0]));
            } else {
                return super.error(message, message.language.get("COMMAND_RELOAD_INVALID_CMD", args[0]));
            }

            Bot.helpOut(message, command);
        }
    }
}

module.exports = Help;
