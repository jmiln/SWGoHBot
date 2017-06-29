const settings = require('../settings.json');

exports.run = (client, message, params) => {

    guildSettings = client.guildSettings;
    guildConf = guildSettings.get(message.guild.id);

    if (!params[0]) {  // Show the list of commands
        const commandNames = Array.from(client.commands.keys());
        const longest = commandNames.reduce((long, str) => Math.max(long, str.length), 0);

        commands = client.commands.array();
        helpString = "= Command List =\n\n[Use " + settings.prefix + "help <commandname> for details]\n";
        
        starwarsString = `= Star Wars Commands =\n`;
        otherString = `= Misc Commands =\n`;
        adminString = `= Admin Commands =\n`;
        
        commands.forEach(command => {
            type = command.conf.type;

            switch(type) {
                case 'starwars':
                    starwarsString += `${settings.prefix}${pad('          ', command.help.name, false)} :: ${command.help.description}\n`; 
                    break;
                case 'other':
                    otherString += `${settings.prefix}${pad('          ', command.help.name, false)} :: ${command.help.description}\n`; 
                    break;
                case 'admin':
                    adminString += `${settings.prefix}${pad('          ', command.help.name, false)} :: ${command.help.description}\n`; 
                    break;
            }
        });

        if(guildConf) {
            const adminRole = message.guild.roles.find("name", guildConf.adminRole);
            if(message.author.id === message.guild.owner.id) {
                helpString += `\n${starwarsString}\n${otherString}\n${adminString}`;
            } else if(adminRole && message.member.has(adminRole.id)) {  // If the author does not have the admin role
                helpString += `\n${starwarsString}\n${otherString}\n${adminString}`;
            } else {
                helpString += `\n${starwarsString}\n${otherString}`;
            }
        } else {
            if(message.author.id === message.guild.owner.id) {
                helpString += `\n${starwarsString}\n${otherString}\n${adminString}`;
            } else {
                helpString += `\n${starwarsString}\n${otherString}`;
            }
        }

        message.channel.send(helpString, {code:'asciidoc'});
    } else {  // Show the help for a specific command
        let command = params[0];
        if (client.commands.has(command)) {
            command = client.commands.get(command);
            message.channel.send("= " + command.help.name + " = \n" + command.help.description + "\nUsage:   " + settings.prefix + command.help.usage, {code:'asciidoc'});
        }
    }
};

function pad(pad, str, padLeft) {
  if (typeof str === 'undefined') 
    return pad;
  if (padLeft) {
    return (pad + str).slice(-pad.length);
  } else {
    return (str + pad).substring(0, pad.length);
  }
}

exports.conf = {
    enabled: true,
    guildOnly: false,
    aliases: ['h', 'halp'],
    permLevel: 0,
    type: 'other'
};

exports.help = {
    name: 'help',
    description: 'Displays info about available commands.',
    usage: 'help [command]'
};
