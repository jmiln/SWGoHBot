import { inspect } from "node:util";
import { Events, MessageFlags } from "discord.js";
import Language from "../base/Language.ts";
import type slashCommand from "../base/slashCommand.ts";
import cache from "../modules/cache.ts";
import constants from "../data/constants/constants.ts";
import { defaultSettings } from "../data/constants/defaultGuildConf.ts";
import logger from "../modules/Logger.ts";
import { permLevel } from "../modules/functions.ts";
import { getGuildAliases } from "../modules/guildConfig/aliases.ts";
import { getGuildSettings } from "../modules/guildConfig/settings.ts";
import userReg from "../modules/users.ts";
import type { BotClient, BotInteraction, BotType } from "../types/types.ts";

// Constants
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

const AUTOCOMPLETE_IGNORED_ERRORS = ["unknown interaction", "bad gateway", "service unavailable", "connect timeout", "unknown message"];

const AUTOCOMPLETE_SILENT_ERRORS = ["unknown interaction", "service unavailable"];

const MAX_AUTOCOMPLETE_RESULTS = 24;

const UNIT_OPTION_NAMES = ["unit", "character", "ship"] as const;
type UnitOptionName = (typeof UNIT_OPTION_NAMES)[number];

// Helper Functions

/**
 * Filters autocomplete options based on search term
 * Searches by alias, name prefix, name contains, and then aliases array
 */
function filterAutocomplete(
    arrIn: { isAlias?: boolean; defId?: string; alias?: string; name: string; aliases: string[] }[],
    search: string,
) {
    const searchTerm = search?.toLowerCase() || "";

    // Try prefix match first (most relevant)
    let filtered = arrIn.filter((unit) => {
        if (unit.isAlias) return unit?.alias?.toLowerCase().startsWith(searchTerm);
        return unit?.name?.toLowerCase().startsWith(searchTerm);
    });

    // Fall back to contains match
    if (!filtered.length) {
        filtered = arrIn.filter((unit) => unit.name?.toLowerCase().includes(searchTerm));
    }

    // Fall back to aliases array match
    if (!filtered.length) {
        filtered = arrIn.filter((unit) => unit?.aliases?.some((alias) => alias.toLowerCase() === searchTerm));
    }

    return filtered;
}

/**
 * Logs errors while filtering out common/expected Discord API errors
 */
function logErr(Bot: BotType, errStr: string, useWebhook = false): void {
    if (IGNORED_ERRORS.some((str) => errStr.includes(str))) return;
    logger.error(errStr, useWebhook);
}

/**
 * Checks if an error should be ignored based on common Discord API errors
 */
function isIgnoredError(err: unknown): boolean {
    const errStr = err?.toString().toLowerCase() || "";
    return IGNORED_ERRORS.some((str) => errStr.includes(str.toLowerCase()));
}

/**
 * Sends an error reply to the user based on the interaction state
 */
async function sendErrorReply(Bot: BotType, interaction: BotInteraction, commandName: string): Promise<void> {
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
        logErr(Bot, `[cmd:${commandName}] Error trying to send error message: ${String(e)}`);
    }
}

/**
 * Builds a unit list based on the option name (unit, character, or ship)
 */
function buildUnitList(Bot: BotType, optionName: UnitOptionName, aliases: Array<{ isAlias: boolean; defId: string; alias: string }>) {
    const aliasList = aliases?.map((al) => ({ ...al, isAlias: true })) || [];

    switch (optionName) {
        case "unit":
            return [...aliasList, ...Bot.CharacterNames, ...Bot.ShipNames];
        case "character":
            return [...aliasList.filter((al) => Bot.CharacterNames.some((cn) => cn.defId === al.defId)), ...Bot.CharacterNames];
        case "ship":
            return [...aliasList.filter((al) => Bot.ShipNames.some((sn) => sn.defId === al.defId)), ...Bot.ShipNames];
    }
}

/**
 * Formats unit autocomplete results
 */
function formatUnitResults(units: Array<{ isAlias?: boolean; name: string; defId: string; alias?: string }>) {
    return units
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((unit) => ({
            name: unit.isAlias ? `${unit.name} (${unit.alias})` : unit.name,
            value: unit.defId,
        }));
}

/**
 * Processes autocomplete for unit-related options
 */
function processUnitAutocomplete(
    Bot: BotType,
    focusedOption: { name: string; value: string },
    aliases: Array<{ isAlias: boolean; defId: string; alias: string }>,
) {
    if (!UNIT_OPTION_NAMES.includes(focusedOption.name as UnitOptionName)) {
        return [];
    }

    const unitList = buildUnitList(Bot, focusedOption.name as UnitOptionName, aliases);
    const filtered = filterAutocomplete(unitList, focusedOption.value?.toLowerCase());
    return formatUnitResults(filtered);
}

/**
 * Handles autocomplete interactions
 */
async function handleAutocomplete(Bot: BotType, interaction: BotInteraction, cmd: slashCommand): Promise<void> {
    const focusedOption = interaction.options.getFocused(true);

    // If command has custom autocomplete handler, use it
    if (cmd?.autocomplete && typeof cmd.autocomplete === "function") {
        await cmd.autocomplete(Bot, interaction, focusedOption);
        return;
    }

    // Otherwise, handle default autocomplete
    let filtered: Array<{ name: string; value: string }> = [];

    try {
        const aliases = await getGuildAliases({ cache: cache, guildId: interaction?.guild?.id });

        if (interaction.commandName === "panic") {
            // Process the autocompletions for the /panic command
            const journeyFiltered = filterAutocomplete(Bot.journeyNames, focusedOption.value?.toLowerCase());
            filtered = journeyFiltered.map((unit) => ({ name: unit.name, value: unit.defId }));
        } else if (focusedOption.name === "command") {
            // Process command name autocomplete
            const commands = Bot.commandList.filter((cmdName) => cmdName.toLowerCase().startsWith(focusedOption.value?.toLowerCase()));
            filtered = commands.map((cmd) => ({ name: cmd, value: cmd }));
        } else {
            // Process unit/character/ship autocomplete
            filtered = processUnitAutocomplete(Bot, focusedOption, aliases);
        }
    } catch (err) {
        logErr(Bot, `[interactionCreate, autocomplete, cmd=${interaction.commandName}] Autocomplete error: ${String(err)}`);
        console.error("Autocomplete error details:", err);
    }

    // Send autocomplete response
    try {
        await interaction.respond(filtered.slice(0, MAX_AUTOCOMPLETE_RESULTS));
    } catch (err) {
        const errStr = err?.toString().toLowerCase() || "";
        const ignoredError = AUTOCOMPLETE_IGNORED_ERRORS.find((errType) => errStr.includes(errType));

        if (ignoredError) {
            // Only log non-silent errors
            if (!AUTOCOMPLETE_SILENT_ERRORS.includes(ignoredError)) {
                logErr(Bot, `[interactionCreate, autocomplete, cmd=${interaction.commandName}] Ignoring error: ${ignoredError}`);
            }
        } else {
            // Log unexpected errors
            logErr(Bot, `[interactionCreate, autocomplete, cmd=${interaction.commandName}] Unexpected error: ${String(err)}`);
            console.error("Autocomplete response error:", err);
        }
    }
}

/**
 * Handles chat input command interactions
 */
async function handleChatInputCommand(Bot: BotType, interaction: BotInteraction, cmd: slashCommand): Promise<void> {
    // Load guild settings
    interaction.guildSettings = await getGuildSettings({ cache: cache, guildId: interaction?.guild?.id });

    // Check permissions
    const level = await permLevel(interaction);
    if (level < cmd.commandData.permLevel) {
        await interaction.reply({
            content: "Sorry, but you don't have permission to run that command.",
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    // Load user language settings
    const user = await userReg.getUser(interaction.user.id);
    const selectedLanguage = user?.lang?.language || defaultSettings.language;
    interaction.guildSettings.swgohLanguage = user?.lang?.swgohLanguage || defaultSettings.swgohLanguage;

    interaction.language = Language.getLanguage(selectedLanguage) || Language.getLanguage(defaultSettings.language);
    interaction.swgohLanguage = interaction.guildSettings.swgohLanguage || defaultSettings.swgohLanguage;

    // Execute command
    try {
        await cmd.run(Bot, interaction, { level });
    } catch (err) {
        // Special handling for test command
        if (cmd.commandData.name === "test") {
            console.log(
                `ERROR(inter) (user: ${interaction.user.id}) I broke with ${cmd.commandData.name}: \nOptions: ${inspect(interaction.options, { depth: 5 })} \n${inspect(err, { depth: 5 })}`,
            );
            return;
        }

        // Log the error
        if (isIgnoredError(err)) {
            const firstLine = err?.toString().split("\n")[0] || String(err);
            logErr(Bot, `ERROR(inter) (user: ${interaction.user.id}) I broke with ${cmd.commandData.name}: \n${firstLine}`);
        } else {
            logErr(
                Bot,
                `ERROR(inter) (user: ${interaction.user.id}) I broke with ${cmd.commandData.name}: \nOptions: ${inspect(interaction.options, { depth: 5 })} \n${inspect(err, { depth: 5 })}`,
                true,
            );
        }

        // Send error reply to user
        await sendErrorReply(Bot, interaction, cmd.commandData.name);
    }
}

export default {
    name: Events.InteractionCreate,
    execute: async (Bot: BotType, client: BotClient, interaction: BotInteraction) => {
        // Filter out non-command interactions and bot users
        if (!interaction?.isChatInputCommand() && !interaction.isAutocomplete()) return;
        if (interaction.user.bot) return;

        // Get command
        const cmd = client.slashcmds.get(interaction.commandName);
        if (!cmd) return;

        // Route to appropriate handler
        if (interaction.isChatInputCommand()) {
            await handleChatInputCommand(Bot, interaction, cmd);
        } else if (interaction.isAutocomplete()) {
            await handleAutocomplete(Bot, interaction, cmd);
        }
    },
};
