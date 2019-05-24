
module.exports = async (guild) => {
    // Make sure it's not a server outage that's causing it to show as leaving/ re-joining
    if (!guild.available) return;

    // The bot isn't in the server anymore, so get rid of the config
    // await guild.client.guildSettings.destroy({where: {guildID: guild.id}})
    //     .then(() => {})
    //     .catch(error => { guild.client.log('ERROR',`Broke in guildDelete(settings) ${error}`); });

    // Log that the bot left
    guild.client.log("GuildDelete", `I left ${guild.name}(${guild.id})`, "Log", "diff", "-");
};

