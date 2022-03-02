const Command = require("../base/Command");

class Modsets extends Command {
    constructor(Bot) {
        super(Bot, {
            name: "modsets",
            category: "Star Wars"
        });
    }

    run(Bot, message) {
        message.channel.send({content: Bot.codeBlock(message.language.get("COMMAND_MODSETS_OUTPUT"), "md")});
    }
}

module.exports = Modsets;
