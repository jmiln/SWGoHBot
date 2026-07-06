import { Events } from "discord.js";
import { handleAutocomplete } from "../handlers/interactions/autocomplete.ts";
import { handleChatInputCommand } from "../handlers/interactions/chatInput.ts";
import { getCommand } from "../handlers/slashHandler.ts";
import type { AnyBotInteraction } from "../types/types.ts";

export default {
    name: Events.InteractionCreate,
    execute: async (interaction: AnyBotInteraction) => {
        // Filter out non-command interactions and bot users
        if (!interaction?.isChatInputCommand() && !interaction.isAutocomplete()) return;
        if (interaction.user.bot) return;

        // Get command
        const cmd = getCommand(interaction.commandName);
        if (!cmd) return;

        // Route to appropriate handler
        if (interaction.isChatInputCommand()) {
            await handleChatInputCommand(interaction, cmd);
        } else if (interaction.isAutocomplete()) {
            await handleAutocomplete(interaction, cmd);
        }
    },
};
