const chalk = require('chalk');

module.exports = async client => {
    // Why await here? Because the ready event isn't actually ready, sometimes
    // guild information will come in *after* ready. 1s is plenty, generally,
    // for all of them to be loaded.
    await wait(1000);

    // Get the guildSettings
    guildSettings = client.guildSettings;

    // Grab a list of all the guilds the bot is in
    const guildList = client.guilds.keyArray();

    guildList.forEach(guild => {
        // If there is no config, give em one
        if(!guildSettings.has(guild)) {
            guildSettings.set(guild, client.config.defaultSettings);
        }
    });

    // Logs that it's up, and some extra info
    client.log("Ready", `${client.user.username} is ready to serve ${client.users.size} users in ${client.guilds.size} servers.`);

    // Sets the status as the current server count and help command 
    const playingString =  `${client.config.prefix}help ~ ${client.guilds.size} servers`;
    client.user.setPresence({ game: { name: playingString, type: 0 } }).catch(console.error);
};
