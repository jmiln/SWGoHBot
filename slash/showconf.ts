import { InteractionContextType } from "discord.js";
import Command from "../base/slashCommand.ts";
import { isUserID } from "../modules/functions.ts";
import { getGuildSupporterTier, getServerSupporters } from "../modules/guildConfig/patreonSettings.ts";
import { getGuildSettings } from "../modules/guildConfig/settings.ts";
import type { CommandContext } from "../types/types.ts";

// Max length for the welcome/part message previews
const MESSAGE_PREVIEW_LENGTH = 100;

// Discord rejects embed field values longer than this
const EMBED_FIELD_MAX_LENGTH = 1024;

export default class Showconf extends Command {
    static readonly metadata = {
        name: "showconf",
        contexts: [InteractionContextType.Guild],
        description: "Show the current guild configuration",
        permLevel: 3,
        category: "Admin",
    };
    constructor() {
        super(Showconf.metadata);
    }

    async run({ interaction, language }: CommandContext) {
        if (!interaction.guild) {
            return super.error(interaction, language.get("BASE_COMMAND_UNAVAILABLE"));
        }
        const guildConf = await getGuildSettings({ guildId: interaction.guild.id });

        const notAvailable = language.get("BASE_NA");
        const onOff = (val?: boolean) => `**${language.get(val ? "BASE_ON" : "BASE_OFF")}**`;
        const truncate = (msg: string) => (msg.length > MESSAGE_PREVIEW_LENGTH ? `${msg.slice(0, MESSAGE_PREVIEW_LENGTH)}…` : msg);

        // General — roles render as mentions when stored as IDs, names stay as-is
        const roleArr = (guildConf.adminRole ?? []).map((role: string) => (isUserID(role) ? `<@&${role}>` : role)).sort();
        const generalValue = [
            `${language.get("COMMAND_SHOWCONF_LABEL_ADMIN_ROLES")}: ${roleArr.length ? roleArr.join(", ") : notAvailable}`,
            `${language.get("COMMAND_SHOWCONF_LABEL_TIMEZONE")}: ${guildConf.timezone}`,
            `${language.get("COMMAND_SHOWCONF_LABEL_LANGUAGE")}: ${guildConf.language}  |  ${language.get(
                "COMMAND_SHOWCONF_LABEL_GAME_DATA",
            )}: ${guildConf.swgohLanguage}`,
        ].join("\n");

        // Welcome / Part — toggle state with the message quoted underneath
        const welcomeLines = [`${language.get("COMMAND_SHOWCONF_LABEL_WELCOME")}: ${onOff(guildConf.enableWelcome)}`];
        if (guildConf.welcomeMessage?.length) welcomeLines.push(`> ${truncate(guildConf.welcomeMessage)}`);
        welcomeLines.push(`${language.get("COMMAND_SHOWCONF_LABEL_PART")}: ${onOff(guildConf.enablePart)}`);
        if (guildConf.partMessage?.length) welcomeLines.push(`> ${truncate(guildConf.partMessage)}`);

        // Events — channel renders as a mention when stored as an ID
        const announceChan = guildConf.announceChan?.length
            ? isUserID(guildConf.announceChan)
                ? `<#${guildConf.announceChan}>`
                : guildConf.announceChan
            : notAvailable;
        const eventsValue = [
            `${language.get("COMMAND_SHOWCONF_LABEL_ANNOUNCE_CHAN")}: ${announceChan}`,
            `${language.get("COMMAND_SHOWCONF_LABEL_EVENT_PAGES")}: ${onOff(guildConf.useEventPages)}  |  ${language.get(
                "COMMAND_SHOWCONF_LABEL_SHARDTIME_VERTICAL",
            )}: ${onOff(guildConf.shardtimeVertical)}`,
            `${language.get("COMMAND_SHOWCONF_LABEL_COUNTDOWN")}: ${
                guildConf.eventCountdown?.length ? guildConf.eventCountdown.join(", ") : notAvailable
            }`,
        ].join("\n");

        // Supporters
        const totalSuppTier = await getGuildSupporterTier({ guildId: interaction.guild.id });
        const guildSupporters = await getServerSupporters({ guildId: interaction.guild.id });
        // Members missing from the cache still get listed, as a mention the client can resolve
        const guild = interaction.guild;
        const supporterList = guildSupporters.map((supp) => {
            const user = guild.members.cache.get(supp.userId);
            return user?.displayName ? user.displayName : `<@${supp.userId}>`;
        });

        // Cap the field at whole entries so a mention is never cut mid-token
        let supportersValue = supporterList.length ? supporterList.join(", ") : notAvailable;
        if (supportersValue.length > EMBED_FIELD_MAX_LENGTH) {
            while (supporterList.length && `${supporterList.join(", ")}, …`.length > EMBED_FIELD_MAX_LENGTH) {
                supporterList.pop();
            }
            supportersValue = `${supporterList.join(", ")}, …`;
        }

        return interaction.reply({
            embeds: [
                {
                    title: language.get("COMMAND_SHOWCONF_TITLE", interaction.guild.name || ""),
                    fields: [
                        { name: language.get("COMMAND_SHOWCONF_HEADER_GENERAL"), value: generalValue },
                        { name: language.get("COMMAND_SHOWCONF_HEADER_WELCOME"), value: welcomeLines.join("\n") },
                        { name: language.get("COMMAND_SHOWCONF_HEADER_EVENTS"), value: eventsValue },
                        {
                            name: language.get("COMMAND_SHOWCONF_HEADER_SUPPORTERS", totalSuppTier),
                            value: supportersValue,
                        },
                    ],
                },
            ],
        });
    }
}
