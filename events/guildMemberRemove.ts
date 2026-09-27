import { type Client, Events, type GuildMember } from "discord.js";
import { announceMsg } from "../modules/functions.ts";
import { getGuildSettings } from "../modules/guildConfig/settings.ts";
import logger from "../modules/Logger.ts";

export default {
    name: Events.GuildMemberRemove,
    async execute(client: Client<true>, member: GuildMember) {
        const guildConf = await getGuildSettings({ guildId: member.guild.id });

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
    },
};
