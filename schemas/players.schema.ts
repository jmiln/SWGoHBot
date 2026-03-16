import { z } from "zod";

const ArenaSquadMemberSchema = z.object({
    id: z.string(),
    defId: z.string(),
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
    roster: z.array(z.unknown()), // SWAPIUnit has many optional fields; unknown enforces narrowing before use
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
    roster: z.array(z.unknown()).optional(), // Processed roster — differs from raw SWAPIUnit shape
});

// Export inferred types
export type RawPlayer = z.infer<typeof RawPlayerSchema>;
export type PlayerStats = z.infer<typeof PlayerStatsSchema>;
