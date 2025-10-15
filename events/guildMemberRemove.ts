import { inspect } from "node:util";
import type { GuildMember } from "discord.js";
import { clearSupporterInfo } from "../modules/guildConfig/patreonSettings.ts";
import { getGuildSettings } from "../modules/guildConfig/settings.ts";
import type { BotClient, BotType } from "../types/types.ts";

export default {
    name: "guildMemberRemove",
    async execute(Bot: BotType, client: BotClient, member: GuildMember) {
        const guildConf = await getGuildSettings({ cache: Bot.cache, guildId: member.guild.id });

        if (guildConf.enablePart && guildConf.partMessage?.length && guildConf.announceChan?.length) {
            // If they have it turned on, and it's not empty
            const partMessage = guildConf.partMessage
                .replace(/{{user}}/gi, member.displayName)
                .replace(/{{usermention}}/gi, member.user)
                .replace(/{{server}}/gi, member.guild.name);

            try {
                await client.announceMsg(member.guild, partMessage, null, guildConf);
            } catch (e) {
                Bot.logger.error(`Error sending partMessage:\nGuildConf:\n${inspect(guildConf)}\n\nError:\n${e}`);
            }
        }

        // Grab the user's config, and check if they have this server marked as their bonus
        const userConf = await Bot.userReg.getUser(member.id);
        if (!userConf?.bonusServer) return;
        if (userConf.bonusServer !== member.guild.id) return;

        // If they're leaving the server they have set as their bonus, remove the setting from them and the server
        await clearSupporterInfo({ cache: Bot.cache, userId: member.id });
    },
};
