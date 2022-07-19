const {inspect} = require("util");
module.exports = async (Bot, client, member) => {
    // This executes when a member joins, so let's welcome them!
    const guildConf = await Bot.getGuildSettings(member.guild.id);

    // Our message has a bit of a placeholder, let's fix
    if (guildConf.enablePart && !guildConf.partMessage?.length && guildConf.announceChan?.length) { // If they have it turned on, and it's not empty
        const partMessage = guildConf.partMessage
            .replace(/{{user}}/gi,        member.displayName)
            .replace(/{{usermention}}/gi, member.user)
            .replace(/{{server}}/gi,      member.guild.name)
            .replace(/{{prefix}}/gi,      guildConf.prefix);

        try {
            await client.announceMsg(member.guild, partMessage, null, guildConf);
        } catch (e) {
            Bot.logger.error(`Error sending partMessage:\nGuildConf:\n${inspect(guildConf)}\n\nError:\n${e}`);
        }
    }
};
