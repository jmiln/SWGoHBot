var moment = require('moment-timezone');
// var {inspect} = require('util');

exports.run = async (client, message, args, level) => {
    const config = client.config;
    const guildSettings = await client.guildSettings.findOne({where: {guildID: message.guild.id}, attributes: ['adminRole', 'enableWelcome', 'useEmbeds', 'welcomeMessage', 'timezone', 'announceChan', 'useEventPages']});
    const guildConf = guildSettings.dataValues;

    if (guildConf) {
        if (level < this.conf.permLevel) {
            return message.reply(`Sorry, but either you're not an admin, or your server leader has not set up the configs.`).then(msg => msg.delete(4000)).catch(console.error);
        }
        if (!args[0]) return message.reply(`You must select a config option to change.`).then(msg => msg.delete(4000)).catch(console.error);
        const key = args[0].toLowerCase();

        let value = '';

        // The list of commands that don't need another argument
        const noVal = ["help", "announcechan"];

        // If there is no second argument, and it's not one that doesn't need one, return
        if (!args[1] && !noVal.includes(key)) {
            return message.reply(`You must give a value to change that option to.`).then(msg => msg.delete(4000)).catch(console.error);
        } else {
            value = args.slice(1).join(" ");
        }

        const onVar = ["true", "on", "enable"];
        const offVar = ["false", "off", "disable"];

        // Now we can finally change the value. Here we only have strings for values so we won't
        // bother trying to make sure it's the right type and such.
        let boolVar = true;
        switch (key) {
            case "adminrole":
                if (args[1] !== 'add' && args[1] !== 'remove') {
                    return message.reply(`You must use \`add\` or \`remove\`.`).then(msg => msg.delete(4000)).catch(console.error);
                }
                if (!args[2]) {
                    return message.reply(`You must specify a role to ${args[2]}.`).then(msg => msg.delete(4000)).catch(console.error);
                }
                var roleName = args.slice(2).join(' ');

                var roleArray = guildConf["adminRole"];

                if (args[1] === 'add') {
                    var newRole = message.guild.roles.find('name', roleName);
                    if (!newRole) return message.channel.send(`Sorry, but I cannot find the role ${roleName}. Please try again.`).then(msg => msg.delete(4000)).catch(console.error);
                    if (!roleArray.includes(roleName)) {
                        roleArray.push(roleName);
                    } else {
                        return message.channel.send(`Sorry, but ${roleName} is already there.`).then(msg => msg.delete(4000)).catch(console.error);
                    }
                } else if (args[1] === 'remove') {
                    if (roleArray.includes(roleName)) {
                        roleArray.splice(roleArray.indexOf(roleName), 1);
                    } else {
                        return message.channel.send(`Sorry, but ${roleName} is not in your config.`).then(msg => msg.delete(4000)).catch(console.error);
                    }
                }
                client.guildSettings.update({adminRole: roleArray}, {where: {guildID: message.guild.id}});
                return message.channel.send(`The role ${roleName} has been ${args[1] === 'add' ? 'added to' : 'removed from'} your admin roles.`);
            case "enablewelcome":
                if (onVar.includes(value.toLowerCase())) {
                    const newChannel = message.guild.channels.find('name', guildConf['announceChan']);
                    if (!newChannel) {
                        return message.channel.send(`Sorry, but but your announcement channel either isn't set or is no longer valid.\nGo set \`announceChan\` to a valid channel and try again.\``).then(msg => msg.delete(10000)).catch(console.error);
                    }
                    boolVar = true;
                } else if (offVar.includes(value.toLowerCase())) {
                    boolVar = false;
                } else {
                    return message.reply(`Invalid value, try true or false`).then(msg => msg.delete(4000)).catch(console.error);
                }
                client.guildSettings.update({enableWelcome: boolVar}, {where: {guildID: message.guild.id}});
                break;
            case "welcomemessage":
                client.guildSettings.update({welcomeMessage: value}, {where: {guildID: message.guild.id}});
                break;
            case "useembeds":
                if (onVar.includes(value.toLowerCase())) {
                    boolVar = true;
                } else if (offVar.includes(value.toLowerCase())) {
                    boolVar = false;
                } else {
                    return message.reply(`Invalid value, try true or false`).then(msg => msg.delete(4000)).catch(console.error);
                }
                client.guildSettings.update({useEmbeds: boolVar}, {where: {guildID: message.guild.id}});
                break;
            case "timezone":
                if (moment.tz.zone(value)) { // Valid time zone
                    client.guildSettings.update({timezone: value}, {where: {guildID: message.guild.id}});
                } else { // Not so valid
                    return message.reply(`Invalid timezone, look here https://en.wikipedia.org/wiki/List_of_tz_database_time_zones \nand find the one that you need, then enter what it says in the TZ column`).then(msg => msg.delete(10000)).catch(console.error);
                }
                break;
            case "announcechan":
                if (value !== '') {
                    const newChannel = message.guild.channels.find('name', value);
                    if (!newChannel) return message.channel.send(`Sorry, but I cannot find the channel ${value}. Please try again.`).then(msg => msg.delete(4000)).catch(console.error);
                    if (!newChannel.permissionsFor(message.guild.me).has(["SEND_MESSAGES", "READ_MESSAGES"])) return message.channel.send(`Sorry, but I don't have permission to send message there. Please either change the perms, or choose another channel.`);
                    client.guildSettings.update({announceChan: value}, {where: {guildID: message.guild.id}});
                } else {
                    client.guildSettings.update({announceChan: ''}, {where: {guildID: message.guild.id}});
                }
                break;
            case "useeventpages": 
                if (onVar.includes(value.toLowerCase())) {
                    boolVar = true;
                } else if (offVar.includes(value.toLowerCase())) {
                    boolVar = false;
                } else {
                    return message.reply(`Invalid value, try true or false`).then(msg => msg.delete(4000)).catch(console.error);
                }
                client.guildSettings.update({useEventPages: boolVar}, {where: {guildID: message.guild.id}});
                break;
            case "help":
                return message.channel.send(`**Extended help for ${this.help.name}** \n**Usage**: ${this.help.usage} \n${this.help.extended}`);
            default:
                return message.reply(`This key is not in the configuration. Look in "${config.prefix}showconf", or "${config.prefix}setconf help" for a list`).then(msg => msg.delete(4000)).catch(console.error);
        }

        // We can confirm everything's done to the client.
        message.channel.send(`Guild configuration item ${key} has been changed to:\n\`${value}\``);
    } else {
        message.channel.send(`No guild settings found.`).then(msg => msg.delete(4000)).catch(console.error);
    }
};

exports.conf = {
    enabled: true,
    guildOnly: true,
    aliases: ['setconfig'],
    permLevel: 3
};

exports.help = {
    name: 'setconf',
    category: 'Admin',
    description: 'Used to set the bot\'s config settings.',
    usage: 'setconf <help|key> [value]',
    extended: `\`\`\`asciidoc
adminRole      :: The role that you want to be able to modify bot settings or set up events.
                  'add' Add a role to the list
                  'remove' Remove a role from the list
enableWelcome  :: Toggles the welcome message on/ off.
welcomeMessage :: The welcome message to send it you have it enabled.
                  '{{user}}' gets replaced with the new user's name.
                  '{{userMention}}' makes it mention the new user there.
useEmbeds      :: Toggles whether or not to use embeds for the mods output.
timezone       :: Sets the timezone that you want all time related commands to use. Look here if you need a list https://goo.gl/Vqwe49.
announceChan   :: Sets the name of your announcements channel for events etc. Make sure it has permission to send them there.
useEventPages  :: Sets it so event view shows in pages, rather than super spammy.
help           :: Shows this help message.
\`\`\``,
    example: 'setconf adminRole Admin\nOr "setconf help" for more info'
};
