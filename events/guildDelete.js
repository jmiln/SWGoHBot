
module.exports = async (Bot, guild) => {
    // Make sure it's not a server outage that's causing it to show as leaving/ re-joining
    if (!guild.available) return;

    // The bot isn't in the server anymore, so get rid of the config
    await Bot.cache.remove(Bot.config.mongodb.swgohbotdb, "guildSettings", {guildId: guild.id});

    // Also kill off any events that were set up for that guild
    await Bot.cache.remove(Bot.config.mongodb.swgohbotdb, "eventDBs", {eventID: new RegExp("^" + guild.id + "-")});

    // Log that the bot left
    Bot.logger.log(`[GuildDelete] I left ${guild.name}(${guild.id})`);
};
