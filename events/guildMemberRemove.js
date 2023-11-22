const {inspect} = require("util");
const { getGuildSettings } = require("../modules/guildConfigFuncts");

module.exports = async (Bot, client, member) => {
    const guildConf = await getGuildSettings({cache: Bot.cache, guildId: member.guild.id});
    if (!guildConf?.enablePart || !guildConf?.partMessage) return;

    if (guildConf.enablePart && guildConf.partMessage?.length && guildConf.announceChan?.length) { // If they have it turned on, and it's not empty
        const partMessage = guildConf.partMessage
            .replace(/{{user}}/gi,        member.displayName)
            .replace(/{{usermention}}/gi, member.user)
            .replace(/{{server}}/gi,      member.guild.name);

        try {
            await client.announceMsg(member.guild, partMessage, null, guildConf);
        } catch (e) {
            Bot.logger.error(`Error sending partMessage:\nGuildConf:\n${inspect(guildConf)}\n\nError:\n${e}`);
        }
    }
};
