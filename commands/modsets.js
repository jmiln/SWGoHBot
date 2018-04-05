const Command = require('../base/Command');

class Modsets extends Command {
    constructor(client) {
        super(client, {
            name: 'modsets',
            category: "Star Wars"
        });
    }

    run(client, message) {
        message.channel.send(message.language.get('COMMAND_MODSETS_OUTPUT'), {code: 'md'});
    }
}

module.exports = Modsets;
