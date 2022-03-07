import SlashCommand from "../base/slashCommand";

class ArenaAlert extends SlashCommand {
    constructor(Bot) {
        super(Bot, {
            name: "arenaalert",
            category: "Patreon",
            description: "Change settings for your arena alerts",
            guildOnly: false,
            options: [
                {
                    name: "enabledms",
                    type: "STRING",
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
                    type: "STRING",
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
                    type: "STRING",
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
                    type: "INTEGER",
                    description: "(0-1439) Send you a DM the set number of min before your payout. 0 to turn it off.",
                    min_value: 0,
                    max_value: 1440,
                }
            ]
        });
    }

    async run(Bot, interaction, options={}) {  // eslint-disable-line no-unused-vars
        const enabledms = interaction.options.getString("enabledms");
        const arena = interaction.options.getString("arena");
        const payoutResult = interaction.options.getString("payout_result");
        const payoutWarning = interaction.options.getInteger("payout_warning");

        // This is to let me view others' configs to help them out, but will need fiddling to work with slash commands
        // if (options.subArgs.user && options.level < 9) {
        //     return super.error(message, message.language.get("COMMAND_USERCONF_CANNOT_VIEW_OTHER"));
        // } else if (options.subArgs.user) {
        //     userID = options.subArgs.user.replace(/[^\d]*/g, "");
        //     if (!Bot.isUserID(userID)) {
        //         return super.error(message, "Invalid user ID");
        //     }
        // }

        // Grab the user's info
        const userID = interaction.user.id;
        const user = await Bot.userReg.getUser(userID); // eslint-disable-line no-unused-vars
        if (!user) {
            return super.error(interaction, "Sorry, but something went wrong and I couldn't find your data. Please try again.");
        }

        // Make sure the user is a patreon
        const pat = Bot.getPatronUser(interaction.user.id);
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

        const changeLog = [];

        // ArenaAlert -> activate/ deactivate
        if (enabledms) {
            if (user.arenaAlert.enableRankDMs !== enabledms) {
                changeLog.push(`Changed EnableDMs from ${user.arenaAlert.enableRankDMs} to ${enabledms}`);
            }
            user.arenaAlert.enableRankDMs = enabledms;
        }

        // Set which of the arenas to watch (char, fleet, both)
        if (arena) {
            if (user.arenaAlert.arena !== arena) {
                changeLog.push(`Changed arena from ${user.arenaAlert.arena} to ${arena}`);
            }
            user.arenaAlert.arena = arena;
        }

        // Set to DM the user with their final result or not
        if (payoutResult) {
            if (user.arenaAlert.payoutResult !== payoutResult) {
                changeLog.push(`Changed Payout Result from ${user.arenaAlert.payoutResult} to ${payoutResult}`);
            }
            user.arenaAlert.payoutResult = payoutResult;
        }

        // Set how long before their payout to warn them
        if (payoutWarning) {
            if (payoutWarning < 0 || payoutWarning > 1439) {
                changeLog.push(`Cannot change the Payout Warning to ${payoutWarning}. Value must be between 0 and 1439`);
            } else {
                if (user.arenaAlert.payoutWarning !== payoutWarning) {
                    changeLog.push(`Changed Payout Warning from ${user.arenaAlert.payoutWarning} to ${payoutWarning}`);
                }
                user.arenaAlert.payoutWarning = payoutWarning;
            }
        }

        await Bot.userReg.updateUser(userID, user);
        return super.success(interaction, changeLog.join("\n"));
    }
}

module.exports = ArenaAlert;
