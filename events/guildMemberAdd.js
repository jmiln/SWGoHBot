const {inspect} = require("util");
module.exports = async (Bot, client, member) => {
    // This executes when a member joins, so let's welcome them!
    const guild = member.guild;
    if (!guild) {
        console.log("[guildMemberAdd] Missing guild???");
        return;
    }
    const guildConf = await Bot.getGuildSettings(guild.id);

    // Our welcome message has a bit of a placeholder, let's fix
    if (guildConf.enableWelcome && guildConf.welcomeMessage !== "" && guildConf.announceChan !== "") { // If they have it turned on, and it's not empty
        const welcomeMessage = guildConf.welcomeMessage
            .replace(/{{user}}/gi, member.user.username)
            .replace(/{{usermention}}/gi, member.user)
            .replace(/{{server}}/gi, member.guild.name);
        try {
            client.announceMsg(guild, welcomeMessage, null, guildConf);
        } catch (e) {
            Bot.logger.error(`Error sending welcomeMessage:\n\nGuildConf:\n${inspect(guildConf)}\n\nError:\n${e}`);
        }
    }
};
