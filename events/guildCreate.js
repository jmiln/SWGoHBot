module.exports = async (Bot, guild) => {
    // Make sure it's not a server outage that's causing it to show as leaving/ re-joining
    if (!guild.available) return;
    Bot.logger.log(`[GuildCreate] I joined ${guild.name}(${guild.id})`);
};
