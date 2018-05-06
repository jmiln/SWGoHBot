const Command = require('../base/Command');

class Poll extends Command {
    constructor(client) {
        super(client, {
            name: 'poll',
            guildOnly: true,
            category: "Misc",
            aliases: ['vote']
        });
    }

    async run(client, message, [action, ...opts], options) {
        const level = options.level;
        if (!action) {
            return message.channel.send(message.language.get('COMMAND_POLL_NO_ARG'));
        }
        const pollID = `${message.guild.id}-${message.channel.id}`;
        const exists = await client.polls.findOne({where: {id: pollID}})
            .then(token => token != null)
            .then(isUnique => isUnique);
        const optsJoin = opts.join(' ').split('|');

        let poll = { // ID = guildID-channelID
            'question': '',
            'options': [],
            'votes': {
                // userID: vote#
            }
        };

        if (exists) {
            const tempP = await client.polls.findOne({where: {id: pollID}});
            poll = tempP.dataValues.poll;
        }

        switch (action) {
            case 'start':
            case 'create': {
                // Create a poll (lvl 3+)
                if (level < 3) {
                    return message.channel.send(message.language.get('COMMAND_MISSING_PERMS'));
                }
                if (exists) {
                    return message.channel.send(message.language.get('COMMAND_POLL_ALREADY_RUNNING'));
                }
                if (!optsJoin[0]) {
                    return message.channel.send(message.language.get('COMMAND_POLL_MISSING_QUESTION'));
                } else {
                    poll.question = optsJoin[0];
                    optsJoin.splice(0,1);
                }
                if (optsJoin.length < 2) {
                    return message.channel.send(message.language.get('COMMAND_POLL_TOO_FEW_OPT'));
                } else if (optsJoin.length > 10) {
                    return message.channel.send(message.language.get('COMMAND_POLL_TOO_MANY_OPT'));
                } else {
                    optsJoin.forEach((opt, ix) => {
                        optsJoin[ix] = opt.replace(/^\s*/, '').replace(/\s*$/, '');
                    });
                    poll.options = optsJoin;
                }
                await client.polls.create({
                    id: pollID,
                    poll: poll
                })
                    .then(() => {
                        return message.channel.send(message.language.get('COMMAND_POLL_CREATED', message.author.username, client.config.prefix, pollCheck(poll)));
                    });               
                break;
            } 
            case 'view':
            case 'check': {
                // Check the current poll
                if (!exists) {
                    return message.channel.send(message.language.get('COMMAND_POLL_NO_POLL'));
                } else {
                    const outString = pollCheck(poll);
                    return message.channel.send(outString);
                }
            }
            case 'close':
            case 'end': {
                // Close the current poll and send the results (lvl 3+)
                if (level < 3) {
                    return message.channel.send(message.language.get('COMMAND_MISSING_PERMS'));
                }
                if (!exists) {
                    return message.channel.send(message.language.get('COMMAND_POLL_NO_POLL'));
                } else {
                    // Delete the current poll
                    await client.polls.destroy({where: {id: pollID}})
                        .then(() => {
                            return message.channel.send(message.language.get('COMMAND_POLL_FINAL', pollCheck(poll)));
                        })
                        .catch(() => { 
                            return message.channel.send(message.language.get('COMMAND_POLL_FINAL_ERROR', poll.question));
                        });
                }
                break;
            }
            case String(action.match(/\d/)): {
                // Someone voting on an option
                // Check if there is a poll going, then if there is, vote, else tell em that there isn't 
                if (!exists) {
                    return message.channel.send(message.language.get('COMMAND_POLL_NO_POLL'));
                } else {
                    const opt = Math.abs(parseInt(action));
                    if (poll.options.length < opt+1) {
                        return message.channel.send(message.language.get('COMMAND_POLL_INVALID_OPTION'));
                    } else {
                        let voted = -1;
                        if (poll.votes[message.author.id] === opt) {
                            return message.channel.send(message.language.get('COMMAND_POLL_SAME_OPT', poll.options[opt]));
                        } else if (poll.votes.hasOwnProperty(message.author.id)) {
                            voted = poll.votes[message.author.id];
                        }
                        poll.votes[message.author.id] = opt;
                        await client.polls.update({poll: poll}, {where: {id: pollID}})
                            .then(() => {
                                if (voted !== -1) {
                                    return message.channel.send(message.language.get('COMMAND_POLL_CHANGED_OPT', poll.options[voted], poll.options[opt]));
                                } else {
                                    return message.channel.send(message.language.get('COMMAND_POLL_REGISTERED', poll.options[opt]));
                                }
                            });
                    }
                }
                break;
            }
            default: {
                // Help
                return;
            }
        }

        function pollCheck(poll) {
            const voteCount = {};
            poll.options.forEach((opt, ix) => {
                voteCount[ix] = 0;
            });
            Object.keys(poll.votes).forEach(voter => {
                voteCount[poll.votes[voter]] += 1;
            });
            
            let outString = `**${poll.question}**\n`;
            Object.keys(voteCount).forEach(opt => {
                outString += message.language.get('COMMAND_POLL_CHOICE', opt, voteCount[opt], poll.options[opt]);
            });
            return outString;
        }
    }
}

module.exports = Poll;

