const Command = require("../base/slashCommand");

class Poll extends Command {
    constructor(Bot) {
        super(Bot, {
            name: "poll",
            category: "Misc",
            aliases: ["vote"],
            permissions: ["EMBED_LINKS"],
            guildOnly: false,
            options: [
                // Subcommands for create, view, end, cancel, vote
                {
                    name: "create",
                    description: "Create a poll",
                    type: "SUB_COMMAND",
                    options: [
                        {
                            name: "question",
                            required: true,
                            description: "The question you want people to vote on",
                            type: "STRING"
                        },
                        {
                            name: "options",
                            required: true,
                            description: "Options for the poll, separated by a pipe symbol `|`",
                            type: "STRING"
                        },
                        {
                            name: "anonymous",
                            description: "If enabled, current votes will not be shown until the poll is closed. ",
                            type: "BOOLEAN"
                        }
                    ]
                },
                {
                    name: "end",
                    description: "End a poll, and show the final results",
                    type: "SUB_COMMAND",
                    options: []
                },
                {
                    name: "cancel",
                    description: "Cancel a poll, don't bother with the results",
                    type: "SUB_COMMAND",
                    options: []
                },
                {
                    name: "view",
                    description: "View the status of a poll with the current results",
                    type: "SUB_COMMAND",
                    options: [ ]
                },
                {
                    name: "vote",
                    description: "Vote on a poll (your vote will be hidden)",
                    type: "SUB_COMMAND",
                    options: [
                        {
                            name: "option",
                            required: true,
                            description: "The poll option you want to vote for",
                            type: "INTEGER",
                            min_value: 0,
                            max_value: 10,
                        }
                    ]
                }
            ]
        });
    }

    async run(Bot, interaction, options) {
        const action = interaction.options.getSubcommand();


        let poll = { // ID = guildID-channelID
            "question": "",
            "options": [],
            "votes": {
                // userID: vote#
            },
            "anon": false
        };

        if (!interaction.guild || !interaction.channel) {
            // This is not available in DMs
            // TODO Lang this
            return super.error(interaction, "Sorry, but this command is not available in DMs. If you are voting with `/poll vote`, it will only show for you.");
        }
        const pollID = `${interaction.guild.id}-${interaction.channel.id}`;

        // If they're just voting on the channel's poll
        const oldPollRes = await Bot.cache.get(Bot.config.mongodb.swgohbotdb, "polls", {id: pollID});
        let oldPoll = null;
        if (Array.isArray(oldPollRes)) {
            if (oldPollRes.length) {
                oldPoll = oldPollRes[0];
            }
        }
        if (oldPoll && action === "create") {
            // If they're trying to create a new poll when one exists, tell em
            return super.error(interaction, interaction.language.get("COMMAND_POLL_ALREADY_RUNNING"));
        } else if (!oldPoll && action !== "create") {
            // If they're tyring to use a poll that doesn't exist, let them know
            return super.error(interaction, "Sorry, but there is no poll active in this channel.");
        }

        if (oldPoll) {
            poll = oldPoll.poll;
        }

        // Make sure it's a mod or someone with the appropriate perms trying to create it
        const restrictedActions = ["cancel", "create", "end"];
        if (restrictedActions.includes(action) && options.level < Bot.constants.permMap.GUILD_ADMIN) {
            return super.error(interaction, interaction.language.get("COMMAND_MISSING_PERMS"));
        }

        switch (action) {
            case "create": {
                const optionsString = interaction.options.getString("options");
                poll.question       = interaction.options.getString("question");
                poll.anon           = interaction.options.getBoolean("anonymous");
                poll.options        = optionsString.split("|").map(opt => opt.trim());

                // Make sure the question is kept within a reasonable length (Not sure why I chose 256 at the time)
                if (poll.question.length >= 256) {
                    return super.error(interaction, interaction.language.get("COMMAND_POLL_TITLE_TOO_LONG"));
                }

                // Keep the choices limited to between 2 & 10 options
                if (poll.options.length < 2) {
                    return super.error(interaction, interaction.language.get("COMMAND_POLL_TOO_FEW_OPT"));
                } else if (poll.options.length > 10) {
                    return super.error(interaction, interaction.language.get("COMMAND_POLL_TOO_MANY_OPT"));
                }

                // Create a poll (lvl 3+)
                await Bot.cache.put(Bot.config.mongodb.swgohbotdb, "polls", {id: pollID}, {
                    id: pollID,
                    poll: poll
                })
                    .then(() => {
                        return interaction.reply({
                            content: interaction.language.get("COMMAND_POLL_CREATED_SLASH", interaction.user.tag, interaction.guildSettings.prefix),
                            embeds: [{
                                author: {
                                    name: poll.question
                                },
                                description: pollCheck(poll),
                                footer: getFooter(poll)
                            }]
                        });
                    })
                    .catch((err) => {
                        Bot.logger.error("Broke when creating a poll: \n" + err);
                        return super.error(interaction, "Sorry, but something went wrong when saving that poll. Please try again in a bit");
                    });
                break;
            }
            case "cancel": {
                // Cancel the current poll in a channel, need to ask for confirmation, maybe try and use a button here at some point?
                // Delete the current poll
                await Bot.cache.remove(Bot.config.mongodb.swgohbotdb, "polls", {id: pollID})
                    .then(() => {
                        // Then send a message confirming the deletion
                        return super.success(interaction, "> Poll deleted.");
                    })
                    .catch(() => {
                        // Or, if it breaks, tell them that it broke
                        return super.error(interaction, interaction.language.get("COMMAND_POLL_FINAL_ERROR", poll.question));
                    });
                break;
            }
            case "end": {
                // End the current poll in a channel, need to ask for confirmation, maybe try and use a button here at some point?
                // Delete the current poll
                await Bot.cache.remove(Bot.config.mongodb.swgohbotdb, "polls", {id: pollID})
                    .then(() => {
                        // Then send a message showing the final results
                        return interaction.reply({
                            embeds: [{
                                author: {
                                    name: interaction.language.get("COMMAND_POLL_FINAL", "")
                                },
                                description: `**${poll.question}**\n${pollCheck(poll, true)}`
                            }]
                        });
                    })
                    .catch(() => {
                        // Or, if it breaks, tell them that it broke
                        return super.error(interaction, interaction.language.get("COMMAND_POLL_FINAL_ERROR", poll.question));
                    });
                break;
            }
            case "view": {
                // View the current poll in a channel
                return interaction.reply({
                    embeds: [{
                        author: {
                            name: poll.question
                        },
                        description: pollCheck(poll),
                        footer: getFooter(poll)
                    }]
                });
            }
            case "vote": {
                // Vote on the current poll in a channel, and don't show any output for this
                // Doesn't need to be usable in DMs anymore because of the ephemeral reqponses now
                const opt = interaction.options.getInteger("option") - 1;
                if (poll.options.length <= opt || opt < 0) {
                    return super.error(interaction, interaction.language.get("COMMAND_POLL_INVALID_OPTION"), {ephemeral: true});
                } else {
                    let voted = null;
                    if (poll.votes[interaction.user.id] === opt) {
                        // Warn em that they're voting for the same thing they already voted for, so it won't be registered
                        return super.error(interaction, interaction.language.get("COMMAND_POLL_SAME_OPT", poll.options[opt]), {ephemeral: true});
                    } else if (!Number.isNaN(poll.votes[interaction.user.id])) {
                        voted = poll.votes[interaction.user.id];
                    }
                    poll.votes[interaction.user.id] = opt;
                    await Bot.cache.put(Bot.config.mongodb.swgohbotdb, "polls", {id: pollID}, {poll: poll})
                        .then(() => {
                            if (voted !== null && voted !== undefined) {
                                return interaction.reply({
                                    content: interaction.language.get("COMMAND_POLL_CHANGED_OPT", poll.options[voted], poll.options[opt]),
                                    ephemeral: true
                                });
                            } else {
                                return interaction.reply({
                                    content: interaction.language.get("COMMAND_POLL_REGISTERED", poll.options[opt]),
                                    ephemeral: true
                                });
                            }
                        });
                }
                break;
            }
        }

        function pollCheck(poll, showRes=false) {
            const voteCount = {};
            const totalVotes = Object.keys(poll.votes).length || 1;
            poll.options.forEach((opt, ix) => {
                voteCount[ix] = 0;
            });
            Object.keys(poll.votes).forEach(voter => {
                voteCount[poll.votes[voter]] += 1;
            });
            let outString = "";
            Object.keys(voteCount).forEach(opt => {
                const percent = Math.floor((voteCount[opt] / totalVotes) * 30);
                outString += `\`[${parseInt(opt, 10)+1}]\` **${poll.options[opt]}**\n`;
                if (!poll.anon || showRes) {
                    // If the poll is not set to anonymous, or it's told to show the results (for closing the poll)
                    outString += `**\`[${"#".repeat(percent)}${"-".repeat(30-percent)}]\`**(${voteCount[opt]})\n`;
                }
            });
            return outString;
        }

        function getFooter(poll) {
            const footer = {};
            if (interaction.guild) {
                footer.text = Bot.expandSpaces(interaction.language.get("COMMAND_POLL_FOOTER", poll.pollID, interaction.guildSettings.prefix));
            } else {
                footer.text = Bot.expandSpaces(interaction.language.get("COMMAND_POLL_DM_FOOTER", poll.pollID, interaction.guildSettings.prefix));
            }
            return footer;
        }
    }
}

module.exports = Poll;
