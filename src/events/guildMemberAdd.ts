import { inspect } from "util";
import { Client, GuildMember } from "discord.js";
import { BotType } from "../modules/types";

module.exports = async (Bot: BotType, client: Client, member: GuildMember) => {
    // This executes when a member joins, so let's welcome them!
    const guild = member.guild;
    if (!guild) {
        console.log("Missing guild");
        return;
    }
    const guildConf = await Bot.getGuildConf(guild.id);

    // Make sure the config option exists. Should not need this, but just in case
    if (!guildConf["announceChan"]) {
        Bot.database.models.settings.update({announceChan: ""}, {where: {guildID: guild.id}});
    }

    // Our welcome message has a bit of a placeholder, let's fix
    if (guildConf.enableWelcome && guildConf.welcomeMessage !== "" && guildConf.announceChan !== "") { // If they have it turned on, and it's not empty
        const welcomeMessage = guildConf.welcomeMessage
            .replace(/{{user}}/gi, member.user.username)
            .replace(/{{usermention}}/gi, `<@${member.user.id}>`)
            .replace(/{{server}}/gi, member.guild.name)
            .replace(/{{prefix}}/gi, guildConf.prefix);
        try {
            Bot.announceMsg(guild, welcomeMessage, null, guildConf);
        } catch (err: unknown) {
            Bot.logger.error(`Error sending welcomeMessage:\n\nGuildConf:\n${inspect(guildConf)}\n\nError:\n${err}`);
        }
    }
};
