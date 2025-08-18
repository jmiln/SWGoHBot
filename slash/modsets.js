import { codeBlock } from "discord.js";
import Command from "../base/slashCommand.js";

export default class Modsets extends Command {
    constructor(Bot) {
        super(Bot, {
            name: "modsets",
            guildOnly: false,
            description: "Displays how many mods you need per type for a full set",
        });
    }

    run(_Bot, interaction) {
        return interaction.reply({ content: codeBlock("md", interaction.language.get("COMMAND_MODSETS_OUTPUT")) });
    }
}
