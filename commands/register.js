const Command = require('../base/Command');

class Register extends Command {
    constructor(client) {
        super(client, {
            name: 'register',
            category: "SWGoH",
            aliases: ['reg'],
            flags: {
                'guild': {
                    aliases: ['g', 'guilds']
                }
            }
        });
    }

    async run(client, message, [action, userID, allyCode, ...args], options) { // eslint-disable-line no-unused-vars
        const level = options.level;
        const acts = ['add', 'update', 'remove'];
        let exists;
        if (!action || !acts.includes(action.toLowerCase())) {
            return client.helpOut(message, this);
        }
        action = action.toLowerCase();
        if (action !== 'update') {
            if (!userID) {
                return message.channel.send(message.language.get('COMMAND_REGISTER_MISSING_ARGS'));
            } else {
                if (userID === 'me') {
                    userID = message.author.id;
                } else if (client.isUserID(userID)) {
                    userID = userID.replace(/[^\d]*/g, '');
                    // If they are trying to add someone else and they don't have the right perms, stop em
                    if (userID !== message.author.id) {
                        if (level < 3) {
                            return message.channel.send(message.language.get('COMMAND_SHARDTIMES_MISSING_ROLE'));
                        } else if (!message.guild.members.has(userID) && action === 'add' && level < 3) {  // If they are trying to add someone that is not in their server
                            return message.channel.send(message.language.get('COMMAND_REGISTER_ADD_NO_SERVER'));
                        } else if (!message.guild.members.has(userID) && action === 'remove' && level < 8) {   // If they are trying to remove someone else 
                            return message.channel.send(message.language.get('COMMAND_REGISTER_CANNOT_REMOVE', message.guildSettings.prefix));
                        }
                    }
                } else {
                    // Bad name, grumblin time
                    return message.channel.send(message.language.get('COMMAND_SHARDTIMES_INVALID_USER'));
                }
            }
            exists = await client.database.models.allyCodes.findOne({where: {id: userID}})
                .then(token => token != null)
                .then(isUnique => isUnique);
        }

        switch (action) {
            case 'add':
                if (!allyCode) {
                    return message.channel.send(message.language.get('COMMAND_REGISTER_MISSING_ALLY'));
                } else {
                    if (client.isAllyCode(allyCode)) {
                        allyCode = allyCode.replace(/[^\d]*/g, '');
                    } else {
                        // Bad code, grumblin time
                        return message.channel.send(message.language.get('COMMAND_REGISTER_INVALID_ALLY', allyCode));
                    }
                }
                if (!exists) {
                    // Sync up their swgoh account
                    message.channel.send(message.language.get('COMMAND_REGISTER_PLEASE_WAIT')).then(async msg => {
                        try {
                            await client.swgohAPI.player(allyCode, 'ENG_US').then(async (u) => {
                                if (!u) {
                                    await msg.edit(message.language.get('COMMAND_REGISTER_FAILURE'));
                                } else {
                                    await client.database.models.allyCodes.create({
                                        id: userID,
                                        allyCode: allyCode
                                    })
                                        .then(async () => {
                                            await msg.edit(message.language.get('COMMAND_REGISTER_SUCCESS', u.name));
                                        })
                                        .catch(e => {
                                            msg.edit('Something went wrong. Please notify the proper authorities.');
                                            client.log('REGISTER', 'Broke while trying to link new user: ' + e);
                                        });
                                }
                            });
                        } catch (e) {
                            msg.edit('Invalid ally code. Please make sure you enter the correct code.');
                            console.log('ERROR: Incorrect Ally Code: ' + e);
                        }
                    });
                } else {
                    return message.channel.send(message.language.get('COMMAND_REGISTER_ALREADY_ADDED', message.guildSettings.prefix));
                }
                break;
            case 'update': {
                return message.channel.send(["Sorry, but this has been disabled.",
                    "Your profile data will stay the same for 2 hours after a sync, then will update",
                    "when you use a command that uses that data after that time is up"
                ].join('\n'));
            //     if (!userID || userID === "me") {
            //         userID = message.author.id;
            //     } else if (userID.match(/\d{17,18}/)) {
            //         userID = userID.replace(/[^\d]|)}>#g, '');
            //     } else {
            //         name = userID; 
            //         name += allyCode ? ' ' + allyCode : '';
            //         name += args.length ? ' ' + args.join(' ') : '';
            //     }
            //     const allyCodes = await client.getAllyCode(message, name ? name.trim() : userID);
            //     let ac;
            //     if (!allyCodes.length) {
            //         // Tell em no match found
            //         return message.channel.send("I didn't find any results for that user");
            //     } else if (allyCodes.length > 1) {
            //         // Tell em there's too many
            //         return message.channel.send('Found ' + allyCodes.length + ' matches. Please try being more specific, or use their ally code, Discord userID, or mention them.');
            //     } else {
            //         ac = allyCodes[0];
            //     }
            //
            //     await message.channel.send(message.language.get('COMMAND_REGISTER_PLEASE_WAIT')).then(async msg => {
            //         if (options.flags.guild) {
            //             await client.swgohAPI.updateGuild(ac, 'ENG_US').then(async () => {
            //                 await client.swgohAPI.getPlayer(ac, 'ENG_US').then(async (u) => {
            //                     if (!u) {
            //                         await msg.edit(message.language.get('COMMAND_REGISTER_UPDATE_FAILURE'));
            //                     } else {
            //                         await msg.edit(message.language.get('COMMAND_REGISTER_GUPDATE_SUCCESS', u.guildName));
            //                     }
            //                 });
            //             });
            //         } else {
            //             await client.swgohAPI.getPlayer(ac, 'ENG_US').then(async (u) => {
            //                 if (!u) {
            //                     await msg.edit(message.language.get('COMMAND_REGISTER_UPDATE_FAILURE'));
            //                 } else {
            //                     await msg.edit(message.language.get('COMMAND_REGISTER_UPDATE_SUCCESS', u.name));
            //                 }
            //             });
            //         }
            //     });
            //     break;
            }
            case 'remove':
                if (!exists) {
                    message.channel.send(message.language.get('COMMAND_REGISTER_NOT_LINKED'));
                } else {
                    await client.database.models.allyCodes.destroy({where: {id: userID}})
                        .then(() => {
                            message.channel.send(message.language.get('COMMAND_REGISTER_REMOVE_SUCCESS'));
                        })
                        .catch((e) => {
                            client.log('REGISTER', 'Broke trying to unlink: ' + e);
                            message.channel.send('Something went wrong, please try again.');
                        });
                }
                break;
            default:
                client.helpOut(message, this);

        }
    }
}

module.exports = Register;

