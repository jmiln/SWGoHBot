const Command = require('../base/Command');

class Info extends Command {
    constructor(client) {
        super(client, {
            aliases: ['invite', 'inv'],
            name: 'info',
            category: 'Misc',
            description: 'Shows useful links pertaining to the bot.',
            usage: 'info'
        });
    }


    run(client, message) {
        message.channel.send(message.language.COMMAND_INFO_OUTPUT);
    }
}

module.exports = Info;