
module.exports = async (Bot, guild) => {
    // Make sure it's not a server outage that's causing it to show as leaving/ re-joining
    if (!guild.available) return;

    // The bot isn't in the server anymore, so get rid of the config
    // await Bot.guildSettings.destroy({where: {guildID: guild.id}})
    //     .then(() => {})
    //     .catch(error => { Bot.log('ERROR',`Broke in guildDelete(settings) ${error}`); });

    // Log that the bot left
    Bot.log("GuildDelete", `I left ${guild.name}(${guild.id})`, {color: Bot.colors.red});
};

