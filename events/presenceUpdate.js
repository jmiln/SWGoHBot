// const {inspect} = require("util");
module.exports = async (Bot, oldPresence, newPresence) => {
    // Ignore bots
    if (newPresence.user.bot) return;

    const guild = newPresence.guild;
    const guildSettings = await Bot.database.models.settings.findOne({where: {guildID: guild.id}, attributes: Bot.config.defaultSettings});
    const guildConf = guildSettings.dataValues;

    // Make sure the guild has it turned on, and that it's not changing for a different reason
    if (!guildConf.useActivityLog || !oldPresence || oldPresence.status === newPresence.status) {
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

    // Here, we need to log the user's ID (newMember.id), and the timestamp for the change (new Date().getTime();)
    activityLog.log[newPresence.member.id] = new Date().getTime();
    await Bot.cache.put(Bot.config.mongodb.swgohbotdb, "activityLog", {guildID: guild.id}, activityLog);
};
