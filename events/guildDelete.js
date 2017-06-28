const PersistentCollection = require("djs-collection-persistent");

module.exports = guild => {
    // Initialize **or load** the server configurations
    const guildSettings = guild.client.guildSettings;

    // Removing an element uses `delete(key)`
    guildSettings.delete(guild.id);

    client.user.setGame(`${settings.prefix}help ~ ${client.guilds.size} servers`).catch(console.error);
};
