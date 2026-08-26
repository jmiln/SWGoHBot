import { type Client, Events, Status } from "discord.js";
import { env } from "../config/config.ts";
import eventFuncs from "../modules/eventFuncs.ts";
import eventSocket from "../modules/eventSocket.ts";
import { getShardId, isMain } from "../modules/functions.ts";
import logger from "../modules/Logger.ts";
import patreonFuncs from "../modules/patreonFuncs.ts";
import patreonSync from "../modules/patreonSync.ts";
import { HEARTBEAT_INTERVAL_MS, type ShardHeartbeat, type ShardStatusName } from "../modules/shardStatus/registry.ts";

// Constants
const MAX_CONSECUTIVE_FAILURES = 5;
const MINUTE_MS = 60 * 1000;
const STARTUP_DELAY_MS = 2 * MINUTE_MS;
const PRESENCE_NAME = "swgohbot.com";

// Track intervals for cleanup
const activeIntervals: NodeJS.Timeout[] = [];

const BYTES_PER_MB = 1024 * 1024;

/**
 * The discord.js statuses the registry distinguishes. Everything else is in-flight connection
 * setup, which it treats as not-ready without needing a name of its own.
 */
function toShardStatusName(status: Status | undefined): ShardStatusName {
    switch (status) {
        case Status.Ready:
            return "ready";
        case Status.Reconnecting:
            return "reconnecting";
        case Status.Idle:
            return "idle";
        case undefined:
            return "unknown";
        default:
            return "connecting";
    }
}

function buildHeartbeat(client: Client<true>, shardId: number): ShardHeartbeat {
    // This shard's own WebSocketShard rather than the manager average, so a fleet of several shards
    // does not report one blended ping for all of them.
    const ws = client.ws.shards.get(shardId);
    return {
        shardId,
        status: toShardStatusName(ws?.status),
        pingMs: ws ? Math.round(ws.ping) : null,
        guilds: client.guilds.cache.size,
        uptimeMs: client.uptime ?? 0,
        memoryRssMb: Math.round(process.memoryUsage().rss / BYTES_PER_MB),
    };
}

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
        if (!isMain(client) && application?.botPublic && application.owner && application.owner.id !== env.DISCORD_OWNER_ID) {
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

            setupHeartbeat(client, shardId);
            setupBackgroundTasks(client, shardId);
        }

        logger.log(readyString, "ready", true);
        setPresence(client);
    },
};

/**
 * Reports this shard's own state up to the manager on an interval.
 *
 * Level-sampled, unlike the manager's lifecycle events: when this stops arriving, the manager can
 * see a wedged shard that never emitted a death event. The payload is built here, in the shard's
 * own scope, and sent as plain data - never through broadcastEval, whose callbacks run in a foreign
 * context where these imports do not exist.
 */
function setupHeartbeat(client: Client<true>, shardId: number): void {
    const intervalId = setInterval(() => {
        try {
            client.shard?.send({ type: "shardHeartbeat", payload: buildHeartbeat(client, shardId) });
        } catch (err) {
            logger.error(`[${shardId}] Heartbeat send failed: ${err instanceof Error ? err.message : String(err)}`);
        }
    }, HEARTBEAT_INTERVAL_MS);

    activeIntervals.push(intervalId);
}

/**
 * Sets up background tasks for arena tracking, guild updates, and event checking
 */
function setupBackgroundTasks(client: Client<true>, shardId: number): void {
    // Shard 0 handles data updates and arena tracking
    if (shardId === 0) {
        if (env.PREMIUM) {
            setupDataUpdateTasks(shardId);
        }
    }

    // Last shard handles event checking so we can guarantee they're all loaded
    if (client.shard && shardId + 1 === client.shard.count) {
        setupEventChecking(shardId);
    }
}

/**
 * Sets up periodic data update tasks (arena ranks, guild tickets, etc.)
 */
function setupDataUpdateTasks(shardId: number): void {
    let isRunning = false;
    let lastGuildsUpdateHour = -1;

    // arenaTick has its own interval/guard because it has to land on a specific
    // once-per-day-per-account minute to record payout history. If it shared the
    // isRunning guard below, a slow shardTimes/guildTickets/guildsUpdate run would
    // drop the following minute's arenaTick - and since the daily payout cycle and
    // the polling interval are exact multiples of each other, that dropped minute
    // recurs at the same point every day, permanently blinding whichever accounts'
    // payout falls on it.
    let arenaTickRunning = false;

    setTimeout(() => {
        const arenaTickIntervalId = setInterval(async () => {
            if (arenaTickRunning) return;
            arenaTickRunning = true;
            try {
                await patreonFuncs.arenaTick();
            } catch (err) {
                const message = err instanceof Error ? err.message : String(err);
                logger.error(`[${shardId}] Error in arenaTick: ${message}`);
                logger.error(err instanceof Error ? err.stack : String(err));
            } finally {
                arenaTickRunning = false;
            }
        }, MINUTE_MS);

        activeIntervals.push(arenaTickIntervalId);

        const intervalId = setInterval(async () => {
            if (isRunning) return;
            isRunning = true;
            try {
                const now = new Date();
                const currentMinute = now.getMinutes();
                const currentHour = now.getHours();

                // Run every 5 minutes
                if (currentMinute % 5 === 0) {
                    await patreonFuncs.shardTimes();
                    await patreonFuncs.guildTickets();
                }

                // Sync Patreon supporter info every 15 minutes
                if (currentMinute % 15 === 0) {
                    await patreonSync.updatePatrons();
                }

                // Run hourly - guard against re-running if isRunning resets within the same minute
                if (currentMinute === 0 && currentHour !== lastGuildsUpdateHour) {
                    lastGuildsUpdateHour = currentHour;
                    await patreonFuncs.guildsUpdate();
                }
            } catch (err) {
                const message = err instanceof Error ? err.message : String(err);
                logger.error(`[${shardId}] Error in data update tasks: ${message}`);
                logger.error(err instanceof Error ? err.stack : String(err));
            } finally {
                isRunning = false;
            }
        }, MINUTE_MS);

        activeIntervals.push(intervalId);
    }, STARTUP_DELAY_MS);
}

/**
 * Sets up periodic event checking via socket connection
 */
function setupEventChecking(shardId: number): void {
    let consecutiveFailures = 0;

    const intervalId = setInterval(async () => {
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
