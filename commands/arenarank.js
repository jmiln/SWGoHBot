const Command = require('../base/Command');
const arenaJumps = require('../data/arenaJumps.js');

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



