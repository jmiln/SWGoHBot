import { io } from "socket.io-client";
import { SocketHelper } from "../modules/socketHelper.ts";
import type { BotClient, BotType } from "../types/types.ts";
// const checkWSHealth = require("../modules/wsWatcher.js");

export default {
    name: "clientReady",
    execute: async (Bot: BotType, client: BotClient) => {
        // Logs that it's up, and some extra info
        Bot.shardId = client.shard.ids[0];

        const application = client.application;
        if (!Bot.isMain() && application.botPublic && application.owner.id !== "124579977474736129") {
            Bot.logger.error(
                Buffer.from(
                    "RkFUQUwgRVJST1I6IElOVkFMSUQgQk9UIFNFVFVQCgpHbyB0byB5b3VyIEJvdCdzIGFwcGxpY2F0aW9uIHBhZ2UgaW4gRGlzY29yZCBEZXZlbG9wZXJzIHNpdGUgYW5kIGRpc2FibGUgdGhlICJQdWJsaWMgQm90IiBvcHRpb24uCgpQbGVhc2UgY29udGFjdCB0aGUgc3VwcG9ydCB0ZWFtIGF0IFNXR29IQm90IEhRIC0gaHR0cHM6Ly9kaXNjb3JkLmdnL0Zmd0d2aHIgLSBmb3IgbW9yZSBpbmZvcm1hdGlvbi4=",
                    "base64",
                ).toString("utf-8"),
            );
            if (client.shard) await client.shard.broadcastEval((client) => client.destroy());
            else process.exit();
            return null;
        }

        // Grab a list of all the command names
        Bot.commandList = [...client.slashcmds.keys()];

        let readyString = `${client.user.username} is ready to serve in ${client.guilds.cache.size} servers.`;
        if (client.shard) {
            readyString = `${client.user.username} is ready to serve in ${client.guilds.cache.size} servers. Shard #${Bot.shardId}`;

            // Track last error time to throttle error messages
            let lastErrorTime = 0;
            let errorCount = 0;
            const ERROR_THROTTLE_MS = 60000; // Only log errors once per minute

            // Connect the sockets and such with limited reconnection attempts
            Bot.socket = io(`ws://localhost:${Bot.config.eventServe.port}`, {
                reconnection: true,
                reconnectionAttempts: 10,
                reconnectionDelay: 1000,
                reconnectionDelayMax: 30000,
                timeout: 5000,
            });

            Bot.socket.on("connect", () => {
                console.log(`  [${Bot.shardId}] Connected to EventMgr socket!`);
                errorCount = 0; // Reset error count on successful connection
            });

            const logThrottledError = (type: string, err?: Error) => {
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

            // Start up the client.ws watcher
            if (Bot.shardId === 0) {
                // Deploy all commands in case anything's been updated (Should just do this manually as needed)
                // setTimeout(
                //     async () => {
                //         await Bot.deployCommands();
                //     },
                //     1 * 60 * 1000,
                // );

                // Reload the patrons' goh data, and check for arena rank changes every minute
                if (Bot.config.premium) {
                    setTimeout(
                        async () => {
                            // Wait 2min to start
                            setInterval(
                                async () => {
                                    // Then run on an interval of 1min
                                    // Check all the personal ranks   (To send to DMs)
                                    await Bot.getRanks();

                                    // Check all the ranks for shards (To send to channels)
                                    await Bot.shardRanks();

                                    // Only run these every 5min (on :05, :10, :15, etc)
                                    const min = new Date().getMinutes();
                                    if (min % 5 === 0) {
                                        // Update the shard payout monitors
                                        await Bot.shardTimes();

                                        // Update the guild's tickets count
                                        await Bot.guildTickets();
                                    }

                                    // Run this/ these every hour on the hour
                                    if (min % 60 === 0) {
                                        // Run the checker for guild member's roster changes
                                        await Bot.guildsUpdate();
                                    }

                                    // Reload all the data files on a timer so it'll catch new changes
                                    if (client.shard?.count > 0) {
                                        client.shard
                                            .broadcastEval((client: BotClient) => client.reloadDataFiles())
                                            // .then(() => Bot.logger.log("[Ready/ReloadData data] Reloading all data files"))
                                            .catch((err) => console.log(`[Ready/ReloadData data]\n${err}`));
                                    } else {
                                        client.reloadDataFiles();
                                    }
                                },
                                1 * 60 * 1000,
                            );
                        },
                        2 * 60 * 1000,
                    );
                }
            }

            // If it's the last shard being started, load all the events in
            if (Bot.shardId + 1 === client.shard.count) {
                const socketHelper = new SocketHelper(Bot.socket);
                let consecutiveFailures = 0;
                const MAX_CONSECUTIVE_FAILURES = 5;

                setInterval(
                    async () => {
                        if (!socketHelper.isConnected()) {
                            consecutiveFailures++;
                            if (consecutiveFailures === MAX_CONSECUTIVE_FAILURES) {
                                console.warn(`  [${Bot.shardId}] EventMgr not connected, skipping event checks (will retry silently)`);
                            }
                            return;
                        }

                        try {
                            const eventsList = await socketHelper.checkEvents();
                            consecutiveFailures = 0; // Reset on success
                            if (eventsList.length) {
                                Bot.manageEvents(eventsList);
                            }
                        } catch (err) {
                            consecutiveFailures++;
                            if (consecutiveFailures <= MAX_CONSECUTIVE_FAILURES) {
                                console.error(`  [${Bot.shardId}] Error checking events: ${err.message}`);
                            }
                        }
                    }, 1 * 60 * 1000,
                );
            }
        }

        Bot.logger.log(readyString, "ready", true);

        // console.log(`  [${shardId}] Starting wsWatcher`);
        // await checkWSHealth(client);

        // Sets the status as the current server count and help command
        const playingString = "swgohbot.com";
        try {
            client.user.setPresence({ activities: [{ name: playingString, type: 0 }] });
        } catch (err) {
            console.log(`[READY] Error when setting presence.\n${err}`);
        }
    },
};
