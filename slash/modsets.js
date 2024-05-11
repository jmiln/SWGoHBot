const { codeBlock } = require("discord.js");
const Command = require("../base/slashCommand");

class Modsets extends Command {
    constructor(Bot) {
        super(Bot, {
            name: "modsets",
            guildOnly: false,
            description: "Displays how many mods you need per type for a full set",
        });
    }

    run(Bot, interaction) {
        return interaction.reply({ content: codeBlock("md", interaction.language.get("COMMAND_MODSETS_OUTPUT")) });
    }
}

module.exports = Modsets;
