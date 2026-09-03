import type { AutocompleteInteraction } from "discord.js";
import type Language from "../../base/Language.ts";
import type slashCommand from "../../base/slashCommand.ts";
import {
    characterNameList,
    factionChoicesFor,
    factions,
    journeyNames,
    localeTagFor,
    localizedUnitName,
    shipNameList,
} from "../../data/constants/units.ts";
import { getCachedAllyCodeChoices, getCachedGuildAliases, getCachedUserLang } from "../../modules/autocompleteCache.ts";
import logger from "../../modules/Logger.ts";
import type { SWAPILang } from "../../types/swapi_types.ts";
import type { GuildAlias } from "../../types/types.ts";
import { getCommandNames } from "../slashHandler.ts";
import { logErr } from "./errors.ts";

// Constants
// "already been acknowledged" (DiscordAPIError 40060) mirrors the guard in chatInput.ts:
// a shard replay / duplicate gateway delivery means the first handler already responded,
// so the second respond is expected noise rather than a real failure.
// Commands whose faction option is a category id fed to a db query, rather than a display name.
const CATEGORY_ID_FACTION_COMMANDS = ["faction", "need"];

const AUTOCOMPLETE_IGNORED_ERRORS = [
    "unknown interaction",
    "already been acknowledged",
    "bad gateway",
    "service unavailable",
    "connect timeout",
    "unknown message",
];

const AUTOCOMPLETE_SILENT_ERRORS = ["unknown interaction", "already been acknowledged", "service unavailable"];

const MAX_AUTOCOMPLETE_RESULTS = 24;

// Discord rejects a choice name over 100 chars, which fails the whole response. Reachable with a
// long alias beside a long localized name.
const MAX_CHOICE_NAME_LENGTH = 100;

const UNIT_OPTION_NAMES = ["unit", "character", "ship"] as const;
type UnitOptionName = (typeof UNIT_OPTION_NAMES)[number];

// Type for unit autocomplete items
export interface UnitAutocompleteItem {
    name: string;
    defId: string;
    aliases: string[];
    isAlias?: boolean;
    alias?: string;
    isGL?: boolean;
}

// Helper Functions

/**
 * Filters autocomplete options based on search term
 * Searches by alias, name prefix, name contains, and then aliases array
 *
 * Each tier matches the localized name or the English one, so English names from the wikis still
 * work for a user reading a localized picker.
 */
export function filterAutocomplete(
    arrIn: UnitAutocompleteItem[],
    search: string,
    lang: SWAPILang = "eng_us",
    nameMap?: Record<string, Record<string, string>>,
) {
    const searchTerm = search?.toLowerCase() || "";
    const displayOf = (unit: UnitAutocompleteItem) => localizedUnitName(unit.defId, unit.name, lang, nameMap).toLowerCase();

    // Try prefix match first (most relevant)
    let filtered = arrIn.filter((unit) => {
        if (unit.isAlias) return unit?.alias?.toLowerCase().startsWith(searchTerm);
        return displayOf(unit).startsWith(searchTerm) || unit?.name?.toLowerCase().startsWith(searchTerm);
    });

    // Fall back to contains match
    if (!filtered.length) {
        filtered = arrIn.filter((unit) => displayOf(unit).includes(searchTerm) || unit.name?.toLowerCase().includes(searchTerm));
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
 *
 * The (GL) suffix comes from the language file, since localizing by defId drops the one baked into
 * the English name. Sorting is on the localized name, so it happens after the mapping.
 */
export function formatUnitResults(
    units: UnitAutocompleteItem[],
    lang: SWAPILang = "eng_us",
    language?: Language,
    nameMap?: Record<string, Record<string, string>>,
) {
    const suffix = language?.get("BASE_GL_SUFFIX") ?? "(GL)";
    const displayed = units.map((unit) => {
        const base = localizedUnitName(unit.defId, unit.name, lang, nameMap);
        const withSuffix = unit.isGL ? `${base} ${suffix}` : base;
        const name = unit.isAlias ? `${withSuffix} (${unit.alias})` : withSuffix;
        return {
            name: name.slice(0, MAX_CHOICE_NAME_LENGTH),
            value: unit.defId,
        };
    });
    const collator = new Intl.Collator(localeTagFor(lang));
    return displayed.sort((a, b) => collator.compare(a.name, b.name));
}

/**
 * Processes autocomplete for unit-related options
 */
export function processUnitAutocomplete(
    focusedOption: { name: string; value: string },
    aliases: GuildAlias[],
    lang: SWAPILang = "eng_us",
    language?: Language,
    nameMap?: Record<string, Record<string, string>>,
) {
    if (!UNIT_OPTION_NAMES.includes(focusedOption.name as UnitOptionName)) {
        return [];
    }

    const unitList = buildUnitList(focusedOption.name as UnitOptionName, aliases);
    const filtered = filterAutocomplete(unitList, focusedOption.value?.toLowerCase(), lang, nameMap);
    return formatUnitResults(filtered, lang, language, nameMap);
}

/**
 * Handles autocomplete interactions
 */
export async function handleAutocomplete(interaction: AutocompleteInteraction, cmd: slashCommand): Promise<void> {
    const focusedOption = interaction.options.getFocused(true);

    let filtered: Array<{ name: string; value: string }> = [];

    try {
        // Inside the try: interactionCreate.ts does not catch, so a failure here must not leave the
        // interaction unanswered.
        const context = await getCachedUserLang(interaction.user.id, interaction?.guild?.id);
        const { swgohLanguage, language } = context;

        if (cmd?.autocomplete && typeof cmd.autocomplete === "function") {
            await cmd.autocomplete(interaction, focusedOption, context);
            return;
        }

        if (interaction.commandName === "panic") {
            // Process the autocompletions for the /panic command
            const journeyFiltered = filterAutocomplete(
                journeyNames as UnitAutocompleteItem[],
                focusedOption.value?.toLowerCase(),
                swgohLanguage,
            );
            filtered = formatUnitResults(journeyFiltered, swgohLanguage, language);
        } else if (focusedOption.name === "command") {
            // Process command name autocomplete
            const commandNames = getCommandNames();
            const commands = commandNames.filter((cmdName) => cmdName.toLowerCase().startsWith(focusedOption.value?.toLowerCase()));
            filtered = commands.map((cmd) => ({ name: cmd, value: cmd }));
        } else if (focusedOption.name === "faction") {
            // Process faction autocomplete
            const searchKey = focusedOption.value?.trim().toLowerCase() || "";

            if (CATEGORY_ID_FACTION_COMMANDS.includes(interaction.commandName)) {
                // These query the db by category id, so the value has to be the id rather than the
                // display name.
                filtered = factionChoicesFor(swgohLanguage).filter((faction) => faction.name.toLowerCase().includes(searchKey));
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
            // Process unit/character/ship autocomplete - the only path that needs guild
            // aliases, served from a short-TTL cache so typing doesn't re-query per keystroke
            const aliases = await getCachedGuildAliases(interaction?.guild?.id);
            filtered = processUnitAutocomplete(focusedOption, aliases, swgohLanguage, language);
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
