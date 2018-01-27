var moment = require('moment-timezone');
// var {inspect} = require('util');

exports.run = async (client, message, args, level) => {
    const config = client.config;
    const guildSettings = await client.guildSettings.findOne({where: {guildID: message.guild.id}, attributes: Object.keys(client.config.defaultSettings)});
    const guildConf = guildSettings.dataValues;
    const langList = Object.keys(client.languages);
    const defSet = client.config.defaultSettings;

    if (guildConf) {
        if (level < this.conf.permLevel) {
            return message.reply(message.language.COMMAND_SETCONF_MISSING_PERMS).then(msg => msg.delete(4000)).catch(console.error);
        }
        if (!args[0]) return message.reply(message.language.COMMAND_SETCONF_MISSING_OPTION).then(msg => msg.delete(4000)).catch(console.error);
        const key = args[0].toLowerCase();

        let value = '';

        // The list of commands that don't need another argument
        const noVal = ["help", "announcechan", "reset"];

        // If there is no second argument, and it's not one that doesn't need one, return
        if (!args[1] && !noVal.includes(key)) {
            return message.reply(message.language.COMMAND_SETCONF_MISSING_VALUE).then(msg => msg.delete(4000)).catch(console.error);
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
                    return message.reply(message.language.COMMAND_SETCONF_ADMINROLE_MISSING_OPT).then(msg => msg.delete(4000)).catch(console.error);
                }
                if (!args[2]) {
                    return message.reply(message.language.COMMAND_SETCONF_ADMINROLE_NEED_ROLE(args[2])).then(msg => msg.delete(4000)).catch(console.error);
                }
                var roleName = args.slice(2).join(' ');

                var roleArray = guildConf["adminRole"];

                if (args[1] === 'add') {
                    var newRole = message.guild.roles.find('name', roleName);
                    if (!newRole) return message.channel.send(message.language.COMMAND_SETCONF_ADMINROLE_MISSING_ROLE(roleName)).then(msg => msg.delete(4000)).catch(console.error);
                    if (!roleArray.includes(roleName)) {
                        roleArray.push(roleName);
                    } else {
                        return message.channel.send(message.language.COMMAND_SETCONF_ADMINROLE_ROLE_EXISTS(roleName)).then(msg => msg.delete(4000)).catch(console.error);
                    }
                } else if (args[1] === 'remove') {
                    if (roleArray.includes(roleName)) {
                        roleArray.splice(roleArray.indexOf(roleName), 1);
                    } else {
                        return message.channel.send(message.language.COMMAND_SETCONF_ADMINROLE_NOT_IN_CONFIG(roleName)).then(msg => msg.delete(4000)).catch(console.error);
                    }
                }
                client.guildSettings.update({adminRole: roleArray}, {where: {guildID: message.guild.id}});
                return message.channel.send(message.language.COMMAND_SETCONF_ADMINROLE_SUCCESS(roleName, (args[1] === 'add' ? 'added to' : 'removed from')));
            case "enablewelcome":
                if (onVar.includes(value.toLowerCase())) {
                    const newChannel = message.guild.channels.find('name', guildConf['announceChan']);
                    if (!newChannel) {
                        return message.channel.send(message.language.COMMAND_SETCONF_WELCOME_NEED_CHAN).then(msg => msg.delete(10000)).catch(console.error);
                    }
                    boolVar = true;
                } else if (offVar.includes(value.toLowerCase())) {
                    boolVar = false;
                } else {
                    return message.reply(message.language.COMMAND_INVALID_BOOL).then(msg => msg.delete(4000)).catch(console.error);
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
                    return message.reply(message.language.COMMAND_INVALID_BOOL).then(msg => msg.delete(4000)).catch(console.error);
                }
                client.guildSettings.update({useEmbeds: boolVar}, {where: {guildID: message.guild.id}});
                break;
            case "timezone":
                if (moment.tz.zone(value)) { // Valid time zone
                    client.guildSettings.update({timezone: value}, {where: {guildID: message.guild.id}});
                } else { // Not so valid
                    return message.reply(message.language.COMMAND_SETCONF_TIMEZONE_NEED_ZONE).then(msg => msg.delete(10000)).catch(console.error);
                }
                break;
            case "announcechan":
                if (value !== '') {
                    const newChannel = message.guild.channels.find('name', value);
                    if (!newChannel) return message.channel.send(message.language.COMMAND_SETCONF_ANNOUNCECHAN_NEED_CHAN(value)).then(msg => msg.delete(4000)).catch(console.error);
                    if (!newChannel.permissionsFor(message.guild.me).has(["SEND_MESSAGES", "VIEW_CHANNEL"])) return message.channel.send(message.language.COMMAND_SETCONF_ANNOUNCECHAN_NO_PERMS);
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
                    return message.reply(message.language.COMMAND_INVALID_BOOL).then(msg => msg.delete(4000)).catch(console.error);
                }
                client.guildSettings.update({useEventPages: boolVar}, {where: {guildID: message.guild.id}});
                break;
            case "language":
                if (langList.includes(value)) {
                    client.guildSettings.update({language: value}, {where: {guildID: message.guild.id}});
                } else {
                    return message.channel.send(message.language.COMMAND_SETCONF_INVALID_LANG(value, langList.join(', '))).then(msg => msg.delete(15000)).catch(console.error);
                }
                break;
            case "reset":
                await client.guildSettings.destroy({where: {guildID: message.guild.id}})
                    .then(() => {})
                    .catch(error => { client.log('ERROR',`Broke in setconf reset delete: ${error}`); });
                client.guildSettings.create({
                    guildID: message.guild.id,
                    adminRole: defSet.adminRole,
                    enableWelcome: defSet.enableWelcome,
                    welcomeMessage: defSet.welcomeMessage,
                    useEmbeds: defSet.useEmbeds,
                    timezone: defSet.timezone,
                    announceChan: defSet.announceChan,
                    useEventPages: defSet.useEventPages,
                    language: defSet.language
                })
                    .then(() => {})
                    .catch(error => { client.log('ERROR'`Broke in setconf reset create: ${error}`); });
                return message.channel.send(message.language.COMMAND_SETCONF_RESET);
            case "help":
                return message.channel.send(message.language.COMMAND_EXTENDED_HELP(this));
            default:
                return message.reply(message.language.COMMAND_SETCONF_NO_KEY(config.prefix)).then(msg => msg.delete(4000)).catch(console.error);
        }

        // We can confirm everything's done to the client.
        message.channel.send(message.language.COMMAND_SETCONF_UPDATE_SUCCESS(key, value));
    } else {
        message.channel.send(message.language.COMMAND_SETCONF_NO_SETTINGS).then(msg => msg.delete(4000)).catch(console.error);
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
reset          :: Resets the config back to default (ONLY use this if you are sure)
help           :: Shows this help message.
\`\`\``,
    example: 'setconf adminRole add Admin\nOr "setconf help" for more info'
};
