const Command = require('../base/Command');

class Modsets extends Command {
    constructor(client) {
        super(client, {
            name: 'modsets',
            category: "Star Wars",
            description: 'Shows how many of each kind of mod you need for a set.',
            usage: 'modsets',
            example: `;modsets`,
        });
    }

    run(client, message) {
        message.channel.send(message.language.COMMAND_MODSETS_OUTPUT, {code: 'md'});
    }
}

module.exports = Modsets;
