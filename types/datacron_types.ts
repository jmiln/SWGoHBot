/**
 * Datacron types, shared across the pipeline (dataUpdater), the swapi player mapper,
 * and the /datacron + /mydatacrons commands.
 *
 * Storage split (hybrid, decided 2026-07-21): the STRUCTURAL data below lives in
 * data/datacrons.json (small, held in memory like characters.json); the localized
 * ability/name TEXT lives in Mongo via processLocalization, read back by language.
 */

/** A single affix on a player-owned datacron, after mapping from the comlink payload. */
export interface DatacronAffix {
    /** e.g. "target_datacron_darkside"; undefined for stat-only affixes. */
    targetRule?: string;
    /** e.g. "datacron_alignment_generic_003"; undefined for stat-only affixes. */
    abilityId?: string;
    statType?: number;
    /** Already converted from the game's scaled-integer string; still needs de-scaling for display. */
    statValue?: number;
    requiredUnitTier?: number;
    requiredRelicTier?: number;
}

/** A datacron owned by a player, as mapped from the comlink payload. */
export interface PlayerDatacron {
    id: string;
    setId: number;
    templateId: string;
    tag: string[];
    locked: boolean;
    focused: boolean;
    affix: DatacronAffix[];
    rerollIndex?: number;
    rerollCount?: number;
}

/** One possible affix in a tier's roll pool (reference data, not a player's actual roll). */
export interface DatacronAffixOption {
    targetRule?: string;
    abilityId?: string;
    statType?: number;
    /** Scaled-integer roll bounds; de-scale for display. */
    statValueMin?: number;
    statValueMax?: number;
    minTier?: number;
    maxTier?: number;
}

export interface DatacronTierRef {
    /** 1-indexed as the game sends it; the base (tier 0) has no affixes and is omitted. */
    tier: number;
    requiredUnitTier?: number;
    requiredRelicTier?: number;
    affixPool: DatacronAffixOption[];
}

export interface DatacronSetRef {
    setId: number;
    /** Localization key (e.g. "DATACRON_SET_31_NAME"); resolved to text at read time from Mongo. */
    nameKey: string;
    expirationTimeMs?: number;
    /**
     * Whether the set can be rerolled at all. The game's maxRerolls field is always 0 (no usable
     * cap), so it is intentionally not stored; only this boolean carries a signal.
     */
    allowReroll: boolean;
    tiers: DatacronTierRef[];
}

/** Localization-key references for one datacron ability, sourced from gameData.ability. */
export interface DatacronAbilityRef {
    /** Scope/mechanic name key, e.g. "DATACRON_ALIGNMENT_MECHANIC_NAME". */
    nameKey: string;
    /** Ability description key, e.g. "DATACRON_ALIGNMENT_GENERIC_003_DESC". */
    descKey: string;
}

export interface DatacronFile {
    sets: DatacronSetRef[];
    /**
     * abilityId -> its localization keys. Lets both the affix pools (in this file) and a player's
     * live-fetched affixes resolve ability text from the Mongo `datacrons` collection at read time.
     */
    abilities: Record<string, DatacronAbilityRef>;
}
