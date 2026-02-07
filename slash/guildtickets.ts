import { ApplicationCommandOptionType, InteractionContextType } from "discord.js";
import Command from "../base/slashCommand.ts";
import { getAllyCode, isAllyCode, toProperCase } from "../modules/functions.ts";
import patreonFuncs from "../modules/patreonFuncs.ts";
import swgohAPI from "../modules/swapi.ts";
import userReg from "../modules/users.ts";
import type { CommandContext } from "../types/types.ts";

const updateTypeStrings = {
    update: "Update every 5min",
    msg: "Send a message near reset",
};

export default class GuildTickets extends Command {
    static readonly metadata = {
        name: "guildtickets",
        guildOnly: false,
        contexts: [InteractionContextType.Guild],
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
    };
    constructor() {
        super(GuildTickets.metadata);
    }

    async run({ interaction, language, permLevel }: CommandContext) {
        const userID = interaction.user.id;
        const user = await userReg.getUser(userID);

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
            msgId: "",
            nextChallengesRefresh: "",
        };
        if (!gt) {
            gt = defGT;
        }

        const pat = await patreonFuncs.getPatronUser(interaction.user.id);
        if (!pat || pat.amount_cents < 100) {
            return super.error(interaction, language.get("COMMAND_ARENAALERT_PATREON_ONLY"));
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
                if (permLevel < 3) {
                    return super.error(interaction, language.get("COMMAND_ARENAWATCH_MISSING_PERM"));
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
                if (!isAllyCode(allycode) && allycode !== "me")
                    return super.error(interaction, language.get("COMMAND_ARENAWATCH_INVALID_AC"));

                // Grab a cleaned allycode
                allycode = await getAllyCode(interaction, allycode);

                // Grab the info for the ally code from the api, to make sure the code is actually valid
                const player = await swgohAPI.unitStats(Number.parseInt(allycode, 10));
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
                await userReg.updateUser(userID, user);
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
            return super.error(interaction, "No options provided. Please specify at least one setting to update.");
        }
        if (subCommand === "view") {
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
                            `SortBy:   **${toProperCase(gt.sortBy)}**`,
                            `Updates:  **${gt?.updateType ? updateTypeStrings[gt.updateType] : updateTypeStrings.update}**`,
                            `Tickets:  **${gt.tickets || 600}**`,
                        ].join("\n"),
                    },
                ],
            });
        }
    }
}
