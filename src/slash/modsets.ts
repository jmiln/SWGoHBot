import { Interaction } from "discord.js";
import SlashCommand from "../base/slashCommand";
import { BotInteraction, BotType } from "../modules/types";

class Modsets extends SlashCommand {
    constructor(Bot: BotType) {
        super(Bot, {
            name: "modsets",
            category: "Star Wars",
            guildOnly: false,
            description: "Displays how many mods you need per type for a full set"
        });
    }

    run(Bot: BotType, interaction: BotInteraction) {
        return interaction.reply({content: Bot.codeBlock(interaction.language.get("COMMAND_MODSETS_OUTPUT"), "md")});
    }
}

module.exports = Modsets;
