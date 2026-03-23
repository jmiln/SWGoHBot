import { z } from "zod";

/**
 * Schema for guild alias entries
 */
export const GuildAliasSchema = z.object({
    alias: z.string(),
    defId: z.string(),
});

/**
 * Schema for guild configuration settings
 */
export const GuildConfigSettingsSchema = z.object({
    useEventPages: z.boolean().optional(),
    adminRole: z.array(z.string()),
    enableWelcome: z.boolean(),
    welcomeMessage: z.string(),
    enablePart: z.boolean(),
    partMessage: z.string(),
    timezone: z.string(),
    announceChan: z.string(),
    eventCountdown: z.array(z.number()),
    language: z.string(),
    swgohLanguage: z.string(),
    shardtimeVertical: z.boolean(),
});

/**
 * Schema for shard times entries
 */
export const GuildConfigShardTimesSchema = z.object({
    times: z.record(
        z.string(),
        z.object({
            flag: z.string(),
            type: z.string(),
            timezone: z.union([z.number(), z.string()]),
            zoneType: z.string(),
        }),
    ),
    channelId: z.string(),
});

/**
 * Schema for patreon settings
 */
export const GuildConfigPatreonSettingsSchema = z.object({
    supporters: z.array(
        z.object({
            userId: z.string(),
            tier: z.number(),
        }),
    ),
});

/**
 * Schema for guild events
 */
export const GuildConfigEventSchema = z.object({
    name: z.string(),
    eventDT: z.number(),
    message: z.string(),
    channel: z.string(),
    countdown: z.boolean(),
    repeat: z
        .object({
            repeatDay: z.number(),
            repeatMin: z.number(),
            repeatHour: z.number(),
        })
        .optional(),
    repeatDays: z.array(z.number()).optional(),
    // eventDT input fields that get processed
    day: z.string().optional(),
    time: z.string().optional(),
    repeatStr: z.string().optional(),
    repeatDay: z.string(),
    channelID: z.string().optional(), // Deprecated field
    guildId: z.string().optional(),
    isCD: z.boolean().optional(),
});

/**
 * Schema for guild polls
 */
export const GuildConfigPollSchema = z.object({
    question: z.string(),
    options: z.array(z.string()),
    votes: z.record(z.string(), z.number()), // userId: choiceIndex
    anon: z.boolean().nullable(),
    channelId: z.string(),
});

/**
 * Schema for territory war list
 */
export const GuildConfigTWListSchema = z.object({
    "Light Side": z.array(z.string()).optional(),
    "Dark Side": z.array(z.string()).optional(),
    "Galactic Legends": z.array(z.string()).optional(),
    Ships: z.array(z.string()).optional(),
    "Capital Ships": z.array(z.string()).optional(),
    Blacklist: z.array(z.string()).optional(),
});

/**
 * Schema for an individual strike record
 */
export const StrikeSchema = z.object({
    id: z.string(),
    reason: z.string(),
    issuedBy: z.string(),
    issuedAt: z.number(),
    expiresAt: z.number().optional(),
    removedAt: z.number().optional(),
    removedBy: z.string().optional(),
});

/**
 * Schema for a player's strike record within a guild config
 */
export const PlayerStrikesSchema = z.object({
    allyCode: z.number(),
    playerName: z.string(),
    guildId: z.string(),
    guildName: z.string(),
    strikes: z.array(StrikeSchema),
});

/**
 * Schema for guild configuration documents (guildConfigs collection)
 */
export const GuildConfigSchema = z.object({
    guildId: z.string(),
    events: z.array(GuildConfigEventSchema),
    polls: z.array(GuildConfigPollSchema),
    shardTimes: z.array(GuildConfigShardTimesSchema),
    settings: GuildConfigSettingsSchema,
    aliases: z.array(GuildAliasSchema),
    patreonSettings: GuildConfigPatreonSettingsSchema,
    twList: GuildConfigTWListSchema,
    strikes: z.array(PlayerStrikesSchema).default([]),
});

// Export inferred types
export type GuildConfig = z.infer<typeof GuildConfigSchema>;
export type GuildConfigSettings = z.infer<typeof GuildConfigSettingsSchema>;
export type GuildConfigShardTimes = z.infer<typeof GuildConfigShardTimesSchema>;
export type GuildConfigPatreonSettings = z.infer<typeof GuildConfigPatreonSettingsSchema>;
export type GuildConfigEvent = z.infer<typeof GuildConfigEventSchema>;
export type GuildConfigPoll = z.infer<typeof GuildConfigPollSchema>;
export type GuildConfigTWList = z.infer<typeof GuildConfigTWListSchema>;
export type GuildAlias = z.infer<typeof GuildAliasSchema>;
