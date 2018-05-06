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
            permissions: [],    // Starts with ['SEND_MESSAGES', 'VIEW_CHANNEL'] so don't need to add them
            permLevel: 0,
            flags: {            // Flags will be true or false, depending on whether they are in the message or not
                'example': {
                    aliases: ['ex']
                }
            },
            subArgs: {          // Subargs are like flags, but it will return the argument after it instead of a bool
                'ex2': {
                    aliases: ['ex1', 'ex3'],
                    default: 0              // The default value for if it doesn't find one 
                }
            }
        });
    }

    async run(client, message, [action, ...args], options) { // eslint-disable-line no-unused-vars
        // Whatever the command needs to do here
        // Message is the Discord message object, action is the first argument after the command call.
        // the ...args is an array of the rest of the message content. 
        //
        // Options includes the level, flags, and subArgs for the commmand and looks like 
        // options: {
        //     level: 0,
        //     flags: {
        //         example: true
        //     },
        //     subArgs: {
        //         ex2: value
        //     }
        // } 
        //             
        // level is the permLevel of the message author. 10 for bot owner, 3 for server admin, 0 for everyone else
    }
}

module.exports = CommandName;

