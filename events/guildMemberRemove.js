const {inspect} = require("util");
module.exports = async (Bot, member) => {
    // This executes when a member joins, so let's welcome them!
    const guild = member.guild;
    const guildSettings = await Bot.database.models.settings.findOne({where: {guildID: guild.id}, attributes: Bot.config.defaultSettings});
    if (!guildSettings) return;
    const guildConf = guildSettings.dataValues;

    // Make sure the config option exists. Should not need this, but just in case
    if (!guildConf["announceChan"]) {
        Bot.database.models.settings.update({announceChan: ""}, {where: {guildID: guild.id}});
    }

    // Our message has a bit of a placeholder, let's fix
    if (guildConf.enablePart && guildConf.partMessage !== "" && guildConf.announceChan !== "") { // If they have it turned on, and it's not empty
        const partMessage = guildConf.partMessage
            .replace(/{{user}}/gi,        member.displayName)
            .replace(/{{usermention}}/gi, member.user)
            .replace(/{{server}}/gi,      member.guild.name)
            .replace(/{{prefix}}/gi,      guildConf.prefix);
        try {
            Bot.announceMsg(guild, partMessage);
        } catch (e) {
            Bot.logger.error(`Error sending partMessage:\nGuildConf:\n${inspect(guildConf)}\n\nError:\n${e}`);
        }
    }
};

