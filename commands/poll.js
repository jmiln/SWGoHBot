const Command = require('../base/Command');

class Poll extends Command {
    constructor(client) {
        super(client, {
            name: 'poll',
            guildOnly: true,
            description: "Lets you start a poll with multiple options",
            category: "Misc",
            usage: `poll  <create|choice|view|close|help> <question> | <opt1> | <opt2> | [...] | [opt9]`,
            extended: `\`\`\`asciidoc
create  :: Create a new poll            
<choice>:: Vote for your preferred answer (0-9)
view    :: View the current standings
close   :: Close the poll and display the results
help    :: Show this help\`\`\``,
            guildOnly: true,
            aliases: ['vote']
        });
    }

    async run(client, message, [action, ...opts], level) {   
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
                    return message.channel.send("You don't have the perms to use this command.");
                }
                if (exists) {
                    return message.channel.send("Sorry, but you can only run one poll at a time. Please end the current one first.");
                }
                if (!optsJoin[0]) {
                    return message.channel.send('You need to specify something to vote on');
                } else {
                    poll.question = optsJoin[0];
                    optsJoin.splice(0,1);
                }
                if (optsJoin.length < 2) {
                    return message.channel.send('You need to have at least 2 options to vote on');
                } else if (optsJoin.length > 10) {
                    return message.channel.send('You can only have up to 10 options to vote on');
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
                        return message.channel.send(`**${message.author.username}** has started a new poll:\nVote with \`${client.config.prefix}poll <choice>\`\n\n${pollCheck(poll)}`);
                    });               
                break;
            } 
            case 'view':
            case 'check': {
                // Check the current poll
                if (!exists) {
                    return message.channel.send("There is no poll in progress");
                } else {
                    const outString = pollCheck(poll);
                    return message.channel.send(outString);
                }
            }
            case 'close':
            case 'end': {
                // Close the current poll and send the results (lvl 3+)
                if (level < 3) {
                    return message.channel.send("You don't have the perms to use this command.");
                }
                if (!exists) {
                    return message.channel.send("There is no poll in progress");
                } else {
                    // Delete the current poll
                    await client.polls.destroy({where: {id: pollID}})
                        .then(() => {
                            message.channel.send(`Final results for ${pollCheck(poll)}`);
                        })
                        .catch(() => { 
                            message.channel.send(`I couldn't delete **${poll.question}**, please try again.`);
                        });
                }
                break;
            }
            case String(action.match(/\d/)): {
                // Someone voting on an option
                // Check if there is a poll going, then if there is, vote, else tell em that there isn't 
                if (!exists) {
                    return message.channel.send("There is no poll in progress");
                } else {
                    const opt = parseInt(action);
                    if (poll.options.length < opt-1) {
                        return message.channel.send('That is not a valid option.');
                    } else {
                        let voted = -1;
                        if (poll.votes[message.author.id] === opt) {
                            return message.channel.send(`You have already chosen **${poll.options[opt]}**`);
                        } else if(poll.votes.hasOwnProperty(message.author.id)) {
                            voted = poll.votes[message.author.id];
                        }
                        poll.votes[message.author.id] = opt;
                        await client.polls.update({poll: poll}, {where: {id: pollID}})
                            .then(() => {
                                if (voted !== -1) {
                                    return message.channel.send(`You have changed your choice from **${poll.options[voted]}** to **${poll.options[opt]}**`)
                                } else {
                                    return message.channel.send(`Choice for **${poll.options[opt]}** registered`);
                                }
                            });
                    }
                }
                break;
            }
            default: {
                // Help
                return message.channel.send(message.language.COMMAND_EXTENDED_HELP(this));
                break;
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
            
            let outString = "**" + poll.question + "**\n";
            Object.keys(voteCount).forEach(opt => {
                outString += `\`[${opt}]\` (${voteCount[opt]} vote${voteCount[opt] === 1 ? '' : 's'}) ${poll.options[opt]}\n`;
            });
            return outString;
        }
    }
}

module.exports = Poll;

