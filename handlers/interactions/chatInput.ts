import { inspect } from "node:util";
import { type ChatInputCommandInteraction, DiscordAPIError, MessageFlags } from "discord.js";
import Language from "../../base/Language.ts";
import type slashCommand from "../../base/slashCommand.ts";
import { defaultSettings } from "../../data/constants/defaultGuildConf.ts";
import commandStats from "../../modules/commandStats.ts";
import { permLevel } from "../../modules/functions.ts";
import { getGuildSettings } from "../../modules/guildConfig/settings.ts";
import logger from "../../modules/Logger.ts";
import userReg from "../../modules/users.ts";
import type { CommandContext } from "../../types/types.ts";
import { isIgnoredError, logErr, sendErrorReply } from "./errors.ts";

/**
 * Handles chat input command interactions
 */
export async function handleChatInputCommand(interaction: ChatInputCommandInteraction, cmd: slashCommand): Promise<void> {
    // Load guild settings
    const guildSettings = await getGuildSettings({ guildId: interaction?.guild?.id });

    // Load user language settings
    const user = await userReg.getUser(interaction.user.id);
    const selectedLanguage = user?.lang?.language || defaultSettings.language;
    const swgohLanguage = user?.lang?.swgohLanguage || defaultSettings.swgohLanguage;

    const language = Language.getLanguageOrDefault(selectedLanguage);

    // Merge swgohLanguage into guildSettings
    const mergedGuildSettings = { ...guildSettings, swgohLanguage };

    // Check permissions
    const level = await permLevel(interaction, mergedGuildSettings);
    if (level < cmd.commandData.permLevel) {
        await interaction.reply({
            content: "Sorry, but you don't have permission to run that command.",
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    // Build CommandContext
    const ctx: CommandContext = {
        interaction,
        guildSettings: mergedGuildSettings,
        language,
        swgohLanguage,
        permLevel: level,
    };

    // Execute command
    const startTime = Date.now();
    let commandError: Error | undefined;
    try {
        await cmd.run(ctx);
    } catch (err) {
        // Interaction already acknowledged - shard replay or duplicate delivery; first handler is serving the user
        if (err instanceof DiscordAPIError && err.code === 40060) {
            return;
        }
        commandError = err instanceof Error ? err : new Error(String(err));
        logger.error(String(err));
        // Special handling for test command
        if (cmd.commandData.name === "test") {
            logger.error(
                `ERROR(inter) (user: ${interaction.user.id}) I broke with ${cmd.commandData.name}: \nOptions: ${inspect(interaction.options, { depth: 5 })} \n${inspect(err, { depth: 5 })}`,
            );
            return;
        }

        // Log the error
        if (isIgnoredError(err)) {
            const firstLine = err?.toString().split("\n")[0] || String(err);
            logErr(`ERROR(inter) (user: ${interaction.user.id}) I broke with ${cmd.commandData.name}: \n${firstLine}`);
        } else {
            const optionNames = interaction.options.data.map((o) => o.name).join(", ");
            logErr(
                `ERROR(inter) (user: ${interaction.user.id}) I broke with ${cmd.commandData.name}: \nOptions: ${optionNames} \n${inspect(err, { depth: 5 })}`,
                true,
            );
        }

        // Send error reply to user
        await sendErrorReply(interaction, cmd.commandData.name);
    } finally {
        // Record command usage (success or failure)
        const executionTime = Date.now() - startTime;
        await commandStats.recordCommandUsage(interaction, executionTime, commandError);
    }
}
