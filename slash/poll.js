import { ApplicationCommandOptionType, MessageFlags } from "discord.js";
import Command from "../base/slashCommand.js";
import { getGuildPolls, setGuildPolls } from "../modules/guildConfig/polls.js";

export default class Poll extends Command {
    constructor(Bot) {
        super(Bot, {
            name: "poll",
            guildOnly: false,
            options: [
                // Subcommands for create, view, end, cancel, vote
                {
                    name: "create",
                    description: "Create a poll",
                    type: ApplicationCommandOptionType.Subcommand,
                    options: [
                        {
                            name: "question",
                            required: true,
                            description: "The question you want people to vote on",
                            type: ApplicationCommandOptionType.String,
                        },
                        {
                            name: "options",
                            required: true,
                            description: "Options for the poll, separated by a pipe symbol `|`",
                            type: ApplicationCommandOptionType.String,
                        },
                        {
                            name: "anonymous",
                            description: "If enabled, current votes will not be shown until the poll is closed. ",
                            type: ApplicationCommandOptionType.Boolean,
                        },
                    ],
                },
                {
                    name: "end",
                    description: "End a poll, and show the final results",
                    type: ApplicationCommandOptionType.Subcommand,
                    options: [],
                },
                {
                    name: "cancel",
                    description: "Cancel a poll, don't bother with the results",
                    type: ApplicationCommandOptionType.Subcommand,
                    options: [],
                },
                {
                    name: "view",
                    description: "View the status of a poll with the current results",
                    type: ApplicationCommandOptionType.Subcommand,
                    options: [],
                },
                {
                    name: "vote",
                    description: "Vote on a poll (your vote will be hidden)",
                    type: ApplicationCommandOptionType.Subcommand,
                    options: [
                        {
                            name: "option",
                            required: true,
                            description: "The poll option you want to vote for",
                            type: ApplicationCommandOptionType.Integer,
                            minValue: 0,
                            maxValue: 10,
                        },
                    ],
                },
            ],
        });
    }

    async run(Bot, interaction, options) {
        const action = interaction.options.getSubcommand();

        const poll = {
            question: "",
            options: [],
            votes: {
                // userID: vote#
            },
            anon: false,
            channelId: interaction.channel.id,
        };

        if (!interaction.guild || !interaction.channel) {
            // This is not available in DMs
            // TODO Lang this
            return super.error(
                interaction,
                "Sorry, but this command is not available in DMs. If you are voting with `/poll vote`, it will only show for you.",
            );
        }

        const pollsArr = await getGuildPolls({ cache: Bot.cache, guildId: interaction.guild.id });
        const oldPoll = pollsArr.find((p) => p.channelId === interaction.channel.id);

        if (oldPoll && action === "create") {
            // If they're trying to create a new poll when one exists, tell em
            return super.error(interaction, interaction.language.get("COMMAND_POLL_ALREADY_RUNNING"));
        }
        if (!oldPoll && action !== "create") {
            // If they're tyring to use a poll that doesn't exist, let them know
            return super.error(interaction, "Sorry, but there is no poll active in this channel.");
        }

        // Make sure it's a mod or someone with the appropriate perms trying to create it
        const restrictedActions = ["cancel", "create", "end"];
        if (restrictedActions.includes(action) && options.level < Bot.constants.permMap.GUILD_ADMIN) {
            return super.error(interaction, interaction.language.get("COMMAND_MISSING_PERMS"));
        }

        switch (action) {
            // Create a poll (lvl 3+)
            case "create": {
                const optionsString = interaction.options.getString("options");
                poll.question = interaction.options.getString("question");
                poll.anon = interaction.options.getBoolean("anonymous") || false;
                poll.options = optionsString.split("|").map((opt) => opt.trim());

                // Make sure the question is kept within a reasonable length (Not sure why I chose 256 at the time)
                if (poll.question.length >= 256) {
                    return super.error(interaction, interaction.language.get("COMMAND_POLL_TITLE_TOO_LONG"));
                }

                // Keep the choices limited to between 2 & 10 options
                if (poll.options.length < 2) {
                    return super.error(interaction, interaction.language.get("COMMAND_POLL_TOO_FEW_OPT"));
                }
                if (poll.options.length > 10) {
                    return super.error(interaction, interaction.language.get("COMMAND_POLL_TOO_MANY_OPT"));
                }

                pollsArr.push(poll);
                await setGuildPolls({ cache: Bot.cache, guildId: interaction.guild.id, pollsOut: pollsArr });
                return interaction.reply({
                    content: interaction.language.get("COMMAND_POLL_CREATED_SLASH", interaction.user.tag),
                    embeds: [
                        {
                            author: {
                                name: poll.question,
                            },
                            description: pollCheck(poll),
                            footer: getFooter(),
                        },
                    ],
                });
            }
            case "cancel": {
                // Cancel the current poll in a channel, should ask for confirmation, maybe try and use a button here at some point?
                // Delete the current poll
                const targetIndex = pollsArr.find((p) => p.channelId === interaction.channel.id);
                try {
                    pollsArr.splice(targetIndex, 1);
                    await setGuildPolls({ cache: Bot.cache, guildId: interaction.guild.id, pollsOut: pollsArr });
                    return super.success(interaction, "> Poll deleted.");
                } catch (err) {
                    return super.error(interaction, interaction.language.get("COMMAND_POLL_FINAL_ERROR", poll.question));
                }
            }
            case "end": {
                // End the current poll in a channel, should probably ask for confirmation, maybe try and use a button here at some point?
                // Delete the current poll
                const targetIndex = pollsArr.find((p) => p.channelId === interaction.channel.id);
                try {
                    pollsArr.splice(targetIndex, 1);
                    await setGuildPolls({ cache: Bot.cache, guildId: interaction.guild.id, pollsOut: pollsArr });
                    return interaction.reply({
                        embeds: [
                            {
                                author: {
                                    name: interaction.language.get("COMMAND_POLL_FINAL", ""),
                                },
                                description: `**${oldPoll.question}**\n${pollCheck(oldPoll, true)}`,
                            },
                        ],
                    });
                } catch (err) {
                    return super.error(interaction, interaction.language.get("COMMAND_POLL_FINAL_ERROR", poll.question));
                }
            }
            case "view": {
                // View the current poll in a channel
                return interaction.reply({
                    embeds: [
                        {
                            author: {
                                name: oldPoll.question,
                            },
                            description: pollCheck(oldPoll),
                            footer: getFooter(),
                        },
                    ],
                });
            }
            case "vote": {
                // Vote on the current poll in a channel, and don't show any output for this
                // Doesn't need to be usable in DMs anymore because of the ephemeral reqponses now
                const opt = interaction.options.getInteger("option") - 1;
                if (oldPoll.options.length <= opt || opt < 0) {
                    return super.error(interaction, interaction.language.get("COMMAND_POLL_INVALID_OPTION"), { ephemeral: true });
                }
                const targetIndex = pollsArr.find((p) => p.channelId === interaction.channel.id);
                let voted = null;
                if (oldPoll.votes[interaction.user.id] === opt) {
                    // Warn em that they're voting for the same thing they already voted for, so it won't be registered
                    return super.error(interaction, interaction.language.get("COMMAND_POLL_SAME_OPT", oldPoll.options[opt]), {
                        flags: MessageFlags.Ephemeral,
                    });
                }
                if (!Number.isNaN(oldPoll.votes[interaction.user.id])) {
                    // If they've already voted, store that to use later
                    voted = oldPoll.votes[interaction.user.id];
                }
                oldPoll.votes[interaction.user.id] = opt;

                try {
                    pollsArr[targetIndex] = oldPoll;
                    await setGuildPolls({ cache: Bot.cache, guildId: interaction.guild.id, pollsOut: pollsArr });
                    if (voted !== null && voted !== undefined) {
                        return interaction.reply({
                            content: interaction.language.get("COMMAND_POLL_CHANGED_OPT", oldPoll.options[voted], oldPoll.options[opt]),
                            flags: MessageFlags.Ephemeral,
                        });
                    }
                    return interaction.reply({
                        content: interaction.language.get("COMMAND_POLL_REGISTERED", oldPoll.options[opt]),
                        flags: MessageFlags.Ephemeral,
                    });
                } catch (err) {
                    return console.error(`[/poll vote] Error voting: ${err}`);
                }
            }
        }

        function pollCheck(poll, showRes = false) {
            const voteCount = {};
            const totalVotes = Object.keys(poll.votes).length || 1;
            poll.options.forEach((_, ix) => {
                voteCount[ix] = 0;
            });
            for (const voter of Object.keys(poll.votes)) {
                voteCount[poll.votes[voter]] += 1;
            }
            let outString = "";
            for (const opt of Object.keys(voteCount)) {
                const percent = Math.floor((voteCount[opt] / totalVotes) * 30);
                outString += `\`[${Number.parseInt(opt, 10) + 1}]\` **${poll.options[opt]}**\n`;
                if (!poll.anon || showRes) {
                    // If the poll is not set to anonymous, or it's told to show the results (for closing the poll)
                    outString += `**\`[${"#".repeat(percent)}${"-".repeat(30 - percent)}]\`**(${voteCount[opt]})\n`;
                }
            }
            return outString;
        }

        function getFooter() {
            const footer = {};
            if (interaction.guild) {
                footer.text = Bot.expandSpaces(interaction.language.get("COMMAND_POLL_FOOTER"));
            } else {
                footer.text = Bot.expandSpaces(interaction.language.get("COMMAND_POLL_DM_FOOTER"));
            }
            return footer;
        }
    }
}
