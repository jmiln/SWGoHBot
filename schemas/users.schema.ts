import { z } from "zod";

/**
 * Schema for arena watch account entries
 */
export const ArenaWatchAcctSchema = z.object({
    allyCode: z.number(),
    name: z.string(),
    mention: z.string(),
    lastChar: z.number(),
    lastShip: z.number(),
    poOffset: z.number(),
    mark: z.string().optional(),
    warn: z
        .object({
            min: z.number().optional(),
            arena: z.string().optional(),
        })
        .optional(),
    result: z.string().optional(),
    lastCharChange: z.number().optional(),
    lastShipChange: z.number().optional(),
    // Temporary fields added during processing
    duration: z.number().optional(),
    timeTil: z.string().optional(),
    outString: z.string().optional(),
});

/**
 * Schema for user account entries
 */
export const UserAcctSchema = z.object({
    allyCode: z.string(),
    name: z.string(),
    primary: z.boolean(),
    lastCharRank: z.number().optional(),
    lastCharClimb: z.number().optional(),
    lastShipRank: z.number().optional(),
    lastShipClimb: z.number().optional(),
});

/**
 * Schema for user configuration documents (users collection)
 */
export const UserConfigSchema = z.object({
    id: z.string(),
    accounts: z.array(UserAcctSchema),
    arenaAlert: z.object({
        enableRankDMs: z.string(),
        arena: z.string(),
        payoutWarning: z.number(),
        enablePayoutResult: z.boolean(),
        payoutResult: z.string().optional(),
    }),
    updated: z.number(),
    lang: z.object({
        language: z.string().optional(),
        swgohLanguage: z.string().optional(),
    }),
    arenaWatch: z.object({
        enabled: z.boolean(),
        allycodes: z.array(ArenaWatchAcctSchema),
        channel: z.string().optional(),
        arena: z.object({
            fleet: z.object({ channel: z.string(), enabled: z.boolean() }).optional(),
            char: z.object({ channel: z.string(), enabled: z.boolean() }).optional(),
        }),
        payout: z.object({
            char: z.object({ enabled: z.boolean(), channel: z.string(), msgID: z.string() }),
            fleet: z.object({ enabled: z.boolean(), channel: z.string(), msgID: z.string() }),
        }),
        useEmotesInLog: z.boolean().optional(),
        useMarksInLog: z.boolean().optional(),
        report: z.string(),
        showvs: z.boolean(),
    }),
    guildUpdate: z.object({
        enabled: z.boolean(),
        channel: z.string(),
        allycode: z.number(),
        sortBy: z.string(),
    }),
    username: z.string(),
    guildTickets: z.object({
        enabled: z.boolean(),
        channel: z.string(),
        allycode: z.number(),
        sortBy: z.string(),
        msgId: z.string(),
        tickets: z.number(),
        updateType: z.string(),
        nextChallengesRefresh: z.string(),
        showMax: z.boolean(),
    }),
    bonusServer: z.string(),
});

// Export inferred types
export type UserConfig = z.infer<typeof UserConfigSchema>;
export type UserAcct = z.infer<typeof UserAcctSchema>;
export type ArenaWatchAcct = z.infer<typeof ArenaWatchAcctSchema>;
