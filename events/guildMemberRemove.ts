import { Events, type GuildMember } from "discord.js";
import cache from "../modules/cache.ts";
import { announceMsg } from "../modules/functions.ts";
import { clearSupporterInfo } from "../modules/guildConfig/patreonSettings.ts";
import { getGuildSettings } from "../modules/guildConfig/settings.ts";
import logger from "../modules/Logger.ts";
import userReg from "../modules/users.ts";
import type { BotClient } from "../types/types.ts";

export default {
    name: Events.GuildMemberRemove,
    async execute(client: BotClient, member: GuildMember) {
        const guildConf = await getGuildSettings({ cache: cache, guildId: member.guild.id });

        // Send departure message if enabled
        if (guildConf.enablePart && guildConf.partMessage?.length && guildConf.announceChan?.length) {
            const partMessage = guildConf.partMessage
                .replace(/{{user}}/gi, member.displayName)
                .replace(/{{usermention}}/gi, member.user.toString())
                .replace(/{{server}}/gi, member.guild.name);

            try {
                await announceMsg({
                    client,
                    guild: member.guild,
                    announceMessage: partMessage,
                    channel: guildConf.announceChan,
                    guildConf,
                });
            } catch (e) {
                const errorMessage = e instanceof Error ? e.message : String(e);
                logger.error(
                    `[GuildMemberRemove] Error sending departure message:\nGuild: ${member.guild.name} (${member.guild.id})\nError: ${errorMessage}`,
                );
            }
        }

        // Check if user has this server marked as their bonus server
        const userConf = await userReg.getUser(member.id);
        if (!userConf?.bonusServer || userConf.bonusServer !== member.guild.id) {
            return;
        }

        // Remove bonus server setting
        await clearSupporterInfo({ cache: cache, userId: member.id });
    },
};
