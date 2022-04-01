// Ranks from https://www.reddit.com/r/SWGalaxyOfHeroes/comments/45nacs/what_are_the_highest_ranks_you_can_attack_in_arena/
// And from community feedback on changes
// Formula from https://www.reddit.com/r/SWGalaxyOfHeroes/comments/49kbrq/arena_rank_range/d0sr

import SlashCommand from "../base/slashCommand";
import { Interaction } from "discord.js";
import { BotInteraction, BotType } from "../modules/types";

class Arenarank extends SlashCommand {
    constructor(Bot: BotType) {
        super(Bot, {
            name: "arenarank",
            guildOnly: false,
            category: "Star Wars",
            options: [
                {
                    name: "rank",
                    type: Bot.constants.optionType.INTEGER,
                    description: "The rank to calculate the drops from",
                    required: true
                },
                {
                    name: "hops",
                    type: Bot.constants.optionType.INTEGER,
                    description: "How many more ranks to calculate"
                }
            ]
        });
    }

    run(Bot: BotType, interaction: BotInteraction) {
        const currentRank = interaction.options.getInteger("rank");
        const rankHops = interaction.options.getInteger("hops") || 5;
        if (isNaN(currentRank) || !currentRank) {
            return super.error(interaction, interaction.language.get("COMMAND_ARENARANK_INVALID_NUMBER"), {example: "arenarank 55"});
        }

        if (Bot.isAllyCode(currentRank)) {
            return super.error(interaction, interaction.language.get("COMMAND_ARENARANK_ALLYCODE"));
        }

        // If they are rank 1, don't bother calculating anything
        if (currentRank === 1) return interaction.reply({content: interaction.language.get("COMMAND_ARENARANK_BEST_RANK")});

        // Mark em as estimates if needed
        let est = false;
        if (!Bot.arenaJumps[currentRank]) est = true;


        // Loop through findRank up to 5 times, breaking if it returns 1
        const arenaBattles = [currentRank];
        for (let battle = 0; battle < rankHops; battle++) {
            const  newRank = findNextRank(arenaBattles[(arenaBattles.length-1).toString()]);
            arenaBattles.push(newRank);
            if (newRank === 1) break;
        }

        return interaction.reply({content: interaction.language.get("COMMAND_ARENARANK_RANKLIST", currentRank, arenaBattles.length-1, arenaBattles.length-1 > 1 ? "s" : "", est ? "**(estimate)**" : "", arenaBattles.join(" → "))});


        function findNextRank(currentRank: number) {
            if (Bot.arenaJumps[currentRank]) {
                return Bot.arenaJumps[currentRank];
            } else {
                return Math.floor(currentRank * 0.85);
            }
        }
    }
}

module.exports = Arenarank;
