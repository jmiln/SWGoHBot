/* eslint no-undef: 0 */
const fs = require("fs");
module.exports = async client => {
    // Why await here? Because the ready event isn't actually ready, sometimes
    // guild information will come in *after* ready. 1s is plenty, generally,
    // for all of them to be loaded.
    await client.wait(1000);

    // Logs that it's up, and some extra info
    let  readyString = `${client.user.username} is ready to serve ${client.users.size} users in ${client.guilds.size} servers.`;
    if (client.shard && client.shard.count > 0) {
        readyString = `${client.user.username} is ready to serve ${client.users.size} users in ${client.guilds.size} servers. Shard #${client.shard.id}`;
        if (client.shard.id === 0 && client.config.sendStats) {
            require("../modules/botStats.js")(client);
        }
        if (client.shard.id === 0) {
            // Save the bot's current guild count every 5 minutes
            setInterval(async () => {
                const guilds = await client.guildCount();
                fs.writeFileSync("../dashboard/data/guildCount.txt", guilds, "utf8");
            }, 5 * 60 * 1000);
            // Reload the patrons' goh data, and check for arena rank changes every minute
            setInterval(async () => {
                await client.getRanks();
            }, 1 * 60 * 1000);
        }
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

