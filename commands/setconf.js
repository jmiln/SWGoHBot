var moment = require('moment-timezone');

exports.run = (client, message, args) => {
    const config = client.config;
    const guildSettings = client.guildSettings;

    if (!message.guild) return message.reply(`Sorry, something went wrong, please try again`);

    const guildConf = guildSettings.get(message.guild.id);

    if (guildConf) {
        if (message.author.id !== message.guild.owner.id) {
            if (!message.member.roles.has(guildConf["adminRole"])) {
                return message.reply(`Sorry, but either you're not an admin, or your server leader has not set up the configs.`);
            }
        }
        if (!args[0]) return message.reply(`You must select a config option to change.`);
        const key = args[0].toLowerCase();

        let value = '';

        // The list of commands that don't need another argument
        const noVal = ["help", "announcechan"];

        // If there is no second argument, and it's not one that doesn't need one, return
        if (!args[1] && !noVal.includes(key)) {
            return message.reply(`You must give a value to change that option to.`);
        } else {
            value = args.splice(1).join(" ");
        }

        const onVar = ["true", "on", "enable"];
        const offVar = ["false", "off", "disable"];

        // Now we can finally change the value. Here we only have strings for values so we won't
        // bother trying to make sure it's the right type and such. 
        switch (key) {
            case "adminrole":
                if (!args[2] || (args[2] !== 'add' && args[2] !== 'remove')) {
                    return message.reply(`You must use \`add\` or \`remove\`.`);
                }
                if (!args[3]) {
                    return message.reply(`You must specify a role to ${args[2]}.`);
                }
                var roleName = args[3];

                var roleArray = guildConf["adminRole"];
                if (args[2] === 'add') {
                    var newRole = message.guild.roles.find('name', roleName);
                    if (!newRole) return message.channel.send(`Sorry, but I cannot find the role ${roleName}. Please try again.`);
                    if (!roleArray.includes(roleName)) {
                        guildConf["adminRole"] = roleName;
                    } else {
                        return message.channel.send(`Sorry, but ${roleName} is already there.`);
                    }
                } else if (args[2] === 'remove') {
                    if (roleArray.includes(roleName)) {
                        roleArray.splice(roleArray.indexOf(roleName), 1);
                    }
                }
                break;
            case "enablewelcome":
                if (onVar.includes(value.toLowerCase())) {
                    guildConf["enableWelcome"] = true;
                } else if (offVar.includes(value.toLowerCase())) {
                    guildConf["enableWelcome"] = false;
                } else {
                    return message.reply(`Invalid value, try true or false`);
                }
                break;
            case "welcomemessage":
                guildConf["welcomeMessage"] = value;
                break;
            case "useembeds":
                if (onVar.includes(value.toLowerCase())) {
                    guildConf["useEmbeds"] = true;
                } else if (offVar.includes(value.toLowerCase())) {
                    guildConf["useEmbeds"] = false;
                } else {
                    return message.reply(`Invalid value, try true or false`);
                }
                break;
            case "timezone":
                if (moment.tz.zone(value)) { // Valid time zone
                    guildConf["timezone"] = value;
                } else { // Not so valid
                    return message.reply(`Invalid timezone, look here https://en.wikipedia.org/wiki/List_of_tz_database_time_zones \nand find the one that you need, then enter what it says in the TZ column`);
                }
                break;
            case "announcechan":
                if (value !== '') {
                    var newChannel = message.guild.channels.find('name', value);
                    if (!newChannel) return message.channel.send(`Sorry, but I cannot find the channel ${value}. Please try again.`);
                    guildConf["announceChan"] = value;
                } else {
                    guildConf["announceChan"] = "";
                }
                break;
            case "help":
                return message.channel.send(`**Extended help for ${this.help.name}** \n**Usage**: ${this.help.usage} \n${this.help.extended}`);
            default:
                return message.reply(`This key is not in the configuration. Look in "${config.prefix}showconf", or "${config.prefix}setconf help" for a list`);
        }

        // Then we re-apply the changed value to the PersistentCollection
        guildSettings.set(message.guild.id, guildConf);

        // We can confirm everything's done to the client.
        message.channel.send(`Guild configuration item ${key} has been changed to:\n\`${value}\``);
    } else {
        message.channel.send(`No guild settings found, run \`${config.prefix}showconf\` to build them.`);
    }
};

exports.conf = {
    enabled: true,
    guildOnly: false,
    aliases: ['setconfig'],
    permLevel: 3
};

exports.help = {
    name: 'setconf',
    category: 'Admin',
    description: 'Used to set the bot\'s config settings.',
    usage: 'setconf [help|key] [value]',
    extended: `\`\`\`asciidoc
adminRole      :: The role that you want to be able to modify bot settings or set up events.
enableWlecome  :: Toggles the welcome message on/ off.
welcomeMessage :: The welcome message to send it you have it enabled. 
                  '{{user}}' gets replaced with the new user's name.
                  '{{userMention}}' makes it mention the new user there.
useEmbeds      :: Toggles whether or not to use embeds for the mods output.
timezone       :: Sets the timezone that you want all time related commands to use. Look here if you need a list https://goo.gl/Vqwe49.
announceChan   :: Sets the name of your announcements channel for events etc. Leave blank if there is none,  and it will send them in your default channel. Make sure it has permission to send them there.
help           :: Shows this help message.
\`\`\``,
    example: 'setconf adminRole Admin\nOr "setconf help" for more info'
};