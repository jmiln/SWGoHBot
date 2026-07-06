import type { AutocompleteInteraction } from "discord.js";
import type slashCommand from "../../base/slashCommand.ts";
import { characterNameList, factions, journeyNames, shipNameList } from "../../data/constants/units.ts";
import factionMap from "../../data/factionMap.ts";
import { getCachedAllyCodeChoices, getCachedGuildAliases } from "../../modules/autocompleteCache.ts";
import logger from "../../modules/Logger.ts";
import type { GuildAlias } from "../../types/types.ts";
import { getCommandNames } from "../slashHandler.ts";
import { logErr } from "./errors.ts";

// Constants
const AUTOCOMPLETE_IGNORED_ERRORS = ["unknown interaction", "bad gateway", "service unavailable", "connect timeout", "unknown message"];

const AUTOCOMPLETE_SILENT_ERRORS = ["unknown interaction", "service unavailable"];

const MAX_AUTOCOMPLETE_RESULTS = 24;

const UNIT_OPTION_NAMES = ["unit", "character", "ship"] as const;
type UnitOptionName = (typeof UNIT_OPTION_NAMES)[number];

// Type for unit autocomplete items
export interface UnitAutocompleteItem {
    name: string;
    defId: string;
    aliases: string[];
    isAlias?: boolean;
    alias?: string;
}

// Helper Functions

/**
 * Filters autocomplete options based on search term
 * Searches by alias, name prefix, name contains, and then aliases array
 */
export function filterAutocomplete(arrIn: UnitAutocompleteItem[], search: string) {
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
 * Builds a unit list based on the option name (unit, character, or ship)
 */
export function buildUnitList(optionName: UnitOptionName, aliases: GuildAlias[]): UnitAutocompleteItem[] {
    const aliasList: UnitAutocompleteItem[] = aliases?.map((al) => ({ ...al, isAlias: true, aliases: [] })) || [];

    switch (optionName) {
        case "unit":
            return [...aliasList, ...characterNameList, ...shipNameList];
        case "character":
            return [...aliasList.filter((al) => characterNameList.some((cn) => cn.defId === al.defId)), ...characterNameList];
        case "ship":
            return [...aliasList.filter((al) => shipNameList.some((sn) => sn.defId === al.defId)), ...shipNameList];
    }
}

/**
 * Formats unit autocomplete results
 */
export function formatUnitResults(units: UnitAutocompleteItem[]) {
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
export function processUnitAutocomplete(focusedOption: { name: string; value: string }, aliases: GuildAlias[]) {
    if (!UNIT_OPTION_NAMES.includes(focusedOption.name as UnitOptionName)) {
        return [];
    }

    const unitList = buildUnitList(focusedOption.name as UnitOptionName, aliases);
    const filtered = filterAutocomplete(unitList, focusedOption.value?.toLowerCase());
    return formatUnitResults(filtered);
}

/**
 * Handles autocomplete interactions
 */
export async function handleAutocomplete(interaction: AutocompleteInteraction, cmd: slashCommand): Promise<void> {
    const focusedOption = interaction.options.getFocused(true);

    // If command has custom autocomplete handler, use it
    if (cmd?.autocomplete && typeof cmd.autocomplete === "function") {
        await cmd.autocomplete(interaction, focusedOption);
        return;
    }

    // Otherwise, handle default autocomplete
    let filtered: Array<{ name: string; value: string }> = [];

    try {
        if (interaction.commandName === "panic") {
            // Process the autocompletions for the /panic command
            const journeyFiltered = filterAutocomplete(journeyNames as UnitAutocompleteItem[], focusedOption.value?.toLowerCase());
            filtered = journeyFiltered.map((unit) => ({ name: unit.name, value: unit.defId }));
        } else if (focusedOption.name === "command") {
            // Process command name autocomplete
            const commandNames = getCommandNames();
            const commands = commandNames.filter((cmdName) => cmdName.toLowerCase().startsWith(focusedOption.value?.toLowerCase()));
            filtered = commands.map((cmd) => ({ name: cmd, value: cmd }));
        } else if (focusedOption.name === "faction") {
            // Process faction autocomplete
            const searchKey = focusedOption.value?.trim().toLowerCase() || "";

            if (interaction.commandName === "faction") {
                // Use factionMap for /faction command (needs database query values)
                filtered = factionMap
                    .filter((faction) => faction.name.toLowerCase().includes(searchKey))
                    .map((faction) => ({
                        name: faction.name,
                        value: faction.value,
                    }));
            } else {
                // Use factions array for other commands (like grandarena)
                filtered = factions
                    .filter((faction) => faction.toLowerCase().includes(searchKey))
                    .map((faction) => ({
                        name: faction,
                        value: faction.toLowerCase(),
                    }));
            }
        } else if (focusedOption.name === "allycode" || focusedOption.name.startsWith("allycode_")) {
            // Process allycode autocomplete - show user's registered allycodes.
            // Served from a short-TTL cache so only the first keystroke hits the DB.
            const searchKey = focusedOption.value?.trim().toLowerCase() || "";
            filtered = await getCachedAllyCodeChoices(interaction.user.id, searchKey);
        } else {
            // Process unit/character/ship autocomplete — the only path that needs guild
            // aliases, served from a short-TTL cache so typing doesn't re-query per keystroke
            const aliases = await getCachedGuildAliases(interaction?.guild?.id);
            filtered = processUnitAutocomplete(focusedOption, aliases);
        }
    } catch (err) {
        logErr(`[interactionCreate, autocomplete, cmd=${interaction.commandName}] Autocomplete error: ${String(err)}`);
        logger.error(`Autocomplete error details: ${String(err)}`);
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
                logErr(`[interactionCreate, autocomplete, cmd=${interaction.commandName}] Ignoring error: ${ignoredError}`);
            }
        } else {
            // Log unexpected errors
            logErr(`[interactionCreate, autocomplete, cmd=${interaction.commandName}] Unexpected error: ${String(err)}`);
            logger.error(`Autocomplete response error: ${String(err)}`);
        }
    }
}
