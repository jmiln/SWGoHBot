
module.exports = async (Bot, guild) => {
    // Make sure it's not a server outage that's causing it to show as leaving/ re-joining
    if (!guild.available) return;

    // The bot isn't in the server anymore, so get rid of the config
    await Bot.database.models.settings.destroy({where: {guildID: guild.id}})
        .then(() => {})
        .catch(error => { Bot.log("ERROR",`Broke in guildDelete(settings) ${error}`); });

    // Also kill off any events that were set up for that guild
    await Bot.database.models.eventDBs.destroy({where: {eventID: { [Bot.seqOps.like]: `${guild.id}-%`}}})
        .then(() => {})
        .catch(error => { Bot.log("ERROR",`Broke in guildDelete(eventDBs) ${error}`); });

    // Log that the bot left
    Bot.logger.log(`[GuildDelete] I left ${guild.name}(${guild.id})`);
};
