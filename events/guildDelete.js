
module.exports = (client, guild) => {
    // The bot isn't in the server anymore, so get rid of the config
    client.guildSettings.delete(guild.id);

    // Log that the bot left
    client.log('GuildDelete', `I left ${guild.name}(${guild.id})`);

    // Sets the status as the current server count and help command
    const playingString =  `${client.config.prefix}help ~ ${client.guilds.size} servers`;
    client.user.setPresence({ game: { name: playingString, type: 0 } }).catch(console.error);
};
