module.exports = async (client, guild) => {
    // Get the default config settings
    const defSet = client.config.defaultSettings;

    // Make sure it's not a server outage that's causing it to show as leaving/ re-joining
    if (!guild.available) return;

    const exists = await client.database.models.settings.findOne({where: {guildID: guild.id}})
        .then(token => token !== null)
        .then(isUnique => isUnique);

    if (!exists) {
        // Adding a new row to the DB
        client.database.models.settings.create({
            guildID: guild.id,
            adminRole: defSet.adminRole,
            enableWelcome: defSet.enableWelcome,
            welcomeMessage: defSet.welcomeMessage,
            useEmbeds: defSet.useEmbeds,
            timezone: defSet.timezone,
            announceChan: defSet.announceChan,
            useEventPages: defSet.useEventPages,
            language: defSet.language
        })
            .then(() => {
                // Log that it joined another guild
                client.log("GuildCreate", `I joined ${guild.name}(${guild.id})`, "Log", "diff", "+");
            })
            .catch(error => { console.log(error, guild.id); });
    } else {
        // Log that it joined another guild (Again)
        client.log("GuildCreate", `I re-joined ${guild.name}(${guild.id})`, "Log", "diff", "+");
    }
};

