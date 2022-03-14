import io from "socket.io-client";
import { Client } from "discord.js";

module.exports = async (Bot: {}, client: Client) => {
    // Logs that it's up, and some extra info
    client.shard.id = client.shard.ids[0];

    const application = client.application;
    if (!Bot.isMain() && application.botPublic && application.owner.id !== "124579977474736129") {
        Bot.logger.error(Buffer.from("RkFUQUwgRVJST1I6IElOVkFMSUQgQk9UIFNFVFVQCgpHbyB0byB5b3VyIEJvdCdzIGFwcGxpY2F0aW9uIHBhZ2UgaW4gRGlzY29yZCBEZXZlbG9wZXJzIHNpdGUgYW5kIGRpc2FibGUgdGhlICJQdWJsaWMgQm90IiBvcHRpb24uCgpQbGVhc2UgY29udGFjdCB0aGUgc3VwcG9ydCB0ZWFtIGF0IFNXR29IQm90IEhRIC0gaHR0cHM6Ly9kaXNjb3JkLmdnL0Zmd0d2aHIgLSBmb3IgbW9yZSBpbmZvcm1hdGlvbi4=", "base64").toString("utf-8"));
        if (client.shard) { await client.shard.broadcastEval(client => client.destroy());
        } else { process.exit(); }
        return null;
    }

    let readyString = `${client.user.username} is ready to serve ${client.users.cache.size} users in ${client.guilds.cache.size} servers.`;
    if (client.shard) {
        readyString = `${client.user.username} is ready to serve ${client.users.cache.size} users in ${client.guilds.cache.size} servers. Shard #${client.shard.id}`;

        // Connect the sockets and such
        Bot.socket = io(`ws://localhost:${Bot.config.eventServe.port}`);
        Bot.socket.on("connect", () => {
            console.log(`[EventMgr](${client.shard.id}) Connected to socket!`);
        });
        Bot.socket.on("disconnect", () => {
            console.log(`[EventMgr](${client.shard.id}) Disconnected from socket!`);
        });

        if (client.shard.id === 0) {
            // Deploy all available commands
            // TODO Make this smarter/ check to see what needs updating
            await Bot.deploy();

            // Check if there are any events that need to be processed & announced
            setInterval(() => {
                Bot.socket.emit("checkEvents", (eventsList: []) => {
                    if (eventsList.length) {
                        Bot.manageEvents(eventsList);
                    }
                });
            }, 1 * 60 * 1000);

            // Reload the patrons' goh data, and check for arena rank changes every minute
            if (Bot.config.premium) {
                setInterval(async () => {
                    // Check all the personal ranks   (To send to DMs)
                    await Bot.getRanks();

                    // Check all the ranks for shards (To send to channels)
                    await Bot.shardRanks();

                    // Only run the shard payout thing every 5min (on :5, :10, :15, etc)
                    const min = new Date().getMinutes();
                    if (min % 5 === 0) {
                        // Update the shard payout monitors
                        await Bot.shardTimes();
                    }

                    if (min % 60 === 0) {
                        // Run the checker for guild member's roster changes
                        await Bot.guildsUpdate();
                    }
                }, 1 * 60 * 1000);
            }
        }

        // If it's the last shard being started, load all the emotes in
        if ((client.shard.id + 1) === client.shard.count) {
            Bot.logger.log("Loading up emotes");
            await client.shard.broadcastEval(client => client.loadAllEmotes());
        }
    } else {
        await client.loadAllEmotes();
        await Bot.deploy();
    }

    Bot.logger.log(readyString, "ready", true);

    // Sets the status as the current server count and help command
    const playingString =  `${Bot.config.prefix}help ~ swgohbot.com`;
    try {
        client.user.setPresence({ activities: [{ name: playingString, type: 0}] });
    } catch (err) {
        console.log("[READY] Error when setting presence.\n" + err);
    }

    // Update the player/ guild count every 5 min
    setInterval(async () => {
        const dbo = await Bot.mongo.db(Bot.config.mongodb.swapidb);
        Bot.swgohPlayerCount = await dbo.collection("playerStats").estimatedDocumentCount();
        Bot.swgohGuildCount  = await dbo.collection("guilds").estimatedDocumentCount();
    }, 5 * 60 * 1000);
};
