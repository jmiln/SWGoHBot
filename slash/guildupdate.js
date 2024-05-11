const Command = require("../base/slashCommand");
const { ApplicationCommandOptionType } = require("discord.js");

class GuildUpdate extends Command {
    constructor(Bot) {
        super(Bot, {
            name: "guildupdate",
            // category: "Patreon",
            guildOnly: false,
            aliases: ["gu"],
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
        });
    }

    async run(Bot, interaction, options) {
        // eslint-disable-line no-unused-vars
        const cmdOut = null;
        const outLog = [];

        const userID = interaction.user.id;
        const user = await Bot.userReg.getUser(userID);

        if (!user) {
            return super.error(interaction, "Sorry, but something went wrong and I couldn't find your data. Please try again.");
        }
        let gu = user.guildUpdate;
        const defGU = {
            enabled: false,
            channel: null,
            allycode: null,
        };
        if (!gu) {
            gu = defGU;
        }

        // GuildUpdate -> activate/ deactivate
        const pat = await Bot.getPatronUser(interaction.user.id);
        if (!pat || pat.amount_cents < 100) {
            return super.error(interaction, interaction.language.get("COMMAND_ARENAALERT_PATREON_ONLY"));
        }

        // Whether it's setting values or view
        const subCommand = interaction.options.getSubcommand();

        if (subCommand === "set") {
            const updatedArr = [];
            const isEnabled = interaction.options.getBoolean("enabled");
            const channel = interaction.options.getChannel("channel");
            let allycode = interaction.options.getString("allycode");

            if (isEnabled !== null) {
                gu.enabled = isEnabled;
                updatedArr.push(`Enabled: **${isEnabled}**`);
            }
            if (channel) {
                if (options.level < 3) {
                    return super.error(interaction, interaction.language.get("COMMAND_ARENAWATCH_MISSING_PERM"));
                }
                // This would be at lease MANAGE_CHANNEL perms, or the adminrole under the guildconf
                gu.channel = channel.id;
                updatedArr.push(`Channel: <#${channel.id}>`);
            }
            if (allycode) {
                // Make sure it's a correctly formatted code, or at least just 9 numbers
                if (!Bot.isAllyCode(allycode)) return super.error(interaction, interaction.language.get("COMMAND_ARENAWATCH_INVALID_AC"));

                // Grab a cleaned allycode
                allycode = Bot.getAllyCode(interaction, allycode);

                // Grab the info for the ally code from the api, to make sure the code is actually valid
                const player = await Bot.swgohAPI.unitStats(allycode);
                if (!player?.length) {
                    // Invalid code
                    return super.error(interaction, "I could not find a match for your ally code. Please double check that it is correct.");
                }
                gu.allycode = Number.parseInt(allycode, 10);
                updatedArr.push(`Ally Code: **${allycode}**`);
            }

            if (updatedArr.length) {
                user.guildUpdate = gu;
                await Bot.userReg.updateUser(userID, user);
                return interaction.reply({
                    content: null,
                    embeds: [
                        {
                            title: "Settings updated",
                            description: updatedArr.join("\n"),
                        },
                    ],
                });
            }
        } else if (subCommand === "view") {
            // Show the current settings for this (Also maybe in ;uc, but a summarized version?)
            return interaction.reply({
                embeds: [
                    {
                        title: `Guild update settings for ${interaction.user.username}`,
                        description: [
                            `Enabled:  **${gu.enabled ? "ON" : "OFF"}**`,
                            `Channel:  **${gu.channel ? `<#${gu.channel}>` : "N/A"}**`,
                            `Allycode: **${gu.allycode ? gu.allycode : "N/A"}**`,
                        ].join("\n"),
                    },
                ],
            });
        }

        return super.error(
            interaction,
            outLog.length
                ? outLog.join("\n")
                : interaction.language.get("COMMAND_ARENAALERT_UPDATED") + (cmdOut ? `\n\n#####################\n\n${cmdOut}` : ""),
            { title: " ", color: Bot.constants.colors.blue },
        );
    }
}

module.exports = GuildUpdate;
