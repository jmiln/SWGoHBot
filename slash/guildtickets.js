const Command = require("../base/slashCommand");
const { ApplicationCommandOptionType } = require("discord.js");

class GuildTickets extends Command {
    constructor(Bot) {
        super(Bot, {
            name: "guildtickets",
            // category: "Patreon",
            guildOnly: false,
            description: "Set up the guild watcher to show the guild's tickets needed every 5min",
            options: [
                {
                    name: "set",
                    description: "Change the settings",
                    type: ApplicationCommandOptionType.Subcommand,
                    options: [
                        {
                            name: "enabled",
                            description: "Turn the updates on or off",
                            type: ApplicationCommandOptionType.Boolean
                        },
                        {
                            name: "channel",
                            description: "Set which channel to log updates to",
                            type: ApplicationCommandOptionType.Channel
                        },
                        {
                            name: "sortby",
                            description: "Choose how to sort the list",
                            type: ApplicationCommandOptionType.String,
                            choices: [
                                {
                                    name: "Tickets",
                                    value: "tickets"
                                },
                                {
                                    name: "Name",
                                    value: "name"
                                }
                            ]
                        },
                        {
                            name: "allycode",
                            description: "Set what ally code to get the guild's info from",
                            type: ApplicationCommandOptionType.String
                        }
                    ]
                },
                {
                    name: "view",
                    description: "View the settings for your guild updates",
                    type: ApplicationCommandOptionType.Subcommand
                }
            ]
        });
    }

    async run(Bot, interaction, options) { // eslint-disable-line no-unused-vars
        const cmdOut = null;
        const outLog = [];

        const userID = interaction.user.id;
        const user = await Bot.userReg.getUser(userID);

        if (!user) {
            return super.error(interaction, "Sorry, but something went wrong and I couldn't find your data. Please try again.");
        }
        let gt = user.guildTickets;
        const defGT = {
            enabled: false,
            channel: null,
            allycode: null,
            sortBy: "name"
        };
        if (!gt) {
            gt = defGT;
        }

        // GuildTickets -> activate/ deactivate
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
            const sortBy = interaction.options.getString("sortby");
            let allycode = interaction.options.getString("allycode");

            if (isEnabled !== null) {
                gt.enabled = isEnabled;
                updatedArr.push(`Enabled: **${isEnabled}**`);
            }
            if (channel) {
                if (options.level < 3) {
                    return super.error(interaction, interaction.language.get("COMMAND_ARENAWATCH_MISSING_PERM"));
                }
                // This would be at lease MANAGE_CHANNEL perms, or the adminrole under the guildconf
                gt.channel = channel.id;
                updatedArr.push(`Channel: <#${channel.id}>`);
            }
            if (allycode) {
                // Make sure it's a correctly formatted code, or at least just 9 numbers
                if (!Bot.isAllyCode(allycode) && allycode !== "me")  return super.error(interaction, interaction.language.get("COMMAND_ARENAWATCH_INVALID_AC"));

                // Grab a cleaned allycode
                allycode = await Bot.getAllyCode(interaction, allycode);

                // Grab the info for the ally code from the api, to make sure the code is actually valid
                const player = await Bot.swgohAPI.unitStats(allycode);
                if (!player?.length) {
                    // Invalid code
                    return super.error(interaction, "I could not find a match for your ally code. Please double check that it is correct.");
                }
                gt.allycode = parseInt(allycode, 10);
                updatedArr.push(`Ally Code: **${allycode}**`);
            }
            if (sortBy) {
                gt.sortBy = sortBy;
                updatedArr.push(`Sort By: **${sortBy}**`);
            }

            if (updatedArr.length) {
                user.guildTickets = gt;
                await Bot.userReg.updateUser(userID, user);
                return interaction.reply({content: null, embeds: [{
                    title: "Settings updated",
                    description: updatedArr.join("\n")
                }]});
            }
        } else if (subCommand === "view") {
            // Show the current settings for this (Also maybe in ;uc, but a summarized version?)
            return interaction.reply({embeds: [{
                title: `Guild Tickets settings for ${interaction.user.username}`,
                description: [
                    `Enabled:  **${gt.enabled ? "ON" : "OFF"}**`,
                    `Channel:  **${gt.channel ? "<#" + gt.channel + ">" : "N/A"}**`,
                    `Allycode: **${gt.allycode ? gt.allycode : "N/A"}**`,
                    `SortBy:   **${Bot.toProperCase(gt.sortBy)}**`,
                ].join("\n")
            }]});
        }

        return super.error(interaction, outLog.length ? outLog.join("\n") : interaction.language.get("COMMAND_ARENAALERT_UPDATED") + (cmdOut ? "\n\n#####################\n\n" + cmdOut : ""), {title: " ", color: Bot.constants.colors.blue});
    }
}


module.exports = GuildTickets;
