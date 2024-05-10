/* eslint no-undef: 0 */
// const {inspect} = require("util");
const { io } = require("socket.io-client");
// const checkWSHealth = require("../modules/wsWatcher.js");

module.exports = async (Bot, client) => {
    // Logs that it's up, and some extra info
    client.shard.id = client.shard.ids[0];

    const application = client.application;
    if (!Bot.isMain() && application.botPublic && application.owner.id !== "124579977474736129") {
        Bot.logger.error(Buffer.from("RkFUQUwgRVJST1I6IElOVkFMSUQgQk9UIFNFVFVQCgpHbyB0byB5b3VyIEJvdCdzIGFwcGxpY2F0aW9uIHBhZ2UgaW4gRGlzY29yZCBEZXZlbG9wZXJzIHNpdGUgYW5kIGRpc2FibGUgdGhlICJQdWJsaWMgQm90IiBvcHRpb24uCgpQbGVhc2UgY29udGFjdCB0aGUgc3VwcG9ydCB0ZWFtIGF0IFNXR29IQm90IEhRIC0gaHR0cHM6Ly9kaXNjb3JkLmdnL0Zmd0d2aHIgLSBmb3IgbW9yZSBpbmZvcm1hdGlvbi4=", "base64").toString("utf-8"));
        if (client.shard) await client.shard.broadcastEval(client => client.destroy());
        else process.exit();
        return null;
    }

    // Grab a list of all the command names
    Bot.commandList = [...client.slashcmds.keys()];


    let readyString = `${client.user.username} is ready to serve in ${client.guilds.cache.size} servers.`;
    if (client.shard) {
        readyString = `${client.user.username} is ready to serve in ${client.guilds.cache.size} servers. Shard #${client.shard.id}`;

        // Connect the sockets and such
        Bot.socket = io(`ws://localhost:${Bot.config.eventServe.port}`);
        Bot.socket.on("connect", () => {
            console.log(`  [${client.shard.id}] Connected to EventMgr socket!`);
        });
        Bot.socket.on("disconnect", () => {
            console.log(`  [${client.shard.id}] Disconnected from EventMgr socket!`);
        });

        // Start up the client.ws watcher
        if (client.shard.id === 0) {
            // Deploy all commands in case anything's been updated
            setTimeout(async () => {
                await Bot.deployCommands();
            }, 1 * 60 * 1000);

            // Reload the patrons' goh data, and check for arena rank changes every minute
            if (Bot.config.premium) {
                setTimeout(async () => {  // Wait 2min to start
                    setInterval(async () => {   // Then run on an interval of 1min
                        // Check all the personal ranks   (To send to DMs)
                        await Bot.getRanks();

                        // Check all the ranks for shards (To send to channels)
                        await Bot.shardRanks();

                        // Only run these every 5min (on :5, :10, :15, etc)
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
                            client.shard.broadcastEval(client => client.reloadDataFiles())
                                .catch(err => console.log(`[Ready/ReloadData data]\n${err}`));
                        } else {
                            client.reloadDataFiles();
                        }
                    }, 1 * 60 * 1000);

                }, 2 * 60 * 1000);
            }
        }

        // If it's the last shard being started, load all the events in
        if ((client.shard.id + 1) === client.shard.count) {
            setInterval(() => {
                Bot.socket.emit("checkEvents", (eventsList) => {
                    if (eventsList.length) {
                        Bot.manageEvents(eventsList);
                    }
                });
            }, 1 * 60 * 1000);
        }
    }

    Bot.logger.log(readyString, "ready", true);

    // console.log(`  [${client.shard.id}] Starting wsWatcher`);
    // await checkWSHealth(client);

    // Sets the status as the current server count and help command
    const playingString =  "swgohbot.com";
    try {
        client.user.setPresence({ activity: { name: playingString, type: 0} });
    } catch (err) {
        console.log(`[READY] Error when setting presence.\n${err}`);
    }
};
