const PersistentCollection = require("djs-collection-persistent");

module.exports = guild => {
    // Initialize **or load** the server configurations
    const guildSettings = guild.client.guildSettings;

    // Removing an element uses `delete(key)`
    guildSettings.delete(guild.id);
};
