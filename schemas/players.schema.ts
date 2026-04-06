import { z } from "zod";

const ArenaSquadMemberSchema = z.object({
    id: z.string(),
    defId: z.string(),
});

const SWAPIUnitSkillSchema = z.object({
    id: z.string(),
    tier: z.number(),
    tiers: z.number(),
    nameKey: z.string().optional(),
    isZeta: z.boolean().optional(),
    zetaTier: z.number().optional(),
    isOmicron: z.boolean().optional(),
    omicronTier: z.number().optional(),
    omicronMode: z.null().optional(),
    type: z.string().optional(),
    tierStr: z.string().optional(),
    defId: z.string().optional(),
});

const SWAPIModStatSchema = z.object({
    unitStat: z.union([z.number(), z.string()]).optional(),
    unitStatId: z.number().optional(),
    value: z.number(),
});

const SWAPIModSchema = z.object({
    id: z.string(),
    level: z.number(),
    tier: z.number(),
    slot: z.number(),
    set: z.number(),
    pips: z.number(),
    primaryStat: SWAPIModStatSchema,
    secondaryStat: z.array(SWAPIModStatSchema.extend({ roll: z.number() })),
});

const SWAPIUnitStatTypesSchema = z.object({
    Health: z.number(),
    Strength: z.number(),
    Agility: z.number(),
    Intelligence: z.number(),
    Speed: z.number(),
    "Physical Damage": z.number(),
    "Special Damage": z.number(),
    Armor: z.number(),
    Resistance: z.number(),
    "Armor Penetration": z.number(),
    "Dodge Chance": z.number(),
    "Deflection Chance": z.number(),
    "Physical Critical Chance": z.number(),
    "Special Critical Chance": z.number(),
    "Critical Damage": z.number(),
    Potency: z.number(),
    Tenacity: z.number(),
    "Health Steal": z.number(),
    Protection: z.number(),
    "Physical Accuracy": z.number(),
    "Special Accuracy": z.number(),
    Accuracy: z.number(),
    "Physical Critical Avoidance": z.number(),
    "Special Critical Avoidance": z.number(),
});

const SWAPIUnitStatsSchema = z.object({
    final: SWAPIUnitStatTypesSchema,
    mods: SWAPIUnitStatTypesSchema,
    gp: z.number(),
});

const SWAPIPlayerCrewSchema = z.object({
    skillReferenceList: z.array(
        z.object({
            skillId: z.string(),
            requiredTier: z.number(),
            requiredRarity: z.number(),
            requiredRelicTier: z.number(),
        }),
    ),
    unitId: z.string(),
    slot: z.number(),
});

/**
 * Zod schema for SWAPIUnit — matches the SWAPIUnit interface in types/swapi_types.ts.
 * Includes optional fields that are added during processing (stats, mods, zetas, omicrons, etc.).
 */
export const SWAPIUnitSchema = z.object({
    id: z.string(),
    name: z.string().optional(),
    defId: z.string(),
    nameKey: z.string(),
    gear: z.number(),
    equipped: z.array(z.object({ equipmentId: z.number(), slot: z.number() })),
    factions: z.array(z.string()).optional(),
    skills: z.array(SWAPIUnitSkillSchema),
    mods: z.array(SWAPIModSchema).optional(),
    stats: SWAPIUnitStatsSchema.optional(),
    relic: z.union([z.object({ currentTier: z.number() }), z.null()]),
    purchasedAbilityId: z.array(z.string()),
    crew: z.union([z.array(SWAPIPlayerCrewSchema), z.null()]),
    combatType: z.union([z.literal(1), z.literal(2)]),
    gp: z.number().optional(),
    level: z.number(),
    rarity: z.number(),
    zetas: z.array(SWAPIUnitSkillSchema).optional(),
    omicrons: z.array(SWAPIUnitSkillSchema).optional(),
    player: z.string().optional(),
    allyCode: z.number().optional(),
    updated: z.number().optional(),
    unitTierList: z.array(z.object({ tier: z.number(), equipmentSetList: z.array(z.string()) })).optional(),
});

/**
 * Simplified schema for raw player documents (rawPlayers collection)
 * Full SWAPIPlayer type is extensive; this covers the most important fields
 */
export const RawPlayerSchema = z.object({
    allyCode: z.number(),
    name: z.string(),
    level: z.number(),
    guildName: z.string().optional(),
    guildId: z.string().optional(),
    roster: z.array(SWAPIUnitSchema),
    updated: z.number(),
    arena: z
        .object({
            char: z
                .object({
                    rank: z.number(),
                    squad: z.array(ArenaSquadMemberSchema),
                })
                .optional(),
            ship: z
                .object({
                    rank: z.number(),
                    squad: z.array(ArenaSquadMemberSchema),
                })
                .optional(),
        })
        .optional(),
    stats: z.array(z.object({ nameKey: z.string(), value: z.number() })).optional(),
    grandArena: z.null().optional(),
    warnings: z.array(z.string()).optional(),
});

/**
 * Simplified schema for processed player stats (playerStats collection)
 */
export const PlayerStatsSchema = z.object({
    allyCode: z.number(),
    updated: z.number(),
    name: z.string().optional(),
    level: z.number().optional(),
    guildName: z.string().optional(),
    stats: z.array(z.object({ nameKey: z.string(), value: z.number() })).optional(),
    roster: z.array(SWAPIUnitSchema).optional(),
});

// Export inferred types
export type RawPlayer = z.infer<typeof RawPlayerSchema>;
export type PlayerStats = z.infer<typeof PlayerStatsSchema>;
