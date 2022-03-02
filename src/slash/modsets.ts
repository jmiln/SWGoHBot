const Command = require("../base/slashCommand");

class Modsets extends Command {
    constructor(Bot) {
        super(Bot, {
            name: "modsets",
            category: "Star Wars",
            guildOnly: false,
            description: "Displays how many mods you need per type for a full set"
        });
    }

    run(Bot, interaction) {
        return interaction.reply({content: Bot.codeBlock(interaction.language.get("COMMAND_MODSETS_OUTPUT"), "md")});
    }
}

module.exports = Modsets;
