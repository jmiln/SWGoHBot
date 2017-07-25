
module.exports = (client, guild) => {
    // The bot isn't in the server anymore, so get rid of the config
    client.guildSettings.delete(guild.id);

    client.user.setGame(`${client.config.prefix}help ~ ${client.guilds.size} servers`).catch(console.error);
};
