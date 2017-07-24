module.exports = (client, guild) => {
    // Adding a new row to the collection uses `set(key, value)`
    client.guildSettings.set(guild.id, client.config.defaultSettings);

    // Updates the status to show the increased server count
    client.user.setGame(`${settings.prefix}help ~ ${client.guilds.size} servers`).catch(console.error);

    // Log that it joined another guild
    console.log(`I joined ${guild.id}`);

    // Messages the guild owner to tell the how to set the bot up
    guild.owner.send(`Thank you for adding this SWGoHBot! Before using me, please configure the Admin role by running the following command: \`${settings.prefix}setconf adminRole <AdminRoleName>\`.\nThis will allow anyone with that Discord role to edit the bot's settings.\nAnd now you're all set to begin using SWGoHBot!`);
};
