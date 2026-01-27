import Command from "../base/slashCommand.ts";
import { typedDefaultSettings } from "../data/constants/defaultGuildConf.ts";
import cache from "../modules/cache.ts";
import { isUserID } from "../modules/functions.ts";
import { getGuildSupporterTier, getServerSupporters } from "../modules/guildConfig/patreonSettings.ts";
import { getGuildSettings } from "../modules/guildConfig/settings.ts";
import logger from "../modules/Logger.ts";
import type { BotInteraction, BotType } from "../types/types.ts";

export default class Showconf extends Command {
    static readonly metadata = {
        name: "showconf",
        description: "Show the current guild configuration",
        guildOnly: false,
        permLevel: 3,
    };
    constructor(Bot: BotType) {
        super(Bot, Showconf.metadata);
    }

    async run(_Bot: BotType, interaction: BotInteraction) {
        const guildConf = await getGuildSettings({ cache: cache, guildId: interaction.guild.id });

        const outArr = [];
        if (!guildConf) logger.error(`[slash/showconf] Unable to get guildConf for guild ${interaction.guild.id}`);

        // TODO Make this show nicer instead of just a basic code block
        // Change it so adminRoles show the names instead of ID
        // Change eventCountdown so it shows just a list of numbers instead of as an array, same for the rest, make it look nicer instead of inspected strings and such

        // Check out each option in the config file, and set it up in each subarg as needed
        for (const key of Object.keys(typedDefaultSettings)) {
            switch (key) {
                case "adminRole": {
                    const roleArr = [];
                    if (guildConf.adminRole?.length) {
                        for (const role of guildConf.adminRole) {
                            if (isUserID(role)) {
                                // If it's a role ID, try and get a name for it
                                const roleRes = interaction.guild.roles.cache.find((r) => r.id === role);
                                roleArr.push(roleRes?.name || role);
                            } else {
                                roleArr.push(role);
                            }
                        }
                        outArr.push(
                            `* ${key}: \n${roleArr
                                .sort()
                                .map((r) => `  - ${r}`)
                                .join("\n")}`,
                        );
                    } else {
                        outArr.push(`* ${key}: N/A`);
                    }
                    break;
                }
                case "announceChan": {
                    if (guildConf.announceChan?.length) {
                        const channel = interaction.guild.channels.cache.get(guildConf.announceChan);
                        let channelName = guildConf.announceChan;
                        if (channel?.name) channelName = `#${channel?.name} (${channel?.id})`;
                        outArr.push(`* ${key}: ${channelName || guildConf.announceChan}`);
                    } else {
                        outArr.push(`* ${key}: N/A`);
                    }
                    break;
                }
                case "eventCountdown": {
                    if (guildConf.eventCountdown?.length) {
                        outArr.push(`* ${key}: ${guildConf.eventCountdown.join(", ")}`);
                    } else {
                        outArr.push(`* ${key}: N/A`);
                    }
                    break;
                }
                default:
                    outArr.push(`* ${key}: ${guildConf[key]}`);
                    break;
            }
        }

        const supporterList = [];
        const totalSuppTier = await getGuildSupporterTier({ cache: cache, guildId: interaction.guild.id });
        const guildSupporters = await getServerSupporters({ cache: cache, guildId: interaction.guild.id });
        for (const supp of guildSupporters) {
            const user = interaction.guild.members.cache.get(supp.userId);
            if (!user?.displayName) continue;

            supporterList.push(user.displayName);
        }
        outArr.push(
            `* Current supporters${totalSuppTier > 0 && ` (Combined tier: $${totalSuppTier})`}: ${
                supporterList?.length ? "\n" : "N/A"
            }${supporterList.map((s) => `  - ${s}`).join("\n")}`,
        );

        return interaction.reply({
            content: interaction.language.get("COMMAND_SHOWCONF_OUTPUT", outArr.join("\n"), interaction.guild.name || ""),
        });
    }
}
