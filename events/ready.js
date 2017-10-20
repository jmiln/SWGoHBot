module.exports = async client => {
    // Why await here? Because the ready event isn't actually ready, sometimes
    // guild information will come in *after* ready. 1s is plenty, generally,
    // for all of them to be loaded.
    await wait(1000);

    // Grab a list of all the guilds the bot is in
    const guildList = client.guilds.keyArray();

    const defSet = client.config.defaultSettings;

    guildList.forEach(async (guild) => {
        // If there is no config, give em one, and an events object while we're at it
        await client.guildSettings.findOrCreate({where: {guildID: guild}, defaults: {guildID: guild, adminRole: defSet.adminRole, enableWelcome: defSet.enableWelcome, welcomeMessage: defSet.welcomeMessage, useEmbeds: defSet.useEmbeds, timezone: defSet.timezone, announceChan: defSet.announceChan}}).then();
        await client.guildEvents.findOrCreate({where: {guildID: guild}, defaults: {guildID: guild, events: {}}}).then();
    });

    // Logs that it's up, and some extra info
    client.log("Ready", `${client.user.username} is ready to serve ${client.users.size} users in ${client.guilds.size} servers.`);

    // Sets the status as the current server count and help command 
    const playingString =  `${client.config.prefix}help ~ ${client.guilds.size} servers`;
    client.user.setPresence({ game: { name: playingString, type: 0 } }).catch(console.error);
};
