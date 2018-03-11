const Command = require('../base/Command');

class CommandName extends Command {
    constructor(client) {
        super(client, {
            name: '',
            description: "",
            category: "",
            usage: "",
            example: "",
            extended: "",
            hidden: false,
            enabled: true, 
            guildOnly: true,
            aliases: [],
            permLevel: 0
        });
    }

    async run(client, message, args, level) {
        // Whatever the command needs to do here
    }
}

module.exports = CommandName;

