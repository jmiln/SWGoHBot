import { z } from "zod";

/**
 * Schema for arena watch account entries
 */
export const ArenaWatchAcctSchema = z.object({
    allyCode: z.number(),
    name: z.string(),
    mention: z.string().nullable(),
    lastChar: z.number(),
    lastShip: z.number(),
    poOffset: z.number(),
    mark: z.string().optional().nullable(),
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
        enableRankDMs: z.string().optional(),
        arena: z.string(),
        payoutWarning: z.number(),
        enablePayoutResult: z.boolean().optional(),
        payoutResult: z.string().optional(),
    }),
    updated: z.number(),
    lang: z
        .object({
            language: z.string().optional(),
            swgohLanguage: z.string().optional(),
        })
        .optional(),
    arenaWatch: z.object({
        enabled: z.boolean(),
        allyCodes: z.array(ArenaWatchAcctSchema),
        channel: z.string().optional().nullable(),
        arena: z.object({
            fleet: z.object({ channel: z.string(), enabled: z.boolean() }).optional(),
            char: z.object({ channel: z.string(), enabled: z.boolean() }).optional(),
        }),
        payout: z.object({
            char: z.object({
                enabled: z.boolean(),
                channel: z.string().nullable(),
                msgID: z.string().nullable(),
            }),
            fleet: z.object({
                enabled: z.boolean(),
                channel: z.string().nullable(),
                msgID: z.string().nullable(),
            }),
        }),
        useEmotesInLog: z.boolean().optional(),
        useMarksInLog: z.boolean().optional(),
        report: z.string().optional(),
        showvs: z.boolean().optional(),
    }),
    guildUpdate: z
        .object({
            enabled: z.boolean(),
            channel: z.string(),
            allyCode: z.number(),
            sortBy: z.string(),
        })
        .partial()
        .optional(),
    username: z.string().optional(),
    guildTickets: z
        .object({
            enabled: z.boolean(),
            channel: z.string(),
            allyCode: z.number(),
            sortBy: z.string(),
            msgId: z.string(),
            tickets: z.number(),
            updateType: z.string(),
            nextChallengesRefresh: z.string(),
            showMax: z.boolean(),
        })
        .partial()
        .optional(),
    bonusServer: z.string().optional(),
    patreonAmountCents: z.number().optional(),
});

// Export inferred types
export type UserConfig = z.infer<typeof UserConfigSchema>;
export type UserAcct = z.infer<typeof UserAcctSchema>;
export type ArenaWatchAcct = z.infer<typeof ArenaWatchAcctSchema>;
