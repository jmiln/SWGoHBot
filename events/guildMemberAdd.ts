import { Events, type GuildMember } from "discord.js";
import { getGuildSettings } from "../modules/guildConfig/settings.ts";
import type { BotClient, BotType } from "../types/types.ts";

export default {
    name: Events.GuildMemberAdd,
    execute: async (Bot: BotType, client: BotClient, member: GuildMember) => {
        const guildConf = await getGuildSettings({ cache: Bot.cache, guildId: member.guild.id });

        // Check if welcome messages are enabled
        if (!guildConf.enableWelcome || !guildConf.welcomeMessage?.length || !guildConf.announceChan?.length) {
            return;
        }

        // Build welcome message with template replacements
        const welcomeMessage = guildConf.welcomeMessage
            .replace(/{{user}}/gi, member.user.username)
            .replace(/{{usermention}}/gi, member.user.toString())
            .replace(/{{server}}/gi, member.guild.name);

        try {
            await client.announceMsg(member.guild, welcomeMessage, null, guildConf);
        } catch (e) {
            const errorMessage = e instanceof Error ? e.message : String(e);
            Bot.logger.error(
                `[GuildMemberAdd] Error sending welcome message:\nGuild: ${member.guild.name} (${member.guild.id})\nError: ${errorMessage}`,
            );
        }
    },
};
