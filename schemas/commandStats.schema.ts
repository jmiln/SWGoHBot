import { z } from "zod";

/**
 * Schema for individual option values used in a command
 */
export const CommandOptionSchema = z.object({
    name: z.string(),
    type: z.number(), // Discord.js ApplicationCommandOptionType enum value
    value: z.union([z.string(), z.number(), z.boolean()]),
});

/**
 * Schema for command usage statistics
 * Tracks every command execution with detailed context
 */
export const CommandStatsSchema = z.object({
    // Command identification
    commandName: z.string(),
    subcommand: z.string().optional(),
    subcommandGroup: z.string().optional(),

    // Usage count (for aggregation)
    count: z.number().default(1),

    // Options used (for detailed analytics)
    options: z.array(CommandOptionSchema).optional(),

    // Context information
    userId: z.string(),
    guildId: z.string().optional(),
    channelId: z.string().optional(),

    // Timing
    timestamp: z.number(), // Unix timestamp in milliseconds
    executionTime: z.number().optional(), // Time taken to execute in ms

    // Success/failure tracking
    success: z.boolean().default(true),
    errorType: z.string().optional(),

    // Metadata
    shardId: z.number().optional(),
});

/**
 * Aggregated command statistics (for reporting)
 */
export const CommandStatsAggregateSchema = z.object({
    // Command path (e.g., "mycharacter", "mycharacter.character", "mycharacter.ship")
    commandPath: z.string(),

    // Total usage count
    totalCount: z.number(),

    // Time period
    periodStart: z.number(),
    periodEnd: z.number(),

    // Breakdown by subcommand (if applicable)
    subcommandCounts: z.record(z.string(), z.number()).optional(),

    // Common options used
    optionUsage: z.record(z.string(), z.number()).optional(),

    // Success rate
    successRate: z.number().optional(),

    // Average execution time
    avgExecutionTime: z.number().optional(),
});

// Export inferred types
export type CommandStats = z.infer<typeof CommandStatsSchema>;
export type CommandOption = z.infer<typeof CommandOptionSchema>;
export type CommandStatsAggregate = z.infer<typeof CommandStatsAggregateSchema>;
