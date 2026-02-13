import { codeBlock, InteractionContextType } from "discord.js";
import Command from "../base/slashCommand.ts";
import type { CommandContext } from "../types/types.ts";

export default class Modsets extends Command {
    static readonly metadata = {
        name: "modsets",
        category: "General",

        guildOnly: false,
        contexts: [InteractionContextType.Guild, InteractionContextType.BotDM],
        description: "Displays how many mods you need per type for a full set",
    };
    constructor() {
        super(Modsets.metadata);
    }

    run({ interaction, language }: CommandContext) {
        return interaction.reply({ content: codeBlock("md", language.get("COMMAND_MODSETS_OUTPUT")) });
    }
}
