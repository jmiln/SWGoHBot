const PersistentCollection = require("djs-collection-persistent");
const settings = require('../settings.json');

module.exports = guild => {
    // Get the client
    const client = guild.client;

    // Log it
    console.log(`I just left guilld ${guild.id}`);

    // Initialize **or load** the server configurations
    const guildSettings = client.guildSettings;

    // Removing an element uses `delete(key)`
    guildSettings.delete(guild.id);

    client.user.setGame(`${settings.prefix}help ~ ${client.guilds.size} servers`).catch(console.error);
};
