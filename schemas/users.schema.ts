import { z } from "zod";

/**
 * Lean watch-config entry — player data lives in arenaPlayers collection
 */
export const ArenaWatchConfigSchema = z.object({
    allyCode: z.number(),
    // mention/poOffset may be absent: the migration omits null/missing values rather than
    // writing nulls, and arenaTick backfills poOffset from the API on the next pass
    mention: z.string().nullable().optional(),
    poOffset: z.number().optional(),
    mark: z.string().optional().nullable(),
    warn: z
        .object({
            min: z.number().optional(),
            arena: z.string().optional(),
        })
        .optional(),
    result: z.string().optional(),
});

export type ArenaWatchConfig = z.infer<typeof ArenaWatchConfigSchema>;

/**
 * Schema for user configuration documents (users collection)
 */
export const UserConfigSchema = z.object({
    id: z.string(),
    accounts: z.array(z.number()),
    primaryAllyCode: z.number().nullable().optional(),
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
        allyCodes: z.array(ArenaWatchConfigSchema),
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
