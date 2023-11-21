const Command = require("../base/slashCommand");
const { ApplicationCommandOptionType } = require("discord.js");

class ArenaAlert extends Command {
    constructor(Bot) {
        super(Bot, {
            name: "arenaalert",
            description: "Change settings for your arena alerts",
            guildOnly: false,
            options: [
                {
                    name: "enabledms",
                    type: ApplicationCommandOptionType.String,
                    description: "Set if it's going to DM you for jumps",
                    choices: [
                        {
                            name: "All",
                            value: "all"
                        },
                        {
                            name: "Primary",
                            value: "primary"
                        },
                        {
                            name: "Off",
                            value: "off"
                        }
                    ]
                },
                {
                    name: "arena",
                    type: ApplicationCommandOptionType.String,
                    description: "Set which arena it will watch.",
                    choices: [
                        {
                            name: "Char",
                            value: "char"
                        },
                        {
                            name: "Fleet",
                            value: "fleet"
                        },
                        {
                            name: "Both",
                            value: "both"
                        }
                    ]
                },
                {
                    name: "payout_result",
                    type: ApplicationCommandOptionType.String,
                    description: "Send you a DM with your final payout result",
                    choices: [
                        {
                            name: "On",
                            value: "on"
                        },
                        {
                            name: "Off",
                            value: "off"
                        }
                    ]
                },
                {
                    name: "payout_warning",
                    type: ApplicationCommandOptionType.Integer,
                    description: "(0-1439) Send you a DM the set number of min before your payout. 0 to turn it off.",
                    minValue: 0,
                    maxValue: 1440,
                }
            ]
        });
    }

    async run(Bot, interaction) {  // eslint-disable-line no-unused-vars
        const enabledms = interaction.options.getString("enabledms");
        const arena = interaction.options.getString("arena");
        const payoutResult = interaction.options.getString("payout_result");
        const payoutWarning = interaction.options.getInteger("payout_warning");

        // Grab the user's info
        const userID = interaction.user.id;
        const user = await Bot.userReg.getUser(userID); // eslint-disable-line no-unused-vars
        if (!user) {
            return super.error(interaction, "Sorry, but something went wrong and I couldn't find your data. Please try again.");
        }

        // Make sure the user is a patreon
        const pat = await Bot.getPatronUser(userID);
        if (!pat || pat.amount_cents < 100) {
            return super.error(interaction, interaction.language.get("COMMAND_ARENAALERT_PATREON_ONLY"));
        }

        if (!enabledms && !arena && !payoutResult && (!payoutWarning && payoutWarning !== 0)) {
            // If none of the arguments are used, just view
            return interaction.reply({embeds: [{
                title: interaction.language.get("COMMAND_ARENAALERT_VIEW_HEADER"),
                description: [
                    `${interaction.language.get("COMMAND_ARENAALERT_VIEW_DM")}: **${user.arenaAlert.enableRankDMs ? user.arenaAlert.enableRankDMs : "N/A"}**`,
                    `${interaction.language.get("COMMAND_ARENAALERT_VIEW_SHOW")}: **${user.arenaAlert.arena}**`,
                    `${interaction.language.get("COMMAND_ARENAALERT_VIEW_WARNING")}: **${user.arenaAlert.payoutWarning ? user.arenaAlert.payoutWarning + " min" : "disabled"}**`,
                    `${interaction.language.get("COMMAND_ARENAALERT_VIEW_RESULT")}: **${user.arenaAlert.enablePayoutResult ? "ON" : "OFF"}**`
                ].join("\n")
            }]});
        }

        const changelog = [];

        // ArenaAlert -> activate/ deactivate
        if (enabledms && user.arenaAlert.enableRankDMs !== enabledms) {
            changelog.push(`Changed EnableDMs from ${user.arenaAlert.enableRankDMs} to ${enabledms}`);
            user.arenaAlert.enableRankDMs = enabledms;
        }

        // Set which of the arenas to watch (char, fleet, both)
        if (arena && user.arenaAlert.arena !== arena) {
            changelog.push(`Changed arena from ${user.arenaAlert.arena} to ${arena}`);
            user.arenaAlert.arena = arena;
        }

        // Set to DM the user with their final result or not
        if (payoutResult && user.arenaAlert.payoutResult !== payoutResult) {
            changelog.push(`Changed Payout Result from ${user.arenaAlert.payoutResult} to ${payoutResult}`);
            user.arenaAlert.payoutResult = payoutResult;
        }

        // Set how long before their payout to warn them
        if (payoutWarning && !Number.isNaN(payoutWarning)) {
            if (payoutWarning < 0 || payoutWarning > 1439) {
                changelog.push(`Cannot change the Payout Warning to ${payoutWarning}. Value must be between 0 and 1439`);
            } else if (user.arenaAlert.payoutWarning !== payoutWarning) {
                changelog.push(`Changed Payout Warning from ${user.arenaAlert.payoutWarning} to ${payoutWarning}`);
                user.arenaAlert.payoutWarning = payoutWarning;
            }
        }

        // TODO Get a res from this, so it can be replied to more accurately
        await Bot.userReg.updateUser(userID, user);
        if (!changelog?.length) {
            return super.success(interaction, "It looks like nothing was updated.");
        }
        return super.success(interaction, changelog.join("\n"));
    }
}

module.exports = ArenaAlert;
