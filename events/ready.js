const PersistentCollection = require("djs-collection-persistent");
const chalk = require('chalk');
const settings = require("../settings.json");
module.exports = client => {
    // Get the settings to work with
    const guildSettings = client.guildSettings;

    // Grab a list of all the guilds the bot is in
    const guildList = client.guilds.keyArray();

    // Get the default settings that each guild needs
    defaultSettings = settings.defaultSettings;

    // Give the settings a place to be stored
    defaultGuildConf = {};

    // Load em into the correct format
    for(val in defaultSettings) {
        defaultGuildConf[val] = defaultSettings[val];
    }

    guildList.forEach(guild => {
        // Get the config for each guild
        guildConf = guildSettings.get(guild);

        // If there is no config, make one
        if(!guildConf) {
            guildConf = defaultGuildConf;
            guildSettings.set(guild, guildConf);
        }
    })


    console.log(chalk.bgGreen.black(client.user.username + ' is Online'));

    client.user.setGame(`${settings.prefix}help ~ ${client.guilds.size} servers`).catch(console.error);
};
