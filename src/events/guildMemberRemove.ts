import { inspect } from "util";
import { Client, GuildMember } from "discord.js";
import { BotType } from "../modules/types";

module.exports = async (Bot: BotType, client: Client, member: GuildMember) => {
    // This executes when a member joins, so let's welcome them!
    const guildConf = await Bot.getGuildConf(member.guild.id);

    // Our message has a bit of a placeholder, let's fix
    if (guildConf.enablePart && !guildConf.partMessage?.length && guildConf.announceChan?.length) { // If they have it turned on, and it's not empty
        const partMessage = guildConf.partMessage
            .replace(/{{user}}/gi,        member.displayName)
            .replace(/{{usermention}}/gi, `<@${member.user.id}>`)
            .replace(/{{server}}/gi,      member.guild.name)
            .replace(/{{prefix}}/gi,      guildConf.prefix);

        try {
            await Bot.announceMsg(member.guild, partMessage, null, guildConf);
        } catch (err) {
            Bot.logger.error(`Error sending partMessage:\nGuildConf:\n${inspect(guildConf)}\n\nError:\n${err}`);
        }
    }
};
