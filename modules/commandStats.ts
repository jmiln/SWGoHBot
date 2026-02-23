/**
 * Command Statistics Tracking Module
 *
 * Provides functions to record and analyze command usage statistics.
 * Stats are stored in MongoDB for analysis and reporting.
 */

import type { ChatInputCommandInteraction } from "discord.js";
import { env } from "../config/config.ts";
import type { CommandStats } from "../schemas/index.ts";
import database from "./database.ts";
import logger from "./Logger.ts";

// Collection name
const COLLECTION_NAME = "commandStats";

// Configuration
const ENABLE_TRACKING = process.env.COMMAND_STATS_ENABLED !== "false"; // Enabled by default
const BATCH_SIZE = 100;
const FLUSH_INTERVAL_MS = 60000; // Flush every 60 seconds

// In-memory batch for performance
let statsBatch: CommandStats[] = [];
let flushTimeout: NodeJS.Timeout | null = null;

/**
 * Records a command execution
 * Batches writes for performance
 */
export async function recordCommandUsage(interaction: ChatInputCommandInteraction, executionTime?: number, error?: Error): Promise<void> {
    if (!ENABLE_TRACKING) return;

    try {
        // Extract command details
        const commandName = interaction.commandName;
        const subcommandGroup = interaction.options.getSubcommandGroup(false);
        const subcommand = interaction.options.getSubcommand(false);

        // Extract options (limited to name/type/value for privacy)
        const options = interaction.options.data.map((opt) => ({
            name: opt.name,
            type: opt.type,
            value: opt.value as string | number | boolean,
        }));

        // Build stats document
        const stats: CommandStats = {
            commandName,
            subcommandGroup: subcommandGroup || undefined,
            subcommand: subcommand || undefined,
            count: 1,
            options: options.length > 0 ? options : undefined,
            userId: interaction.user.id,
            guildId: interaction.guildId || undefined,
            channelId: interaction.channelId,
            timestamp: Date.now(),
            executionTime,
            success: !error,
            errorType: error ? error.constructor.name : undefined,
            shardId: interaction.client.shard?.ids[0],
        };

        // Add to batch
        statsBatch.push(stats);

        // Flush if batch is full
        if (statsBatch.length >= BATCH_SIZE) {
            await flushStats();
        } else {
            // Schedule flush if not already scheduled
            if (!flushTimeout) {
                flushTimeout = setTimeout(() => flushStats(), FLUSH_INTERVAL_MS);
            }
        }
    } catch (err) {
        // Don't let tracking errors break command execution
        logger.error(`[commandStats] Error recording command usage: ${String(err)}`);
    }
}

/**
 * Flushes the current batch of stats to the database
 */
async function flushStats(): Promise<void> {
    if (statsBatch.length === 0) return;

    // Clear timeout if it exists
    if (flushTimeout) {
        clearTimeout(flushTimeout);
        flushTimeout = null;
    }

    // Get current batch and reset
    const batchToFlush = [...statsBatch];
    statsBatch = [];

    try {
        const db = database.getClient().db(env.MONGODB_SWGOHBOT_DB);
        const collection = db.collection<CommandStats>(COLLECTION_NAME);

        // Insert batch
        await collection.insertMany(batchToFlush, { ordered: false });

        logger.debug(`[commandStats] Flushed ${batchToFlush.length} command stats`);
    } catch (err) {
        // Log but don't throw - we don't want to break the app for stats
        logger.error(`[commandStats] Error flushing stats batch: ${String(err)}`);

        // Put failed batch back for retry
        statsBatch.unshift(...batchToFlush);
    }
}

/**
 * Gets aggregated command usage statistics for a time period
 */
export async function getCommandStats(startTime: number, endTime: number): Promise<Map<string, number>> {
    try {
        const db = database.getClient().db(env.MONGODB_SWGOHBOT_DB);
        const collection = db.collection<CommandStats>(COLLECTION_NAME);

        // Aggregate stats by command path
        const pipeline = [
            {
                $match: {
                    timestamp: { $gte: startTime, $lte: endTime },
                },
            },
            {
                $group: {
                    _id: {
                        commandName: "$commandName",
                        subcommand: "$subcommand",
                    },
                    count: { $sum: "$count" },
                },
            },
        ];

        const results = await collection.aggregate(pipeline).toArray();

        // Build command path map
        const statsMap = new Map<string, number>();
        for (const result of results) {
            const commandPath = result._id.subcommand ? `${result._id.commandName}.${result._id.subcommand}` : result._id.commandName;
            statsMap.set(commandPath, result.count);
        }

        return statsMap;
    } catch (err) {
        logger.error(`[commandStats] Error getting command stats: ${String(err)}`);
        return new Map();
    }
}

/**
 * Gets top N most used commands for a time period
 */
export async function getTopCommands(startTime: number, endTime: number, limit = 10): Promise<Array<{ command: string; count: number }>> {
    try {
        const db = database.getClient().db(env.MONGODB_SWGOHBOT_DB);
        const collection = db.collection<CommandStats>(COLLECTION_NAME);

        const pipeline = [
            {
                $match: {
                    timestamp: { $gte: startTime, $lte: endTime },
                },
            },
            {
                $group: {
                    _id: "$commandName",
                    count: { $sum: "$count" },
                },
            },
            {
                $sort: { count: -1 },
            },
            {
                $limit: limit,
            },
        ];

        const results = await collection.aggregate(pipeline).toArray();

        return results.map((result) => ({
            command: result._id,
            count: result.count,
        }));
    } catch (err) {
        logger.error(`[commandStats] Error getting top commands: ${String(err)}`);
        return [];
    }
}

/**
 * Force flush any pending stats (call on shutdown)
 */
export async function shutdown(): Promise<void> {
    if (flushTimeout) {
        clearTimeout(flushTimeout);
        flushTimeout = null;
    }
    await flushStats();
}

export default {
    recordCommandUsage,
    getCommandStats,
    getTopCommands,
    shutdown,
};
