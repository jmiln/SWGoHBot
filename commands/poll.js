const Command = require("../base/Command");

class Poll extends Command {
    constructor(Bot) {
        super(Bot, {
            name: "poll",
            category: "Misc",
            aliases: ["vote"],
            permissions: ["EMBED_LINKS"],
            flags: {
                anon: {
                    aliases: ["anonymous"]
                }
            },
            subArgs: {
                pollID: {
                    aliases: ["poll"]
                }
            }
        });
    }

    async run(Bot, message, [action, ...opts], options) {
        const level = options.level;
        const client = message.client;
        if (!action) {
            return super.error(message, message.language.get("COMMAND_POLL_NO_ARG"));
        }
        let poll = { // ID = guildID-channelID
            "question": "",
            "options": [],
            "votes": {
                // userID: vote#
            },
            "anon": false
        };
        const optsJoin = opts.join(" ").split("|");
        let pollID;
        let exists = false;
        // If subArgs.poll is there, get that instead, and check if it's for a channel
        // that the user has access to
        if (options.subArgs.pollID) {
            // If they're using the auto-incrementing ID to vote from anywhere
            if (isNaN(parseInt(options.subArgs.pollID, 10))) {
                return super.error(message, "Invalid poll ID");
            }
            exists = await Bot.database.models.polls.findOne({where: {pollId: options.subArgs.pollID}})
                .then(token => token != null)
                .then(isUnique => isUnique);

            if (exists) {
                const tempP = await Bot.database.models.polls.findOne({where: {pollId: options.subArgs.pollID}, attributes: ["id", "poll", "pollId"]});
                const thisPoll = tempP.dataValues;
                poll = thisPoll.poll;
                poll.pollID = thisPoll.pollId;
                pollID = thisPoll.id;
                const [guildID, chanID] = pollID.split("-");

                // If they do not have access to the channel, tell em so/ don't let them interact with the poll (see/ vote)
                if (client.guilds.cache.has(guildID) && client.guilds.cache.get(guildID).channels.cache.has(chanID)) {
                    const perms = client.guilds.cache.get(guildID).channels.cache.get(chanID).permissionsFor(message.author.id);
                    if (!perms || !perms.has("VIEW_CHANNEL")) {
                        // The guild and channel exist, but the message author cannot see it
                        return super.error(message, message.language.get("COMMAND_POLL_NO_ACCESS"));
                    }
                }
                if (message.guild && message.guild.id !== guildID) {
                    // Make it so remote voting is only usable within DMs or in the same guild
                    return super.error(message, "Sorry, but you must be in a DM or in the same server to vote remotely.");
                }
            } else {
                return super.error(message, message.language.get("COMMAND_POLL_INVALID_ID"));
            }
            const actions = ["view", "check"];
            if (!actions.includes(action.toLowerCase()) && !action.match(/\d/)) {
                return super.error(message, message.language.get("COMMAND_POLL_REMOTE_OPTS"));
            }
            // If they get past all the stuff before here, they should be good to go
        } else if (!message.guild) {
            // If they're trying to use this in a DM
            return super.error(message, message.language.get("COMMAND_POLL_DM_USE", message.guildSettings.prefix));
        } else {
            // If they're just voting on the channel's poll
            pollID = `${message.guild.id}-${message.channel.id}`;
            exists = await Bot.database.models.polls.findOne({where: {id: pollID}})
                .then(token => token != null)
                .then(isUnique => isUnique);

            if (exists) {
                const tempP = await Bot.database.models.polls.findOne({where: {id: pollID}});
                poll = tempP.dataValues.poll;
                poll.pollID = tempP.dataValues.pollId;
            }
        }
        switch (action) {
            case "start":
            case "create": {
                // Create a poll (lvl 3+)
                if (level < 3) {
                    return super.error(message, message.language.get("COMMAND_MISSING_PERMS"));
                }
                if (exists) {
                    return super.error(message, message.language.get("COMMAND_POLL_ALREADY_RUNNING"));
                }
                if (!optsJoin[0]) {
                    return super.error(message, message.language.get("COMMAND_POLL_MISSING_QUESTION"));
                } else {
                    poll.question = optsJoin[0];
                    optsJoin.splice(0,1);
                    if (poll.question.length >= 256) {
                        return super.error(message, message.language.get("COMMAND_POLL_TITLE_TOO_LONG"));
                    }
                }
                if (optsJoin.length < 2) {
                    return super.error(message, message.language.get("COMMAND_POLL_TOO_FEW_OPT"));
                } else if (optsJoin.length > 10) {
                    return super.error(message, message.language.get("COMMAND_POLL_TOO_MANY_OPT"));
                } else {
                    poll.options = optsJoin.map(opt => opt.trim());
                }
                if (options.flags.anon) {
                    poll.anon = true;
                }
                await Bot.database.models.polls.create({
                    id: pollID,
                    poll: poll
                })
                    .then((thisPoll) => {
                        poll.pollID = thisPoll.dataValues.pollId;
                        return message.channel.send(message.language.get("COMMAND_POLL_CREATED", message.author.tag, message.guildSettings.prefix), {embed: {
                            author: {
                                name: poll.question
                            },
                            description: pollCheck(poll),
                            footer: getFooter(poll)
                        }});
                    });
                break;
            }
            case "view":
            case "check": {
                // Check the current poll
                if (!exists) {
                    return super.error(message, message.language.get("COMMAND_POLL_NO_POLL"));
                } else {
                    if (poll.question.length > 256) {
                        // Should not happen, but just in case
                        return message.channel.send({embed: {
                            author: {
                                name: "Current Poll"
                            },
                            description: `**${poll.question}**\n\n${pollCheck(poll)}`,
                            footer: getFooter(poll)
                        }});
                    } else {
                        return message.channel.send({embed: {
                            author: {
                                name: poll.question
                            },
                            description: pollCheck(poll),
                            footer: getFooter(poll)
                        }});
                    }
                }
            }
            case "close":
            case "end": {
                // Close the current poll and send the results (lvl 3+)
                if (level < 3) {
                    return super.error(message, message.language.get("COMMAND_MISSING_PERMS"));
                }
                if (!exists) {
                    return super.error(message, message.language.get("COMMAND_POLL_NO_POLL"));
                } else {
                    // Delete the current poll
                    await Bot.database.models.polls.destroy({where: {id: pollID}})
                        .then(() => {
                            // Then send a message showing the final results
                            return message.channel.send({embed: {
                                author: {
                                    name: message.language.get("COMMAND_POLL_FINAL", "")
                                },
                                description: `**${poll.question}**\n${pollCheck(poll, true)}`
                            }});
                        })
                        .catch(() => {
                            // Or, if it breaks, tell them that it broke
                            return super.error(message, message.language.get("COMMAND_POLL_FINAL_ERROR", poll.question));
                        });
                }
                break;
            }
            case String(action.match(/\d/)): {
                // Someone voting on an option
                // Check if there is a poll going, then if there is, vote, else tell em that there isn"t
                if (!exists) {
                    return super.error(message, message.language.get("COMMAND_POLL_NO_POLL"));
                } else {
                    const opt = Math.abs(parseInt(action, 10)) - 1;
                    if (poll.options.length <= opt || opt < 0) {
                        return super.error(message, message.language.get("COMMAND_POLL_INVALID_OPTION"));
                    } else {
                        let voted = -1;
                        if (poll.votes[message.author.id] === opt) {
                            return super.error(message, message.language.get("COMMAND_POLL_SAME_OPT", poll.options[opt]));
                        } else if (poll.votes[message.author.id]) {
                            voted = poll.votes[message.author.id];
                        }
                        poll.votes[message.author.id] = opt;
                        await Bot.database.models.polls.update({poll: poll}, {where: {id: pollID}})
                            .then(() => {
                                if (voted !== -1) {
                                    return message.channel.send(message.language.get("COMMAND_POLL_CHANGED_OPT", poll.options[voted], poll.options[opt]));
                                } else {
                                    return message.channel.send(message.language.get("COMMAND_POLL_REGISTERED", poll.options[opt]));
                                }
                            });
                    }
                }
                break;
            }
            case "me": {
                if (poll.question && poll.question.length) {
                    try {
                        await message.author.send(message.language.get("COMMAND_POLL_ME1", poll.pollID, pollCheck(poll)));
                        return message.author.send(message.language.get("COMMAND_POLL_ME2", message.guildSettings.prefix, poll.pollID));
                    } catch (e) {
                        return super.error(message, message.language.get("BASE_CANNOT_DM"));
                    }
                } else {
                    // no poll active
                    return super.error(message, message.language.get("COMMAND_POLL_NO_POLL"));
                }
            }
            default: {
                // Help
                return;
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
            if (message.guild) {
                footer.text = Bot.expandSpaces(message.language.get("COMMAND_POLL_FOOTER", poll.pollID, message.guildSettings.prefix));
            } else {
                footer.text = Bot.expandSpaces(message.language.get("COMMAND_POLL_DM_FOOTER", poll.pollID, message.guildSettings.prefix));
            }
            return footer;
        }
    }
}

module.exports = Poll;
