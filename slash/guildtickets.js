const Command = require("../base/slashCommand");
const { ApplicationCommandOptionType } = require("discord.js");

const updateTypeStrings = {
    update: "Update every 5min",
    msg: "Send a message near reset",
};

class GuildTickets extends Command {
    constructor(Bot) {
        super(Bot, {
            name: "guildtickets",
            guildOnly: false,
            description: "(Patreon command) Set up the guild watcher to automatically display a guild's current ticket counts",
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
                            name: "show_max",
                            description: "Show players who have all of their tickets",
                            type: ApplicationCommandOptionType.Boolean,
                        },
                        {
                            name: "sortby",
                            description: "Choose how to sort the list",
                            type: ApplicationCommandOptionType.String,
                            choices: [
                                {
                                    name: "Tickets",
                                    value: "tickets",
                                },
                                {
                                    name: "Name",
                                    value: "name",
                                },
                            ],
                        },
                        {
                            name: "updates",
                            description: "Choose how updates are displayed",
                            type: ApplicationCommandOptionType.String,
                            choices: [
                                {
                                    name: "Update every 5min",
                                    value: "update",
                                },
                                {
                                    name: "Send a message near reset",
                                    value: "msg",
                                },
                            ],
                        },
                        {
                            name: "tickets",
                            description: "Set the max expected tickets",
                            type: ApplicationCommandOptionType.Integer,
                            minValue: 1,
                            maxValue: 600,
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
        let gt = user.guildTickets;
        const defGT = {
            allycode: null,
            channel: null,
            enabled: false,
            showMax: false,
            sortBy: "name",
            tickets: 600,
            updateType: "msg",
        };
        if (!gt) {
            gt = defGT;
        }

        const pat = await Bot.getPatronUser(interaction.user.id);
        if (!pat || pat.amount_cents < 100) {
            return super.error(interaction, interaction.language.get("COMMAND_ARENAALERT_PATREON_ONLY"));
        }

        const subCommand = interaction.options.getSubcommand();

        // Whether it's setting values or view
        if (subCommand === "set") {
            const updatedArr = [];
            const channel = interaction.options.getChannel("channel");
            const isEnabled = interaction.options.getBoolean("enabled");
            const showMax = interaction.options.getBoolean("show_max");
            const sortBy = interaction.options.getString("sortby");
            const tickets = interaction.options.getInteger("tickets");
            const updateType = interaction.options.getString("updates");
            let allycode = interaction.options.getString("allycode");

            // GuildTickets -> activate/ deactivate
            if (isEnabled !== null) {
                gt.enabled = isEnabled;
                updatedArr.push(`Enabled: **${isEnabled}**`);
            }
            if (channel) {
                if (options.level < 3) {
                    return super.error(interaction, interaction.language.get("COMMAND_ARENAWATCH_MISSING_PERM"));
                }
                // This would be at least MANAGE_CHANNEL perms, or the adminrole from guildconf
                gt.channel = channel.id;
                updatedArr.push(`Channel: <#${channel.id}>`);
            }
            if (updateType) {
                gt.updateType = updateType;
                updatedArr.push(`Update: **${updateTypeStrings[updateType]}**`);
            }
            if (allycode) {
                // Make sure it's a correctly formatted code, or at least just 9 numbers
                if (!Bot.isAllyCode(allycode) && allycode !== "me")
                    return super.error(interaction, interaction.language.get("COMMAND_ARENAWATCH_INVALID_AC"));

                // Grab a cleaned allycode
                allycode = await Bot.getAllyCode(interaction, allycode);

                // Grab the info for the ally code from the api, to make sure the code is actually valid
                const player = await Bot.swgohAPI.unitStats(allycode);
                if (!player?.length) {
                    // Invalid code
                    return super.error(interaction, "I could not find a match for your ally code. Please double check that it is correct.");
                }
                gt.allycode = Number.parseInt(allycode, 10);
                updatedArr.push(`Ally Code: **${allycode}**`);
            }
            if (showMax !== null) {
                gt.showMax = showMax;
                updatedArr.push(`Show max: **${showMax}**`);
            }
            if (sortBy) {
                gt.sortBy = sortBy;
                updatedArr.push(`Sort By: **${sortBy}**`);
            }
            if (tickets) {
                gt.tickets = tickets;
                updatedArr.push(`Tickets: **${tickets}**`);
            }

            if (updatedArr.length) {
                user.guildTickets = gt;
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
                        title: `Guild Tickets settings for ${interaction.user.username}`,
                        description: [
                            `Enabled:  **${gt.enabled ? "ON" : "OFF"}**`,
                            `Channel:  **${gt.channel ? `<#${gt.channel}>` : "N/A"}**`,
                            `Allycode: **${gt.allycode ? gt.allycode : "N/A"}**`,
                            `Show Max: **${gt?.showMax ? "ON" : "OFF"}**`,
                            `SortBy:   **${Bot.toProperCase(gt.sortBy)}**`,
                            `Updates:  **${gt?.updateType ? updateTypeStrings[gt.updateType] : updateTypeStrings.update}**`,
                            `Tickets:  **${gt.tickets || 600}**`,
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

module.exports = GuildTickets;
