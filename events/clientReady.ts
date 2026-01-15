import { io } from "socket.io-client";
import { Events } from "discord.js";
import config from "../config.js";
import logger from "../modules/Logger.ts";
import { SocketHelper } from "../modules/socketHelper.ts";
import type { BotClient, BotType } from "../types/types.ts";

// Constants
const ERROR_THROTTLE_MS = 60000; // Log errors at most once per minute
const MAX_CONSECUTIVE_FAILURES = 5;
const MINUTE_MS = 60 * 1000;
const STARTUP_DELAY_MS = 2 * MINUTE_MS;
const PRESENCE_NAME = "swgohbot.com";

// Socket.io connection configuration
const SOCKET_CONFIG = {
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 30000,
    timeout: 5000,
};

export default {
    name: Events.ClientReady,
    execute: async (Bot: BotType, client: BotClient) => {
        Bot.shardId = client.shard.ids[0];

        // Initialize the logger with the shard ID
        logger.init(Bot.shardId);

        // Validate bot configuration - must be private bot unless authorized
        const application = client.application;
        if (!Bot.isMain() && application.botPublic && application.owner.id !== config.ownerid) {
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

        Bot.commandList = [...client.slashcmds.keys()];

        let readyString = `${client.user.username} is ready to serve in ${client.guilds.cache.size} servers.`;

        if (client.shard) {
            readyString += ` Shard #${Bot.shardId}`;

            setupSocketConnection(Bot);
            setupBackgroundTasks(Bot, client);
        }

        logger.log(readyString, "ready", true);
        setPresence(Bot, client);
    },
};

/**
 * Sets up socket.io connection with error handling and throttling
 */
function setupSocketConnection(Bot: BotType): void {
    let lastErrorTime = 0;
    let errorCount = 0;

    Bot.socket = io(`ws://localhost:${config.eventServe.port}`, SOCKET_CONFIG);

    Bot.socket.on("connect", () => {
        console.log(`  [${Bot.shardId}] Connected to EventMgr socket!`);
        errorCount = 0;
    });

    const logThrottledError = (type: string, err?: Error): void => {
        const now = Date.now();
        errorCount++;

        if (now - lastErrorTime > ERROR_THROTTLE_MS) {
            const message = err?.message || "Unknown error";
            console.error(`  [${Bot.shardId}] EventMgr ${type}: ${message} (${errorCount} errors in last minute)`);
            lastErrorTime = now;
            errorCount = 0;
        }
    };

    Bot.socket.on("connect_error", (err) => logThrottledError("connection failed", err));
    Bot.socket.on("reconnect_error", (err) => logThrottledError("reconnect failed", err));
    Bot.socket.on("connect_failed", (err) => logThrottledError("connect failed", err));
    Bot.socket.on("disconnect", (reason) => {
        console.log(`  [${Bot.shardId}] EventMgr disconnected: ${reason}`);
    });
}

/**
 * Sets up background tasks for arena tracking, guild updates, and event checking
 */
function setupBackgroundTasks(Bot: BotType, client: BotClient): void {
    // Shard 0 handles data updates and arena tracking
    if (Bot.shardId === 0 && config.premium) {
        setupDataUpdateTasks(Bot, client);
    }

    // Last shard handles event checking
    if (Bot.shardId + 1 === client.shard.count) {
        setupEventChecking(Bot);
    }
}

/**
 * Sets up periodic data update tasks (arena ranks, guild tickets, etc.)
 */
function setupDataUpdateTasks(Bot: BotType, client: BotClient): void {
    setTimeout(() => {
        setInterval(async () => {
            try {
                // Run every minute
                await Bot.getRanks();
                await Bot.shardRanks();

                const currentMinute = new Date().getMinutes();

                // Run every 5 minutes
                if (currentMinute % 5 === 0) {
                    await Bot.shardTimes();
                    await Bot.guildTickets();
                }

                // Run hourly
                if (currentMinute === 0) {
                    await Bot.guildsUpdate();
                }

                // Reload data files across all shards
                reloadDataFiles(Bot, client);
            } catch (err) {
                const message = err instanceof Error ? err.message : String(err);
                logger.error(`[${Bot.shardId}] Error in data update tasks: ${message}`);
            }
        }, MINUTE_MS);
    }, STARTUP_DELAY_MS);
}

/**
 * Sets up periodic event checking via socket connection
 */
function setupEventChecking(Bot: BotType): void {
    const socketHelper = new SocketHelper(Bot.socket);
    let consecutiveFailures = 0;

    setInterval(async () => {
        if (!socketHelper.isConnected()) {
            consecutiveFailures++;
            if (consecutiveFailures === MAX_CONSECUTIVE_FAILURES) {
                console.warn(`  [${Bot.shardId}] EventMgr not connected, skipping event checks (will retry silently)`);
            }
            return;
        }

        try {
            const eventsList = await socketHelper.checkEvents();
            consecutiveFailures = 0;

            if (eventsList.length > 0) {
                Bot.manageEvents(eventsList);
            }
        } catch (err) {
            consecutiveFailures++;
            if (consecutiveFailures <= MAX_CONSECUTIVE_FAILURES) {
                const message = err instanceof Error ? err.message : String(err);
                console.error(`  [${Bot.shardId}] Error checking events: ${message}`);
            }
        }
    }, MINUTE_MS);
}

/**
 * Reloads data files across all shards or just the current client
 */
function reloadDataFiles(Bot: BotType, client: BotClient): void {
    if (client.shard?.count > 0) {
        client.shard
            .broadcastEval((client: BotClient) => client.reloadDataFiles())
            .catch((err) => {
                const message = err instanceof Error ? err.message : String(err);
                logger.error(`[Ready/ReloadData] Error reloading data files: ${message}`);
            });
    } else {
        client.reloadDataFiles();
    }
}

/**
 * Sets the bot's Discord presence/status
 */
function setPresence(Bot: BotType, client: BotClient): void {
    try {
        client.user.setPresence({
            activities: [{ name: PRESENCE_NAME, type: 0 }],
        });
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logger.error(`[Ready] Error setting presence: ${message}`);
    }
}
