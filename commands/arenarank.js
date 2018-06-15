const Command = require('../base/Command');

// Ranks from https://www.reddit.com/r/SWGalaxyOfHeroes/comments/45nacs/what_are_the_highest_ranks_you_can_attack_in_arena/
// Formula from https://www.reddit.com/r/SWGalaxyOfHeroes/comments/49kbrq/arena_rank_range/d0srqjn/
const arenaJumps = { 49:40, 46:38, 41:33, 40:33, 36:28, 35:27, 34:26, 33:26, 32:25, 31:24, 30:23, 29:22, 28:21, 27:20, 26:19, 25:18, 24:18, 23:17, 22:16, 21:15, 20:14, 19:13, 18:13, 17:12, 16:11, 15:10, 14:9, 13:8, 12:8, 11:7, 10:6, 9 :5, 8 :4, 7 :3, 6 :2, 5 :1, 4 :1, 3 :1, 2 :1 };

class Arenarank extends Command {
    constructor(client) {
        super(client, {
            name: "arenarank",
            category: 'Star Wars',
            aliases: ['arena']
        });
    }

    run(client, message, args) {
        const currentRank = parseInt(args[0]);
        const rankHops = parseInt(args[1]) || 5;
        if (isNaN(currentRank) || !currentRank) {
            return message.channel.send(message.language.get('COMMAND_ARENARANK_INVALID_NUMBER'));
        }

        // If they are rank 1, don't bother calculating anything
        if (currentRank === 1) return message.channel.send(message.language.get('COMMAND_ARENARANK_BEST_RANK'));

        // Mark em as estimates if needed
        let est = false;
        if (!arenaJumps[currentRank]) est = true;


        // Loop through findRank up to 5 times, breaking if it returns 1
        const arenaBattles = [currentRank];
        for (let battle = 0; battle < rankHops; battle++) {
            const  newRank = findNextRank(arenaBattles[arenaBattles.length-1]);
            arenaBattles.push(newRank);
            if (newRank === 1) break;
        }

        return message.channel.send(message.language.get('COMMAND_ARENARANK_RANKLIST', currentRank, arenaBattles.length-1, arenaBattles.length-1 > 1 ? 's' : '', est ? '**(estimate)**' : '', arenaBattles.join(' → '))); 


        function findNextRank(currentRank) {
            if (arenaJumps.hasOwnProperty(currentRank)) {
                return arenaJumps[currentRank];
            } else {
                return Math.floor(currentRank * 0.85);
            }
        }
    }    
}

module.exports = Arenarank;



