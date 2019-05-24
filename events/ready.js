/* eslint no-undef: 0 */
const fs = require("fs");
module.exports = async client => {
    // Logs that it's up, and some extra info
    let  readyString = `${client.user.username} is ready to serve ${client.users.size} users in ${client.guilds.size} servers.`;
    if (client.shard) {
        readyString = `${client.user.username} is ready to serve ${client.users.size} users in ${client.guilds.size} servers. Shard #${client.shard.id}`;
        if (client.shard.id === 0) {
            if (client.config.sendStats) {
                require("../modules/botStats.js")(client);
            }

            // Save the bot's current guild count every 5 minutes
            setInterval(async () => {
                const guilds = await client.guildCount();
                fs.writeFileSync("../dashboard/data/guildCount.txt", guilds, "utf8");
            }, 5 * 60 * 1000);

            // Reload the patrons' goh data, and check for arena rank changes every minute
            if (client.config.premium) {
                setInterval(async () => {
                    await client.getRanks();
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

    client.log("Ready", readyString);

    // Sets the status as the current server count and help command
    const playingString =  `${client.config.prefix}help ~ swgohbot.com`;
    client.user.setPresence({ game: { name: playingString, type: 0 } }).catch(console.error);

    // Update the player/ guild count every 5 min
    setInterval(async () => {
        const dbo = await client.mongo.db(client.config.mongodb.swapidb);
        client.swgohPlayerCount = await dbo.collection("players").find({}).count();
        client.swgohGuildCount  = await dbo.collection("guilds").find({}).count();
    }, 5 * 60 * 1000);


    client.loadAllEvents();
};

