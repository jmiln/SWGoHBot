import { codeBlock } from "discord.js";
import Command from "../base/slashCommand.ts";
import type { BotInteraction, BotType } from "../types/types.ts";

export default class Modsets extends Command {
    constructor(Bot: BotType) {
        super(Bot, {
            name: "modsets",
            guildOnly: false,
            description: "Displays how many mods you need per type for a full set",
        });
    }

    run(_Bot: BotType, interaction: BotInteraction) {
        return interaction.reply({ content: codeBlock("md", interaction.language.get("COMMAND_MODSETS_OUTPUT")) });
    }
}
