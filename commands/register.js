const Command = require('../base/Command');

class Register extends Command {
    constructor(client) {
        super(client, {
            name: 'register',
            category: "SWGoH",
            aliases: ['reg']
        });
    }

    async run(client, message, [userID, allyCode, ...args], level) { // eslint-disable-line no-unused-vars

        if (!userID) {
            return message.channel.send(message.language.get('COMMAND_REGISTER_MISSING_ARGS'));
        } else {
            if (userID === 'me') {
                userID = message.author.id;
            } else if (userID.match(/\d{17,18}/)) {
                userID = userID.replace(/[^\d]*/g, '');
                // If they are trying to add someone else and they don't have the right perms, stop em
                if (userID !== message.author.id && level < 3) {
                    return message.channel.send(message.language.get('COMMAND_SHARDTIMES_MISSING_ROLE'));
                }
            } else {
                // Bad name, grumblin time
                return message.channel.send(message.language.get('COMMAND_SHARDTIMES_INVALID_USER'));
            }
        }
        const exists = await client.allyCodes.findOne({where: {id: userID}})
            .then(token => token != null)
            .then(isUnique => isUnique);

        if (!allyCode) {
            return message.channel.send(message.language.get('COMMAND_REGISTER_MISSING_ALLY'));
        } else {
            if (allyCode.replace(/[^\d]*/g, '').match(/\d{9}/)) {
                allyCode = allyCode.replace(/[^\d]*/g, '');
            } else {
                // Bad code, grumblin time
                return message.channel.send(message.language.get('COMMAND_REGISTER_INVALID_ALLY', allyCode));
            }
        }

        // They made it past the checks, valid uID & ally code     
        if (exists) {
            // Update their link
            await client.allyCodes.update({allyCode: allyCode}, {where: {id: userID}});
        } else {
            // Create a new one
            await client.allyCodes.create({
                id: userID,
                allyCode: allyCode
            });
        }
        // Sync up their swgoh account
        message.channel.send(message.language.get('COMMAND_REGISTER_PLEASE_WAIT')).then(async msg => {
            await client.swgohAPI.updatePlayer(allyCode).then(() => {
                msg.edit(message.language.get('COMMAND_REGISTER_SUCCESS'));
            });
        });
    }
}

module.exports = Register;

