const settings = require('../settings.json');

exports.run = (client, message, params) => {
    if (!params[0]) {
        const commandNames = Array.from(client.commands.keys());
        const longest = commandNames.reduce((long, str) => Math.max(long, str.length), 0);

        commands = client.commands.array();
        helpString = "= Command List =\n\n[Use " + settings.prefix + "help <commandname> for details]\n";
        for(ix = 0; ix < commands.length; ix++) {
            if(commands[ix].conf.permLevel === 0) {  // Filer out the moderation commands for normal users
                helpString += "\n" + settings.prefix + commands[ix].help.name;
            }
        }
        message.channel.send(helpString, {code:'asciidoc'});
    } else {
        let command = params[0];
        if (client.commands.has(command)) {
            command = client.commands.get(command);
            message.channel.send("= " + command.help.name + " = \n" + command.help.description + "\nUsage:   " + settings.prefix + command.help.usage, {code:'asciidoc'});
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
    description: 'Displays all the available commands for your permission level.',
    usage: 'help [command]'
};
