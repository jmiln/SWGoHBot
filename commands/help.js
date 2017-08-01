exports.run = (client, message, args, level) => {
    const config = client.config; 

    if (!args[0]) {  // Show the list of commands
        const myCommands = client.commands.filter(c=>c.conf.permLevel <= level);
		const commandNames = myCommands.keyArray();
        const longest = commandNames.reduce((long, str) => Math.max(long, str.length), 0);

        commands = client.commands.array();
        helpString = "= Command List =\n\n[Use " + config.prefix + "help <commandname> for details]\n";

		let currentCategory = "";
		let output = `= Command List =\n\n[Use ${client.config.prefix}help <commandname> for details]\n`;
		const sorted = myCommands.sort((p, c) => p.help.category > c.help.category ? 1 : -1);
		sorted.forEach( c => {
			const cat = c.help.category.toProperCase();
			if(currentCategory !== cat) {
				output += `\n== ${cat} ==\n`;
				currentCategory = cat;
			}
			output += `${client.config.prefix}${c.help.name}${" ".repeat(longest - c.help.name.length)} :: ${c.help.description}\n`;
		});
		message.channel.send(output, {code:"asciidoc"});

    } else {  // Show the help for a specific command
        let command = args[0];
        if (client.commands.has(command)) {
            command = client.commands.get(command);
            message.channel.send(`= ${command.help.name} = \n${command.help.description} \nAliases:: ${command.conf.aliases.join(", ")}\nUsage:: ${config.prefix}${command.help.usage}`, {code:'asciidoc'});
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
    usage: 'help [command]'
};
