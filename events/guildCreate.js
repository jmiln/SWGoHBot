const PersistentCollection = require("djs-collection-persistent");
const settings = require('../settings.json');

module.exports = guild => {
    let guildConf = {};
    const defaultSettings = settings.defaultSettings;

    for(val in defaultSettings) {
        guildConf[val] = defaultSettings[val];
    }

    // Initialize **or load** the server configurations
    const guildSettings = guild.client.guildSettings;

    // Adding a new row to the collection uses `set(key, value)`
    guildSettings.set(guild.id, guildConf);

    // Updates the status to show the increased server count
    guild.client.user.setGame(`${settings.prefix}help ~ ${guild.client.guilds.size} servers`).catch(console.error);

    // Log that it joined another guild
    console.log(`I joined ${guild.id}`);

    // Messages the guild owner to tell the how to set the bot up
    guild.owner.send(`Thank you for adding this SWGoHBot! Before using me, please configure the Moderator and Admin roles by doing the following: \`${settings.prefix}setconf modRole <ModRoleName>\` and \`${settings.prefix}setconf adminRole <AdminRoleName>\`, and you're all set to begin using SWGoHBot!`);

};
