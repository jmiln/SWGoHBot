const {inspect} = require("util");
module.exports = async (Bot, member) => {
    // This executes when a member joins, so let's welcome them!
    const guild = member.guild;
    const guildConf = await Bot.getGuildConf(guild.id);

    // Make sure the config option exists. Should not need this, but just in case
    if (!guildConf["announceChan"]) {
        Bot.database.models.settings.update({announceChan: ""}, {where: {guildID: guild.id}});
    }

    // Our welcome message has a bit of a placeholder, let's fix
    if (guildConf.enableWelcome && guildConf.welcomeMessage !== "" && guildConf.announceChan !== "") { // If they have it turned on, and it's not empty
        const welcomeMessage = guildConf.welcomeMessage
            .replace(/{{user}}/gi, member.user.username)
            .replace(/{{usermention}}/gi, member.user)
            .replace(/{{server}}/gi, member.guild.name)
            .replace(/{{prefix}}/gi, guildConf.prefix);
        try {
            Bot.announceMsg(guild, welcomeMessage, null, guildConf);
        } catch (e) {
            Bot.logger.error(`Error sending welcomeMessage:\n\nGuildConf:\n${inspect(guildConf)}\n\nError:\n${e}`);
        }
    }
};
