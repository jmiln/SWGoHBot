import { type Client, Events } from "discord.js";
import config from "../config.js";
import databaseCleanup from "../modules/databaseCleanup.ts";
import eventFuncs from "../modules/eventFuncs.ts";
import eventSocket from "../modules/eventSocket.ts";
import { getShardId, isMain } from "../modules/functions.ts";
import logger from "../modules/Logger.ts";
import patreonFuncs from "../modules/patreonFuncs.ts";

// Constants
const MAX_CONSECUTIVE_FAILURES = 5;
const MINUTE_MS = 60 * 1000;
const STARTUP_DELAY_MS = 2 * MINUTE_MS;
const PRESENCE_NAME = "swgohbot.com";

// Track intervals for cleanup
const activeIntervals: NodeJS.Timeout[] = [];

/**
 * Clears all active intervals on shard shutdown
 */
function cleanupIntervals(): void {
    logger.log(`[ClientReady] Cleaning up ${activeIntervals.length} active intervals`);
    for (const intervalId of activeIntervals) {
        clearInterval(intervalId);
    }
    activeIntervals.length = 0;
}

export default {
    name: Events.ClientReady,
    execute: async (client: Client<true>) => {
        const shardId = getShardId(client);

        // Initialize the logger with the shard ID
        logger.init(shardId);

        // Validate bot configuration - must be private bot unless authorized
        const application = client.application;
        if (!isMain(client) && application.botPublic && application.owner.id !== config.ownerid) {
            logger.error(
                Buffer.from(
                    "RkFUQUwgRVJST1I6IElOVkFMSUQgQk9UIFNFVFVQCgpHbyB0byB5b3VyIEJvdCdzIGFwcGxpY2F0aW9uIHBhZ2UgaW4gRGlzY29yZCBEZXZlbG9wZXJzIHNpdGUgYW5kIGRpc2FibGUgdGhlICJQdWJsaWMgQm90IiBvcHRpb24uCgpQbGVhc2UgY29udGFjdCB0aGUgc3VwcG9ydCB0ZWFtIGF0IFNXR29IQm90IEhRIC0gaHR0cHM6Ly9kaXNjb3JkLmdnL0Zmd0d2aHIgLSBmb3IgbW9yZSBpbmZvcm1hdGlvbi4=",
                    "base64",
                ).toString("utf-8"),
            );
            if (client.shard) {
                await client.shard.broadcastEval((client) => client.destroy());
            } else {
                process.exit();
            }
            return null;
        }

        let readyString = `${client.user.username} is ready to serve in ${client.guilds.cache.size} servers.`;

        if (client.shard) {
            readyString += ` Shard #${shardId}`;

            eventSocket.connect(shardId);
            setupBackgroundTasks(client, shardId);
        }

        logger.log(readyString, "ready", true);
        setPresence(client);
    },
};

/**
 * Sets up background tasks for arena tracking, guild updates, and event checking
 */
function setupBackgroundTasks(client: Client<true>, shardId: number): void {
    // Shard 0 handles data updates and arena tracking
    if (shardId === 0) {
        setupDatabaseCleanup(shardId);
        if (config.premium) {
            setupDataUpdateTasks(shardId);
        }
    }

    // Last shard handles event checking so we can guarantee they're all loaded
    if (shardId + 1 === client.shard.count) {
        setupEventChecking(shardId);
    }
}

/**
 * Sets up periodic data update tasks (arena ranks, guild tickets, etc.)
 */
function setupDataUpdateTasks(shardId: number): void {
    setTimeout(() => {
        const intervalId = setInterval(async () => {
            try {
                // Run every minute
                await patreonFuncs.getRanks();
                await patreonFuncs.shardRanks();

                const currentMinute = new Date().getMinutes();

                // Run every 5 minutes
                if (currentMinute % 5 === 0) {
                    await patreonFuncs.shardTimes();
                    await patreonFuncs.guildTickets();
                }

                // Run hourly
                if (currentMinute === 0) {
                    await patreonFuncs.guildsUpdate();
                }
            } catch (err) {
                const message = err instanceof Error ? err.message : String(err);
                logger.error(`[${shardId}] Error in data update tasks: ${message}`);
            }
        }, MINUTE_MS);

        activeIntervals.push(intervalId);
    }, STARTUP_DELAY_MS);
}

/**
 * Sets up automated database cleanup (runs daily on shard 0)
 */
function setupDatabaseCleanup(shardId: number): void {
    logger.log(`[${shardId}] Setting up automated database cleanup (24hr interval)`);

    // Start the cleanup scheduler
    databaseCleanup.start(24);
}

/**
 * Sets up periodic event checking via socket connection
 */
function setupEventChecking(shardId: number): void {
    let consecutiveFailures = 0;

    const intervalId = setInterval(async () => {
        if (!eventSocket.isConnected()) {
            consecutiveFailures++;
            if (consecutiveFailures === MAX_CONSECUTIVE_FAILURES) {
                logger.warn(`  [${shardId}] EventMgr not connected, skipping event checks (will retry silently)`);
            }
            return;
        }

        try {
            const eventsList = await eventSocket.checkEvents();
            consecutiveFailures = 0;

            if (eventsList.length > 0) {
                eventFuncs.manageEvents(eventsList);
            }
        } catch (err) {
            consecutiveFailures++;
            if (consecutiveFailures <= MAX_CONSECUTIVE_FAILURES) {
                const message = err instanceof Error ? err.message : String(err);
                logger.error(`  [${shardId}] Error checking events: ${message}`);
            }
        }
    }, MINUTE_MS);

    activeIntervals.push(intervalId);
}

/**
 * Sets the bot's Discord presence/status
 */
function setPresence(client: Client<true>): void {
    try {
        client.user.setPresence({
            activities: [{ name: PRESENCE_NAME, type: 0 }],
        });
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logger.error(`[Ready] Error setting presence: ${message}`);
    }
}

export { cleanupIntervals };
