import { z } from "zod";

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
    roster: z.array(z.any()), // Full roster schema would be very large
    updated: z.number(),
    arena: z.object({
        char: z.object({
            rank: z.number(),
            squad: z.array(z.any()),
        }).optional(),
        ship: z.object({
            rank: z.number(),
            squad: z.array(z.any()),
        }).optional(),
    }).optional(),
    stats: z.array(z.any()).optional(),
    grandArena: z.any().optional(),
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
    stats: z.any().optional(), // Processed stats object
    roster: z.array(z.any()).optional(),
});

// Export inferred types
export type RawPlayer = z.infer<typeof RawPlayerSchema>;
export type PlayerStats = z.infer<typeof PlayerStatsSchema>;
