import { z } from "zod";

// Payout instant (ms) of the cycle a warn/result alert was last sent for, per arena. Stored per
// recipient (each watcher has their own warn minute) so one watcher's alert can't suppress another's.
const AlertedCyclesSchema = z.object({
    charWarn: z.number().optional(),
    fleetWarn: z.number().optional(),
    charResult: z.number().optional(),
    fleetResult: z.number().optional(),
});

/**
 * Lean watch-config entry - player data lives in arenaPlayers collection
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
    // Per-cycle payout warn/result markers for this watcher's channel alerts
    alerted: AlertedCyclesSchema.optional(),
    // Rank last successfully announced to this watcher's channel, per arena. Channel rank alerts
    // compare against this (not the shared observed rank) so a failed send or skipped tick is
    // recovered by the next alert covering the whole span, rather than being silently dropped.
    lastCharAnnounced: z.number().optional(),
    lastShipAnnounced: z.number().optional(),
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
        // Per-cycle DM warn/result markers, keyed by ally code (a user can link several accounts,
        // each with its own payout instant). Kept per-user so a shared account doesn't collide.
        alerted: z.record(z.string(), AlertedCyclesSchema).optional(),
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
    bonusServer: z.string().nullable().optional(),
    patreonAmountCents: z.number().optional(),
});
