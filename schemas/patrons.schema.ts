import { z } from "zod";

/**
 * Schema for patron user documents (patrons collection)
 */
export const PatronUserSchema = z.object({
    guild: z.string().optional(),
    userId: z.string(),
    playerTime: z.number(),
    guildTime: z.number(),
    awAccounts: z.number(),
    discordID: z.string(),
    amount_cents: z.number(),
    declined_since: z.string().optional(),
});

/**
 * Schema for active patron data (subset of PatronUser)
 */
export const ActivePatronSchema = z.object({
    discordID: z.string(),
    amount_cents: z.number(),
    declined_since: z.string().optional(),
});

// Export inferred types
export type PatronUser = z.infer<typeof PatronUserSchema>;
export type ActivePatron = z.infer<typeof ActivePatronSchema>;
