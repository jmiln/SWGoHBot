// const {inspect} = require("util");
module.exports = async (Bot, oldMember, newMember) => {
    // This executes when a member joins, so let's welcome them!
    const guild = newMember.guild;
    const guildSettings = await Bot.database.models.settings.findOne({where: {guildID: guild.id}, attributes: Bot.config.defaultSettings});
    const guildConf = guildSettings.dataValues;

    // Make sure the guild has it turned on, and that it's not changing for a different reason
    if (!guildConf.useActivityLog || oldMember.presence.status === newMember.presence.status) {
        return;
    }

    let activityLog = await Bot.cache.get(Bot.config.mongodb.swgohbotdb, "activityLog", {guildID: guild.id});
    if (Array.isArray(activityLog)) activityLog = activityLog[0];
    if (!activityLog) {
        activityLog = {
            guildID: guild.id,
            log: {}
        };
    }
    // Only log it if it's changing from another status to offline
    if (newMember.presence.status === "offline") {
        // Here, we need to log the user's ID (newMember.id), and the timestamp for the change (new Date().getTime();)
        activityLog.log[newMember.id] = new Date().getTime();
        await Bot.cache.put(Bot.config.mongodb.swgohbotdb, "activityLog", {guildID: guild.id}, activityLog);
    }
};

