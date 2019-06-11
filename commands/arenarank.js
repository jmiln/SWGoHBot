// Ranks from https://www.reddit.com/r/SWGalaxyOfHeroes/comments/45nacs/what_are_the_highest_ranks_you_can_attack_in_arena/
// And from community feedback on changes
// Formula from https://www.reddit.com/r/SWGalaxyOfHeroes/comments/49kbrq/arena_rank_range/d0sr

const Command = require("../base/Command");

class Arenarank extends Command {
    constructor(Bot) {
        super(Bot, {
            name: "arenarank",
            category: "Star Wars",
            aliases: ["arena"]
        });
    }

    run(Bot, message, args) {
        const currentRank = parseInt(args[0]);
        const rankHops = parseInt(args[1]) || 5;
        if (isNaN(currentRank) || !currentRank) {
            // return message.channel.send();
            return super.error(message, message.language.get("COMMAND_ARENARANK_INVALID_NUMBER"), {example: "arenarank 55"});
        }

        // If they are rank 1, don't bother calculating anything
        if (currentRank === 1) return message.channel.send(message.language.get("COMMAND_ARENARANK_BEST_RANK"));

        // Mark em as estimates if needed
        let est = false;
        if (!Bot.arenaJumps[currentRank.toString()]) est = true;


        // Loop through findRank up to 5 times, breaking if it returns 1
        const arenaBattles = [currentRank];
        for (let battle = 0; battle < rankHops; battle++) {
            const  newRank = findNextRank(arenaBattles[(arenaBattles.length-1).toString()]);
            arenaBattles.push(newRank);
            if (newRank === 1) break;
        }

        return message.channel.send(message.language.get("COMMAND_ARENARANK_RANKLIST", currentRank, arenaBattles.length-1, arenaBattles.length-1 > 1 ? "s" : "", est ? "**(estimate)**" : "", arenaBattles.join(" → ")));


        function findNextRank(currentRank) {
            if (Bot.arenaJumps.hasOwnProperty(currentRank)) {
                return Bot.arenaJumps[currentRank.toString()];
            } else {
                return Math.floor(currentRank * 0.85);
            }
        }
    }
}

module.exports = Arenarank;



