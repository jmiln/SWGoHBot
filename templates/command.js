const Command = require('../base/Command');

class CommandName extends Command {
    constructor(client) {
        super(client, {
            name: '',
            category: "",
            hidden: false,
            enabled: true, 
            guildOnly: true,
            aliases: [],
            permLevel: 0
        });
    }

    async run(client, message, [action, ...args], level) { // eslint-disable-line no-unused-vars
        // Whatever the command needs to do here
        // Message is the Discord message object, action is the first argument after the command call.
        // the ...args is the rest of the message content. 
        // level is the permLevel of the message author. 10 for bot owner, 3 for server admin, 0 for everyone else
    }
}

module.exports = CommandName;

