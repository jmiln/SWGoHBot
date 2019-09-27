/* eslint no-undef: 0 */
const fs = require("fs");
module.exports = async (Bot, client) => {
    // Logs that it's up, and some extra info
    let  readyString = `${client.user.username} is ready to serve ${client.users.size} users in ${client.guilds.size} servers.`;
    if (client.shard) {
        readyString = `${client.user.username} is ready to serve ${client.users.size} users in ${client.guilds.size} servers. Shard #${client.shard.id}`;
        if (client.shard.id === 0) {
            if (Bot.config.sendStats) {
                require("../modules/botStats.js")(Bot, client);
            }

            // Save the bot's current guild count every 5 minutes
            setInterval(async () => {
                const guilds = await Bot.guildCount();
                fs.writeFileSync("../dashboard/data/guildCount.txt", guilds, "utf8");
            }, 5 * 60 * 1000);

            if (Bot.config.patreon) {
                // Reload any patrons
                await Bot.updatePatrons();
                setInterval(Bot.updatePatrons,  1 * 60 * 1000);
            }
            // Reload the patrons' goh data, and check for arena rank changes every minute
            if (Bot.config.premium) {
                setInterval(async () => {
                    await Bot.getRanks();
                }, 1 * 60 * 1000);
            }
        }
        // If it's the last shard being started, load all the emotes in
        if ((client.shard.id + 1) === client.shard.count) {
            console.log("Loading up emotes");
            await client.shard.broadcastEval("this.loadAllEmotes()");
        }
    } else {
        client.loadAllEmotes();
    }

    Bot.log("Ready", readyString, {color: Bot.colors.green});

    // Sets the status as the current server count and help command
    const playingString =  `${Bot.config.prefix}help ~ swgohbot.com`;
    client.user.setPresence({ game: { name: playingString, type: 0 } }).catch(console.error);

    // Update the player/ guild count every 5 min
    setInterval(async () => {
        const dbo = await Bot.mongo.db(Bot.config.mongodb.swapidb);
        Bot.swgohPlayerCount = await dbo.collection("players").count();
        Bot.swgohGuildCount  = await dbo.collection("guilds").count();
    }, 5 * 60 * 1000);

    Bot.loadAllEvents();
};

