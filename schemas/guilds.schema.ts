import { z } from "zod";

/**
 * Schema for guild member entries
 */
export const GuildMemberSchema = z.object({
    allyCode: z.number(),
    name: z.string(),
    level: z.number().optional(),
    gp: z.number().optional(),
    gpChar: z.number().optional(),
    gpShip: z.number().optional(),
});

/**
 * Simplified schema for raw guild documents (rawGuilds collection)
 */
export const RawGuildSchema = z.object({
    id: z.string(),
    name: z.string(),
    desc: z.string().optional(),
    members: z.number(),
    gp: z.number(),
    roster: z.array(GuildMemberSchema),
    updated: z.number(),
    raid: z.any().optional(),
    territoryBattleResult: z.array(z.any()).optional(),
    territoryWarResult: z.array(z.any()).optional(),
});

/**
 * Simplified schema for processed guild documents (guilds collection)
 */
export const GuildSchema = z.object({
    id: z.string(),
    name: z.string(),
    desc: z.string().optional(),
    members: z.number(),
    gp: z.number(),
    updated: z.number(),
    roster: z.array(GuildMemberSchema).optional(),
    warnings: z.array(z.string()).optional(),
});

// Export inferred types
export type RawGuild = z.infer<typeof RawGuildSchema>;
export type Guild = z.infer<typeof GuildSchema>;
export type GuildMember = z.infer<typeof GuildMemberSchema>;
