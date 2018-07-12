const moment = require('moment-timezone');
// var {inspect} = require('util');

const Command = require('../base/Command');

class Setconf extends Command {
    constructor(client) {
        super(client, {
            name: 'setconf',
            aliases: ['setconfig'],
            permLevel: 3,
            category: 'Admin'
        });
    }

    // TODO TODO TODO TODO 
    // TODO TODO TODO TODO 
    // TODO TODO TODO TODO change the setconf strings to be more generic
    // TODO TODO TODO TODO
    // TODO TODO TODO TODO
    async run(client, message, [key, ...value]) {    
        const config = client.config;
        const guildSettings = await client.database.models.settings.findOne({where: {guildID: message.guild.id}, attributes: Object.keys(client.config.defaultSettings)});
        const guildConf = guildSettings.dataValues;
        const langList = Object.keys(client.languages);
        const swgohLangList = ['CHS_CN', 'CHT_CN', 'ENG_US', 'FRE_FR', 'GER_DE', 'IND_ID', 'ITA_IT', 'JPN_JP', 'KOR_KR', 'POR_BR', 'RUS_RU', 'SPA_XM', 'THA_TH', 'TUR_TR'];
        const defSet = config.defaultSettings;
        const rawAttr = client.database.models.settings.rawAttributes;
        const onVar = ["true", "on", "enable"];
        const offVar = ["false", "off", "disable"];

        if (guildConf) {
            if (Object.keys(defSet).indexOf(key) > -1) { // Make sure the key exists
                switch (rawAttr[key].type.toString()) {
                    case 'TEXT':
                        if (!value.length) {
                            if (key === 'prefix') {
                                value = defSet.prefix;
                            } else {
                                value = '';
                            }
                        } else {
                            value = value.join(' ').replace(/\n\s+/g, '\n');
                        }
                        if (key === 'prefix' && value.indexOf(' ') > -1) {
                            return message.channel.send(message.language.get('COMMAND_SETCONF_PREFIX_TOO_LONG'));
                        } else if (key === 'language') {
                            if (!langList.includes(value)) {
                                return message.channel.send(message.language.get('COMMAND_SETCONF_INVALID_LANG', value, langList.join(', ')));
                            }
                        } else if (key === 'swgohLanguage') {
                            if (!swgohLangList.includes(value)) {
                                return message.channel.send(message.language.get('COMMAND_SETCONF_INVALID_LANG', value, swgohLangList.join(', ')));
                            }
                        } else if (key === 'timezone') {
                            if (!moment.tz.zone(value)) { // Valid time zone
                                return message.reply(message.language.get('COMMAND_SETCONF_TIMEZONE_NEED_ZONE'));
                            }
                        } else if (key === 'announceChan') {
                            const newChannel = message.guild.channels.find('name', value);
                            if (!newChannel) return message.channel.send(message.language.get('COMMAND_SETCONF_ANNOUNCECHAN_NEED_CHAN', value));
                            if (!newChannel.permissionsFor(message.guild.me).has(["SEND_MESSAGES", "VIEW_CHANNEL"])) return message.channel.send(message.language.get('COMMAND_SETCONF_ANNOUNCECHAN_NO_PERMS'));
                        }
                        client.database.models.settings.update({[key]: value}, {where: {guildID: message.guild.id}});
                        return message.channel.send('Config setting `' + key + '` changed to `' + value + '`');
                    case 'TEXT[]': {
                        let action;
                        if (value[0]) {
                            action = value.splice(0, 1)[0];
                        } else {
                            return message.reply(message.language.get('COMMAND_SETCONF_ARRAY_MISSING_OPT'));
                        }
                        if (!value[0]) {
                            return message.reply('You need a value to ' + action);
                        }
                        value = value.join(' ');

                        const valArray = guildConf[key];

                        if (action === 'add') { 
                            if (key === 'adminRole') { // If it needs a role, make sure it's a valid role
                                const role = message.guild.roles.find('name', value);
                                if (!role) return message.channel.send(message.language.get('COMMAND_SETCONF_ADMINROLE_MISSING_ROLE', value));
                            }
                            if (!valArray.includes(value)) {
                                valArray.push(value);
                            } else {
                                return message.channel.send(message.language.get('COMMAND_SETCONF_ADMINROLE_ROLE_EXISTS', value));
                            }
                        } else if (action === 'remove') {
                            if (valArray.includes(value)) {
                                valArray.splice(valArray.indexOf(value), 1);
                            } else {
                                return message.channel.send(message.language.get('COMMAND_SETCONF_ARRAY_NOT_IN_CONFIG', key, value));
                            }
                        } else {
                            return message.reply(message.language.get('COMMAND_SETCONF_ARRAY_MISSING_OPT'));
                        }
                        client.database.models.settings.update({[key]: [...new Set(valArray)]}, {where: {guildID: message.guild.id}});
                        return message.channel.send(message.language.get('COMMAND_SETCONF_ARRAY_SUCCESS', key, value, (action === 'add' ? 'added to' : 'removed from')));
                    }
                    case 'BOOLEAN':
                        if (onVar.includes(value[0].toLowerCase())) {
                            value = true;
                        } else if (offVar.includes(value[0].toLowerCase())) {
                            value = false;
                        } else {
                            return message.channel.send(message.language.get('COMMAND_INVALID_BOOL'));
                        }
                        client.database.models.settings.update({[key]: value}, {where: {guildID: message.guild.id}});
                        return message.channel.send('Value for `' + key + '` changed to `' + value + '`');
                    // case 'INTEGER':      // Don't have any of these yet
                    case 'INTEGER[]': {
                        let action;
                        if (value[0]) {
                            action = value.splice(0, 1)[0];
                        } else {
                            return message.reply(message.language.get('COMMAND_SETCONF_ARRAY_MISSING_OPT'));
                        }
                        if (!value[0]) {
                            return message.reply('You need a value to ' + action);
                        }
                        value = parseInt(value[0]);

                        if (isNaN(value)) {
                            return message.channel.send("Invalid value, make sure you're trying to add a number in.");
                        }
        
                        const valArray = guildConf[key];

                        if (action === 'add') { 
                            if (key === 'adminRole') { // If it needs a role, make sure it's a valid role
                                const role = message.guild.roles.find('name', value);
                                if (!role) return message.channel.send(message.language.get('COMMAND_SETCONF_ADMINROLE_MISSING_ROLE', value));
                            }
                            if (!valArray.includes(value)) {
                                valArray.push(value);
                            } else {
                                return message.channel.send(message.language.get('COMMAND_SETCONF_ADMINROLE_ROLE_EXISTS', value));
                            }
                        } else if (action === 'remove') {
                            if (valArray.includes(value)) {
                                valArray.splice(valArray.indexOf(value), 1);
                            } else {
                                return message.channel.send(message.language.get('COMMAND_SETCONF_ARRAY_NOT_IN_CONFIG', key, value));
                            }
                        } else {
                            return message.reply(message.language.get('COMMAND_SETCONF_ARRAY_MISSING_OPT'));
                        }
                        client.database.models.settings.update({[key]: [...new Set(valArray.sort((p,c) => p - c))]}, {where: {guildID: message.guild.id}});
                        return message.channel.send(message.language.get('COMMAND_SETCONF_ARRAY_SUCCESS', key, value, (action === 'add' ? 'added to' : 'removed from')));
                    }
                    default: 
                        // Didn't find it?
                        message.channel.send('Sorry, but something went wrong.');
                }
            } else {
                // No such key
                return message.reply(message.language.get('COMMAND_SETCONF_NO_KEY', guildConf.prefix));
            }
        }

        //         case "reset":
        //             await client.database.models.settings.destroy({where: {guildID: message.guild.id}})
        //                 .then(() => {})
        //                 .catch(error => { client.log('ERROR',`Broke in setconf reset delete: ${error}`); });
        //             client.database.models.settings.create({
        //                 guildID: message.guild.id,
        //                 adminRole: defSet.adminRole,
        //                 enableWelcome: defSet.enableWelcome,
        //                 welcomeMessage: defSet.welcomeMessage,
        //                 useEmbeds: defSet.useEmbeds,
        //                 timezone: defSet.timezone,
        //                 announceChan: defSet.announceChan,
        //                 useEventPages: defSet.useEventPages,
        //                 language: defSet.language
        //             })
        //                 .then(() => {})
        //                 .catch(error => { client.log('ERROR'`Broke in setconf reset create: ${error}`); });
    }
}

module.exports = Setconf;
