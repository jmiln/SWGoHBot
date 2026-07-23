import {
    ApplicationCommandOptionType,
    type AutocompleteFocusedOption,
    type AutocompleteInteraction,
    InteractionContextType,
} from "discord.js";
import type Language from "../base/Language.ts";
import Command from "../base/slashCommand.ts";
import {
    type DatacronTargetMatch,
    type DatacronTargetRef,
    findSetsForTarget,
    formatPoolAffix,
    getAllDatacronSets,
    getCurrentDatacronSet,
    getDatacronAbilities,
    getDatacronSet,
    getDatacronTargets,
    resolveTargetName,
    statName,
} from "../modules/datacrons.ts";
import swgohAPI from "../modules/swapi.ts";
import type { DatacronAbilityRef, DatacronSetRef } from "../types/datacron_types.ts";
import type { SWAPILang } from "../types/swapi_types.ts";
import type { AutocompleteContext, CommandContext } from "../types/types.ts";

interface EmbedField {
    name: string;
    value: string;
}
interface DatacronEmbed {
    title?: string;
    description?: string;
    fields?: EmbedField[];
}

// Discord caps: 25 fields and ~6000 chars per embed, 10 embeds per message, 1024 chars per field.
const FIELDS_PER_EMBED = 12;
const MAX_EMBEDS = 10;

/** Discord rejects a field value over 1024 chars; mark a cut rather than chopping mid-sentence. */
function truncate(value: string): string {
    if (!value) return "-";
    return value.length <= 1024 ? value : `${value.slice(0, 1021)}...`;
}

/**
 * Builds the reference embed for a datacron set. Exported so it can be tested without a live
 * interaction. Without `tier`, shows what each tier can boost (target names); with `tier`, shows
 * that tier's full pool with ability text and `{0}` targets filled in.
 *
 * Per the presentation rule, pools are framed as what a tier CAN roll, never as reroll advice.
 */
export function buildDatacronSetEmbeds(
    set: DatacronSetRef,
    tier: number | null,
    textMap: Map<string, string>,
    abilities: Record<string, DatacronAbilityRef>,
    language: Language,
    lang: SWAPILang,
): DatacronEmbed[] {
    const setName = textMap.get(set.nameKey);
    const fields: EmbedField[] = [];

    if (set.expirationTimeMs) {
        const expired = set.expirationTimeMs < Date.now();
        fields.push({
            name: language.get(expired ? "COMMAND_DATACRON_EXPIRED" : "COMMAND_DATACRON_EXPIRES"),
            value: `<t:${Math.floor(set.expirationTimeMs / 1000)}:R>`,
        });
    }
    fields.push({
        name: language.get("COMMAND_DATACRON_REROLLABLE"),
        value: language.get(set.allowReroll ? "COMMAND_DATACRON_YES" : "COMMAND_DATACRON_NO"),
    });

    const shownTiers = tier === null ? set.tiers : set.tiers.filter((t) => t.tier === tier);
    for (const t of shownTiers) {
        const label = t.requiredRelicTier
            ? `${language.get("COMMAND_DATACRON_TIER_LABEL", t.tier)} (${language.get("COMMAND_DATACRON_REQUIRES_RELIC", t.requiredRelicTier)})`
            : language.get("COMMAND_DATACRON_TIER_LABEL", t.tier);

        if (tier === null) {
            // Overview: what this tier can boost. Targets for ability tiers, stat names for stat tiers.
            const targets = [...new Set(t.affixPool.map((o) => resolveTargetName(o.targetRule, lang)).filter(Boolean))];
            const value = targets.length
                ? (targets as string[]).join(", ")
                : language.get("COMMAND_DATACRON_STAT_TIER", t.affixPool.length);
            fields.push({ name: label, value: truncate(value) });
            continue;
        }

        // Detail: ONE FIELD PER OPTION. A tier 9 carries ~10 abilities of 200-500 chars each, so
        // joining them into a single field blew past Discord's 1024-per-field limit and chopped the
        // last ability mid-sentence.
        fields.push({ name: label, value: language.get("COMMAND_DATACRON_POOL_HEADER") });
        for (const opt of t.affixPool) {
            const text = formatPoolAffix(opt, abilities, textMap, lang);
            if (!text) continue;
            const optName = resolveTargetName(opt.targetRule, lang) ?? statName(opt.statType) ?? "-";
            fields.push({ name: optName.slice(0, 256), value: truncate(text) });
        }
    }

    const title = language.get("COMMAND_DATACRON_TITLE", set.setId, setName ?? "");
    const embeds: DatacronEmbed[] = [];
    for (let i = 0; i < fields.length && embeds.length < MAX_EMBEDS; i += FIELDS_PER_EMBED) {
        embeds.push({ fields: fields.slice(i, i + FIELDS_PER_EMBED) });
    }
    if (!embeds.length) embeds.push({ fields: [] });
    embeds[0].title = title;
    if (tier === null) embeds[0].description = `_${language.get("COMMAND_DATACRON_OVERVIEW_HINT")}_`;
    return embeds;
}

export default class Datacron extends Command {
    static readonly metadata = {
        name: "datacron",
        description: "Look up a datacron set, or search which sets can boost a given unit/faction/role",
        category: "Gamedata",
        permLevel: 0,
        contexts: [InteractionContextType.Guild, InteractionContextType.BotDM],
        options: [
            {
                name: "set",
                type: ApplicationCommandOptionType.Integer,
                description: "Which set (defaults to the current one; autocompletes by name)",
                autocomplete: true,
            },
            {
                name: "tier",
                type: ApplicationCommandOptionType.Integer,
                description: "Show everything one tier can roll, with full ability text",
            },
            {
                name: "target",
                type: ApplicationCommandOptionType.String,
                description: "Find which sets can boost a unit, faction, role, or alignment",
                autocomplete: true,
            },
        ],
    };

    constructor() {
        super(Datacron.metadata);
    }

    async run({ interaction, language, swgohLanguage }: CommandContext) {
        const setId = interaction.options.getInteger("set");
        const tier = interaction.options.getInteger("tier");
        const targetInput = interaction.options.getString("target");

        // Target search takes precedence: it's the more specific intent than a set lookup. Resolve
        // it synchronously (in-memory) so an unknown target errors before we defer.
        if (targetInput) {
            const targets = getDatacronTargets(swgohLanguage);
            const chosen = resolveTargetInput(targets, targetInput);
            if (!chosen) {
                return super.error(interaction, language.get("COMMAND_DATACRON_TARGET_NOT_FOUND", targetInput));
            }
            await interaction.deferReply();
            const textMap = await swgohAPI.datacronText(swgohLanguage);
            const embeds = buildTargetSearchEmbeds(chosen.name, findSetsForTarget(chosen.targetRule), textMap, language);
            if (setId !== null || tier !== null) {
                embeds[0].description = `${embeds[0].description ?? ""} ${language.get("COMMAND_DATACRON_TARGET_OVERRIDE")}`.trim();
            }
            return interaction.editReply({ embeds });
        }

        const set = setId === null ? getCurrentDatacronSet() : getDatacronSet(setId);
        if (!set) {
            const available = getAllDatacronSets()
                .map((s) => s.setId)
                .join(", ");
            return super.error(interaction, language.get("COMMAND_DATACRON_SET_NOT_FOUND", available));
        }
        if (tier !== null && !set.tiers.some((t) => t.tier === tier)) {
            return super.error(interaction, language.get("COMMAND_DATACRON_TIER_NOT_FOUND", set.setId, tier));
        }

        await interaction.deferReply();
        const textMap = await swgohAPI.datacronText(swgohLanguage);
        const embeds = buildDatacronSetEmbeds(set, tier, textMap, getDatacronAbilities(), language, swgohLanguage);
        return interaction.editReply({ embeds });
    }

    async autocomplete(interaction: AutocompleteInteraction, focused: AutocompleteFocusedOption, context: AutocompleteContext) {
        const query = focused.value?.toString().toLowerCase() ?? "";
        if (focused.name === "target") {
            return interaction.respond(buildTargetChoices(getDatacronTargets(context.swgohLanguage), query));
        }
        const sets = await getSetChoices(context.swgohLanguage);
        return interaction.respond(buildSetChoices(sets, query, context.language.get("COMMAND_DATACRON_EXPIRED_MARK")));
    }
}

/** One selectable set for the picker. */
export interface SetChoice {
    id: number;
    name: string;
    expired: boolean;
}

// Set names only change when the game adds a set (a dataUpdater run), so cache them per language
// rather than hitting Mongo on every autocomplete keystroke. Expiry is recomputed per call since it
// is time-based, not data-based.
const cachedSetNames = new Map<SWAPILang, Map<number, string>>();
async function getSetChoices(lang: SWAPILang): Promise<SetChoice[]> {
    let names = cachedSetNames.get(lang);
    if (!names) {
        const textMap = await swgohAPI.datacronText(lang);
        names = new Map(getAllDatacronSets().map((s) => [s.setId, textMap.get(s.nameKey) ?? ""]));
        cachedSetNames.set(lang, names);
    }
    const now = Date.now();
    return getAllDatacronSets().map((s) => ({
        id: s.setId,
        name: names.get(s.setId) ?? "",
        expired: !!s.expirationTimeMs && s.expirationTimeMs < now,
    }));
}

/**
 * Builds the autocomplete choices as "32 - Necessary Means", matched by set number OR name so a
 * player who only knows the name can find it. Expired sets are marked and sorted below the active
 * ones - most sets on file are long expired, and an unmarked picker makes a dead set look current.
 * Exported for testing. Falls back to "Set N" only when a name is genuinely missing.
 */
export function buildSetChoices(sets: SetChoice[], query: string, expiredMark: string): { name: string; value: number }[] {
    return sets
        .filter((s) => !query || String(s.id).includes(query) || s.name.toLowerCase().includes(query))
        .sort((a, b) => Number(a.expired) - Number(b.expired) || b.id - a.id)
        .slice(0, 25)
        .map((s) => ({
            name: `${s.name ? `${s.id} - ${s.name}` : `Set ${s.id}`}${s.expired ? ` (${expiredMark})` : ""}`.slice(0, 100),
            value: s.id,
        }));
}

/**
 * Autocomplete choices for the target search, matched by display name. The choice value is the
 * exact targetRule so the search is unambiguous even when two targets share a name. Exported for
 * testing.
 */
export function buildTargetChoices(targets: DatacronTargetRef[], query: string): { name: string; value: string }[] {
    return targets
        .filter((t) => !query || t.name.toLowerCase().includes(query))
        .sort((a, b) => a.name.localeCompare(b.name))
        .slice(0, 25)
        .map((t) => ({ name: t.name.slice(0, 100), value: t.targetRule.slice(0, 100) }));
}

/**
 * Resolves the raw `target:` input to a known target. Prefers an exact targetRule (what autocomplete
 * sends), then an exact name, then a name substring so a typed-but-not-selected value still lands.
 * Exported for testing.
 */
export function resolveTargetInput(targets: DatacronTargetRef[], input: string): DatacronTargetRef | null {
    const q = input.trim().toLowerCase();
    return (
        targets.find((t) => t.targetRule === input) ??
        targets.find((t) => t.name.toLowerCase() === q) ??
        targets.find((t) => t.name.toLowerCase().includes(q)) ??
        null
    );
}

/**
 * Builds the target-search result: one field per set that can boost the target, showing the tiers
 * (with relic requirements) where it can. Active sets first, expired below and marked, consistent
 * with the picker. Per the presentation rule this states what CAN boost a target, never reroll
 * advice. Exported for testing.
 */
export function buildTargetSearchEmbeds(
    targetName: string,
    matches: DatacronTargetMatch[],
    textMap: Map<string, string>,
    language: Language,
): DatacronEmbed[] {
    const title = language.get("COMMAND_DATACRON_TARGET_TITLE", targetName);
    if (!matches.length) {
        return [{ title, description: language.get("COMMAND_DATACRON_TARGET_NONE", targetName) }];
    }

    const now = Date.now();
    const expired = (m: DatacronTargetMatch) => !!m.set.expirationTimeMs && m.set.expirationTimeMs < now;
    const sorted = [...matches].sort((a, b) => Number(expired(a)) - Number(expired(b)) || b.set.setId - a.set.setId);

    const fields: EmbedField[] = sorted.map((m) => {
        const setName = textMap.get(m.set.nameKey);
        const heading = `${language.get("COMMAND_DATACRON_TITLE", m.set.setId, setName ?? "")}${
            expired(m) ? ` (${language.get("COMMAND_DATACRON_EXPIRED_MARK")})` : ""
        }`;
        const tierLabels = m.tiers.map((n) => {
            const relic = m.set.tiers.find((t) => t.tier === n)?.requiredRelicTier;
            const label = language.get("COMMAND_DATACRON_TIER_LABEL", n);
            return relic ? `${label} (${language.get("COMMAND_DATACRON_REQUIRES_RELIC", relic)})` : label;
        });
        return { name: heading.slice(0, 256), value: truncate(tierLabels.join(", ") || "-") };
    });

    const embeds: DatacronEmbed[] = [];
    for (let i = 0; i < fields.length && embeds.length < MAX_EMBEDS; i += FIELDS_PER_EMBED) {
        embeds.push({ fields: fields.slice(i, i + FIELDS_PER_EMBED) });
    }
    embeds[0].title = title;
    embeds[0].description = `_${language.get("COMMAND_DATACRON_TARGET_HINT")}_`;
    return embeds;
}
