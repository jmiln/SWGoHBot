import { ApplicationCommandOptionType, InteractionContextType } from "discord.js";
import Command from "../base/slashCommand.ts";
import { getAllyCode, isAllyCode } from "../modules/functions.ts";
import patreonFuncs from "../modules/patreonFuncs.ts";
import swgohAPI from "../modules/swapi.ts";
import userReg from "../modules/users.ts";
import type { CommandContext } from "../types/types.ts";

export default class GuildUpdate extends Command {
    static readonly metadata = {
        name: "guildupdate",
        category: "Patreon",
        contexts: [InteractionContextType.Guild],
        description: "Set up the guild watcher to alert you for changes in guild member's rosters",
        options: [
            {
                name: "set",
                description: "Change the settings",
                type: ApplicationCommandOptionType.Subcommand,
                options: [
                    {
                        name: "enabled",
                        description: "Turn the updates on or off",
                        type: ApplicationCommandOptionType.Boolean,
                    },
                    {
                        name: "channel",
                        description: "Set which channel to log updates to",
                        type: ApplicationCommandOptionType.Channel,
                    },
                    {
                        name: "allycode",
                        description: "Set what ally code to get the guild's info from",
                        type: ApplicationCommandOptionType.String,
                    },
                ],
            },
            {
                name: "view",
                description: "View the settings for your guild updates",
                type: ApplicationCommandOptionType.Subcommand,
            },
        ],
    };
    constructor() {
        super(GuildUpdate.metadata);
    }

    async run({ interaction, language, permLevel }: CommandContext) {
        const userID = interaction.user.id;
        const user = await userReg.getUser(userID);

        if (!user) {
            return super.error(interaction, language.get("BASE_DATA_NOT_FOUND"));
        }
        let gu = user.guildUpdate;
        const defGU = {
            enabled: false,
            channel: null,
            allyCode: null,
        };
        if (!gu) {
            gu = defGU;
        }

        // GuildUpdate -> activate/ deactivate
        const pat = await patreonFuncs.getPatronUser(interaction.user.id);
        if (!pat || pat.amount_cents < 100) {
            return super.error(interaction, language.get("BASE_PATREON_ONLY"));
        }

        // Whether it's setting values or view
        const subCommand = interaction.options.getSubcommand();

        if (subCommand === "set") {
            const updatedArr = [];
            const isEnabled = interaction.options.getBoolean("enabled");
            const channel = interaction.options.getChannel("channel");
            const acInput = interaction.options.getString("allycode");

            if (isEnabled !== null) {
                gu.enabled = isEnabled;
                updatedArr.push(`Enabled: **${isEnabled}**`);
            }
            if (channel) {
                if (permLevel < 3) {
                    return super.error(interaction, language.get("BASE_MISSING_LOG_CHANNEL_PERM"));
                }
                // This would be at lease MANAGE_CHANNEL perms, or the adminrole under the guildconf
                gu.channel = channel.id;
                updatedArr.push(`Channel: <#${channel.id}>`);
            }
            if (acInput) {
                // Make sure it's a correctly formatted code, or at least just 9 numbers
                if (!isAllyCode(acInput)) return super.error(interaction, language.get("BASE_INVALID_AC_SHORT"));

                // Grab a cleaned allyCode
                const allyCode = await getAllyCode(interaction, acInput);
                if (!allyCode) return super.error(interaction, language.get("BASE_INVALID_AC_SHORT"));

                // Acknowledge before the game-API lookup below, which can exceed Discord's 3s
                // reply window and otherwise leave every later reply failing with "Unknown interaction".
                await interaction.deferReply();

                // Grab the info for the ally code from the api, to make sure the code is actually valid
                const player = await swgohAPI.unitStats(allyCode);
                if (!player?.length) {
                    // Invalid code
                    return super.error(interaction, language.get("BASE_ALLY_CODE_NO_MATCH"));
                }
                gu.allyCode = allyCode;
                updatedArr.push(`Ally Code: **${allyCode}**`);
            }

            // If no allyCode is stored yet, fall back to the user's primary account
            if (!gu.allyCode) {
                if (user.primaryAllyCode) {
                    gu.allyCode = user.primaryAllyCode;
                    updatedArr.push(`Ally Code: **${gu.allyCode}** (from your primary account)`);
                }
            }

            if (updatedArr.length) {
                user.guildUpdate = gu;
                await userReg.updateUser(userID, user);
                // The allycode branch may have deferred; route accordingly.
                const settingsPayload = {
                    content: null,
                    embeds: [
                        {
                            title: "Settings updated",
                            description: updatedArr.join("\n"),
                        },
                    ],
                };
                return interaction.deferred ? interaction.editReply(settingsPayload) : interaction.reply(settingsPayload);
            }
            return super.error(interaction, language.get("COMMAND_GUILDUPDATE_NO_OPTIONS"));
        }
        if (subCommand === "view") {
            // Show the current settings for this (Also maybe in ;uc, but a summarized version?)
            return interaction.reply({
                embeds: [
                    {
                        title: `Guild update settings for ${interaction.user.username}`,
                        description: [
                            `Enabled:  **${gu.enabled ? "ON" : "OFF"}**`,
                            `Channel:  **${gu.channel ? `<#${gu.channel}>` : "N/A"}**`,
                            `Allycode: **${gu.allyCode ? gu.allyCode : "N/A"}**`,
                        ].join("\n"),
                    },
                ],
            });
        }

        // If we reach here, no valid subcommand was found
        return super.error(interaction, language.get("COMMAND_GUILDUPDATE_INVALID_SUBCOMMAND"));
    }
}
