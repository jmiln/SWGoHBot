const chalk = require('chalk');

module.exports = async client => {
	// Why await here? Because the ready event isn't actually ready, sometimes
	// guild information will come in *after* ready. 1s is plenty, generally,
	// for lal of them to be loaded.
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
    })

    client.log("log", `${client.user.username} is ready to serve ${client.users.size} users in ${client.guilds.size} servers.`, "Ready!");//chalk.bgGreen.black(client.user.username + ' is Online'));

    client.user.setGame(`${client.config.prefix}help ~ ${client.guilds.size} servers`).catch(console.error);
};
