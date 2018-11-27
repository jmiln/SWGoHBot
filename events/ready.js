/* eslint no-undef: 0 */
const fs = require("fs");
module.exports = async client => {
    // Why await here? Because the ready event isn't actually ready, sometimes
    // guild information will come in *after* ready. 1s is plenty, generally,
    // for all of them to be loaded.
    await wait(1000);

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
                console.log("Saved " + guilds + " guilds.");
            }, 5 * 60 * 1000);
        }
    }
    client.log("Ready", readyString);

    // Sets the status as the current server count and help command 
    const playingString =  `${client.config.prefix}help ~ swgohbot.com`;
    client.user.setPresence({ game: { name: playingString, type: 0 } }).catch(console.error);


    client.loadAllEvents();
};

