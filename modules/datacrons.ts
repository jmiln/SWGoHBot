import { unitNameOf } from "../data/constants/units.ts";
import factionMap from "../data/factionMap.ts";
import type { DatacronAbilityRef, DatacronAffix, DatacronAffixOption, DatacronFile, DatacronSetRef } from "../types/datacron_types.ts";
import type { SWAPILang } from "../types/swapi_types.ts";
import { readJSON } from "./functions.ts";
import { flatStats } from "./swapi.ts";

// Loaded the same way as the other data/*.json reference files (see modules/swapi.ts).
const file = await readJSON<DatacronFile>(`${import.meta.dirname}/../data/datacrons.json`);
const setsById = new Map(file.sets.map((s) => [s.setId, s]));

const unitMap = await readJSON<Record<string, unknown>>(`${import.meta.dirname}/../data/unitMap.json`);
const unitDefIds = new Set(Object.keys(unitMap).map((k) => k.toUpperCase()));

// A datacron affix targetRule is `target_datacron_<suffix>`. Most suffixes are a unit defId or a
// faction/role/alignment category; these are the ones whose suffix does not match either directly.
const TARGET_UNIT_ALIASES: Record<string, string> = {
    generalgrievous: "GRIEVOUS",
    darthmaul: "MAUL",
    c3p0: "C3POLEGENDARY",
    aurrasing: "AURRA_SING",
    barrisoffee: "BARRISSOFFEE",
    ahsokatano_snips: "AHSOKATANO",
    luminara: "LUMINARAUNDULI",
    olddaka: "DAKA",
    hunter: "BADBATCHHUNTER",
};
const TARGET_NAME_ALIASES: Record<string, string> = {
    darkside: "Dark Side",
    lightside: "Light Side",
    galacticrepublic: "Galactic Republic",
    inquisitorius: "Inquisitorius",
    pirates: "Pirates",
    rebel: "Rebel",
    mercenary: "Mercenary",
    ufu: "Unaligned Force User",
};
// factionMap value "affiliation_badbatch" -> keyed by both "badbatch" and "affiliationbadbatch".
const factionNameBySuffix = new Map<string, string>();
for (const f of factionMap) {
    factionNameBySuffix.set(f.value.replace(/^[^_]+_/, ""), f.name);
    factionNameBySuffix.set(f.value.replace(/_/g, ""), f.name);
}

/**
 * Resolves an affix targetRule (e.g. "target_datacron_darkside") to a readable target name, used to
 * fill the `{0}` placeholder in datacron ability text. Units resolve to their localized name;
 * factions/roles/alignments to their category name. Falls back to a title-cased suffix so a target
 * we don't recognize still reads as words, never as the raw id.
 */
export function resolveTargetName(targetRule: string | undefined, lang: SWAPILang = "eng_us"): string | null {
    if (!targetRule) return null;
    const suffix = targetRule.replace(/^target_datacron_/, "");
    const defId = TARGET_UNIT_ALIASES[suffix] ?? suffix.toUpperCase().replace(/-/g, "_");
    if (unitDefIds.has(defId)) return unitNameOf(defId, lang);
    if (TARGET_NAME_ALIASES[suffix]) return TARGET_NAME_ALIASES[suffix];
    const faction = factionNameBySuffix.get(suffix);
    if (faction) return faction;
    return suffix.replace(/[_-]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Fills a datacron text template's `{0}` (the target) with the resolved target name. */
function fillTarget(text: string, targetRule: string | undefined, lang: SWAPILang): string {
    const name = resolveTargetName(targetRule, lang);
    return name ? text.replace(/\{0\}/g, name) : text.replace(/\s*\{0\}\s*/g, " ").trim();
}

/**
 * Display names for the stat types that appear in datacron affixes. Datacron-scoped on purpose:
 * BASE_MODS_FROM_GAME (mod-flavored, e.g. "Defense %") does not cover all of these and reads oddly
 * here. English for v1 - the localization weight is in the ability descriptions, which come from
 * Mongo. All of these are percentage stats.
 */
const DATACRON_STAT_NAMES: Record<number, string> = {
    16: "Critical Damage",
    17: "Potency",
    18: "Tenacity",
    25: "Armor Penetration",
    26: "Resistance Penetration",
    27: "Health Steal",
    48: "Offense",
    49: "Defense",
    53: "Critical Chance",
    54: "Critical Avoidance",
    55: "Health",
    56: "Protection",
};

export function getDatacronSet(setId: number): DatacronSetRef | null {
    return setsById.get(setId) ?? null;
}

export function getAllDatacronSets(): DatacronSetRef[] {
    return file.sets;
}

/** abilityId -> its localization keys, for resolving live-fetched player affixes against Mongo text. */
export function getDatacronAbilities(): Record<string, DatacronAbilityRef> {
    return file.abilities;
}

/**
 * Converts the game's scaled-integer stat value into a display number.
 * Reuses the scaling rule from modules/swapi.ts:690. Returns null for absent or zero values so
 * ability affixes (which carry statValue 0) do not render a meaningless "+0".
 */
export function descaleStatValue(statValue: number | undefined, statType: number | undefined): number | null {
    if (!statValue || !statType) return null;
    return statValue / (flatStats.includes(statType) ? 1e8 : 1e6);
}

/** Display name for a datacron stat type, or null if it is not one we render. */
export function statName(statType: number | undefined): string | null {
    if (statType == null) return null;
    return DATACRON_STAT_NAMES[statType] ?? null;
}

/**
 * Formats one player-owned affix as a display line.
 *
 * Ability affixes (with an abilityId) show the game's own localized description, sourced from the
 * Mongo `datacrons` text map; the internal ability id and loc keys are never shown. Stat affixes
 * show a de-scaled percentage with the stat name. `textMap` and `abilities` are injected so this
 * stays pure and testable.
 */
/**
 * Localized text for an ability affix: its description with the `{0}` target filled in, falling back
 * to the mechanic name. `targetRule` and `lang` resolve the target that the game text templates on.
 */
function abilityText(
    abilityId: string,
    targetRule: string | undefined,
    abilities: Record<string, DatacronAbilityRef>,
    textMap: Map<string, string>,
    lang: SWAPILang,
): string | null {
    const ref = abilities[abilityId];
    if (!ref) return null;
    const raw = textMap.get(ref.descKey) ?? textMap.get(ref.nameKey);
    return raw ? fillTarget(raw, targetRule, lang) : null;
}

function pct(value: number): string {
    return `+${Number(value.toFixed(2))}%`;
}

export function formatPlayerAffix(
    affix: DatacronAffix,
    abilities: Record<string, DatacronAbilityRef>,
    textMap: Map<string, string>,
    lang: SWAPILang = "eng_us",
): string {
    if (affix.abilityId) return abilityText(affix.abilityId, affix.targetRule, abilities, textMap, lang) ?? "";

    const value = descaleStatValue(affix.statValue, affix.statType);
    const name = statName(affix.statType);
    if (value == null) return name ?? "";
    return name ? `${pct(value)} ${name}` : pct(value);
}

/**
 * Formats one affix OPTION from a tier's roll pool (reference data with min/max ranges).
 * Ability options show the game's localized description; stat options show a de-scaled range.
 */
export function formatPoolAffix(
    opt: DatacronAffixOption,
    abilities: Record<string, DatacronAbilityRef>,
    textMap: Map<string, string>,
    lang: SWAPILang = "eng_us",
): string {
    if (opt.abilityId) return abilityText(opt.abilityId, opt.targetRule, abilities, textMap, lang) ?? "";

    const min = descaleStatValue(opt.statValueMin, opt.statType);
    const max = descaleStatValue(opt.statValueMax, opt.statType);
    const name = statName(opt.statType);
    if (min == null || max == null) return name ?? "";
    const range = min === max ? pct(max) : `${pct(min)} to ${pct(max)}`;
    return name ? `${range} ${name}` : range;
}

/** The newest non-expired set, or the highest-numbered set if all are expired. Used as the default. */
export function getCurrentDatacronSet(): DatacronSetRef | null {
    const now = Date.now();
    const active = file.sets.filter((s) => !s.expirationTimeMs || s.expirationTimeMs > now);
    const pool = active.length ? active : file.sets;
    return pool.reduce<DatacronSetRef | null>((best, s) => (best && best.setId > s.setId ? best : s), null);
}
