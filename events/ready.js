/* eslint no-undef: 0 */
module.exports = async client => {
    // Why await here? Because the ready event isn't actually ready, sometimes
    // guild information will come in *after* ready. 1s is plenty, generally,
    // for all of them to be loaded.
    await wait(1000);

    // Grab a list of all the guilds the bot is in
    const guildList = client.guilds.keyArray();

    const defSet = client.config.defaultSettings;

    await client.guildSettings.sync();
    await client.guildEvents.sync();
    await client.commandLogs.sync();
    await client.changelogs.sync();

    guildList.forEach(async (guildID) => {
        // If there is no config, give em one, and an events object while we're at it
        await client.guildSettings.findOrCreate({where: {guildID: guildID}, defaults: {
            guildID: guildID, 
            adminRole: defSet.adminRole, 
            enableWelcome: defSet.enableWelcome, 
            welcomeMessage: defSet.welcomeMessage, 
            useEmbeds: defSet.useEmbeds, 
            timezone: defSet.timezone, 
            announceChan: defSet.announceChan, 
            useEventPages: defSet.useEventPages,
            language: defSet.language
        }})
            .then(()=>{})
            .catch(err => {client.log('ERROR', `Broke setting up new Settings: \`${err}\``);});
    });

    // Logs that it's up, and some extra info
    const readyString = `${client.user.username} is ready to serve ${client.users.size} users in ${client.guilds.size} servers. On shard ${client.shard.id}`;
    client.log('Ready', readyString);

    // Sets the status as the current server count and help command 
    const playingString =  `${client.config.prefix}help ~ swgohbot.com`;
    // const playingString =  `${client.config.prefix}help ~ ${client.guilds.size} servers`;
    client.user.setPresence({ game: { name: playingString, type: 0 } }).catch(console.error);

    client.loadAllEvents();
};
