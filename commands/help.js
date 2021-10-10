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

            helpOut(message, command);
        }
        /*  COMMAND HELP OUTPUT
         *  Input the language and the command, and it'll give ya back the embed object to send
         */
        function helpOut(message, command) {
            const language = message.language;
            const help = language.get(`COMMAND_${command.help.name.toUpperCase()}_HELP`);
            if (!help || !help.actions) Bot.logger.error("Broke in helpOut with " + message.content);
            const actions = help.actions ? help.actions.slice() : [];
            let headerString = `**Aliases:** \`${command.conf.aliases.length > 0 ? command.conf.aliases.join(", ") : "No aliases for this command"}\`\n**Description:** ${help.description}\n`;

            // Stick the extra help bit in
            actions.push(language.get("BASE_COMMAND_HELP_HELP", command.help.name.toLowerCase()));
            const actionArr = [];

            actions.forEach(action => {
                const outAct = {};
                const keys = Object.keys(action.args);
                let argString = "";
                if (keys.length > 0) {
                    keys.forEach(key => {
                        argString += `**${key}**  ${action.args[key]}\n`;
                    });
                }
                if (action.action && action.action.length) {
                    outAct.name = action.action;
                    if (action.usage && action.usage.length) {
                        outAct.value = `${action.actionDesc === "" ? "" : action.actionDesc} \n\`\`\`${action.usage}\`\`\`${argString}\n`;
                    } else {
                        outAct.value = `${action.actionDesc === "" ? "" : action.actionDesc} \n${argString}\n`;
                    }
                    actionArr.push(outAct);
                } else {
                    if (action.usage && action.usage.length) {
                        headerString += `\`\`\`${action.usage}\`\`\`${argString}`;
                    } else {
                        headerString += argString;
                    }
                }
            });
            message.channel.send({embeds: [{
                "color": "#605afc",
                "author": {
                    "name": language.get("BASE_COMMAND_HELP_HEADER", command.help.name)
                },
                "description": headerString,
                "fields": actionArr
            }]}).catch((e) => {Bot.logger.error(`Broke in helpOut (${command.help.name}):\n${e}`);});
        }
    }
}

module.exports = Help;
