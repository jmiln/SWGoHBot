import { inspect } from "node:util";
import { getGuildSettings } from "../modules/guildConfig/settings.js";

export default {
    name: "guildMemberAdd",
    execute: async (Bot, client, member) => {
        // This executes when a member joins, so let's welcome them!
        const guildConf = await getGuildSettings({ cache: Bot.cache, guildId: member.guild.id });

        if (guildConf.enableWelcome && guildConf.welcomeMessage?.length && guildConf.announceChan?.length) {
            // If they have it turned on, and it's not empty
            const welcomeMessage = guildConf.welcomeMessage
                .replace(/{{user}}/gi, member.user.username)
                .replace(/{{usermention}}/gi, member.user)
                .replace(/{{server}}/gi, member.guild.name);

            try {
                client.announceMsg(member.guild, welcomeMessage, null, guildConf);
            } catch (e) {
                Bot.logger.error(`Error sending welcomeMessage:\n\nGuildConf:\n${inspect(guildConf)}\n\nError:\n${e}`);
            }
        }
    },
};
