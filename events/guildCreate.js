module.exports = (client, guild) => {
    // Adding a new row to the collection uses `set(key, value)`
    client.guildSettings.set(guild.id, client.config.defaultSettings);

    // Updates the status to show the increased server count
    const playingString =  `${client.config.prefix}help ~ ${client.guilds.size} servers`;
    client.user.setPresence({ game: { name: playingString, type: 0 } }).catch(console.error);

    // Log that it joined another guild
    client.log('GuildCreate', `I joined ${guild.name}(${guild.id})`);

    // Messages the guild owner to tell the how to set the bot up
    guild.owner.send(`Thank you for adding this SWGoHBot! Before using me, please configure the Admin role by running the following command: 
                     \n\`${client.config.prefix}setconf adminRole add <AdminRoleName>\`.
                     \nThis will allow anyone with that Discord role to edit the bot's settings. 
                     \nAlso run \`${client.config.prefix}setconf timezone <timezone>\` to be the timezone of your guild's activities (Default is \`America/Los_Angeles\`),
                     \nand run \`${client.config.prefix}setconf announceChan <AnnouncementChannel>\` if you want to use the 
                     \nevents/ announcements or event commands.                     
                     \nAfter that, you should be set to begin using SWGoHBot!`);
};
