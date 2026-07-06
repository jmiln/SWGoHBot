import { type ChatInputCommandInteraction, MessageFlags } from "discord.js";
import constants from "../../data/constants/constants.ts";
import logger from "../../modules/Logger.ts";

// Common/expected Discord API errors that should be filtered out of logs
const IGNORED_ERRORS = [
    "DiscordAPIError: Missing Access",
    "HTTPError [AbortError]: The user aborted a request.",
    "HTTPError: Service Unavailable",
    "Internal Server Error",
    "Invalid Webhook Token",
    "The user aborted a request",
    "Cannot send messages to this user",
    "Unknown interaction",
    "Unknown message",
];

/**
 * Checks if an error should be ignored based on common Discord API errors
 */
export function isIgnoredError(err: unknown): boolean {
    const errStr = err?.toString().toLowerCase() || "";
    return IGNORED_ERRORS.some((str) => errStr.includes(str.toLowerCase()));
}

/**
 * Logs errors while filtering out common/expected Discord API errors
 */
export function logErr(errStr: string, useWebhook = false): void {
    if (isIgnoredError(errStr)) return;
    logger.error(errStr, useWebhook);
}

/**
 * Sends an error reply to the user based on the interaction state
 */
export async function sendErrorReply(interaction: ChatInputCommandInteraction, commandName: string): Promise<void> {
    const replyContent = `It looks like something broke when trying to run that command. If this error continues, please report it here: ${constants.invite}`;

    try {
        if (interaction.replied) {
            await interaction.followUp({ content: replyContent });
        } else if (interaction.deferred) {
            await interaction.editReply({ content: replyContent });
        } else {
            await interaction.reply({ content: replyContent, flags: MessageFlags.Ephemeral });
        }
    } catch (e) {
        logErr(`[cmd:${commandName}] Error trying to send error message: ${String(e)}`);
    }
}
