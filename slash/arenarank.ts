// Ranks from https://www.reddit.com/r/SWGalaxyOfHeroes/comments/45nacs/what_are_the_highest_ranks_you_can_attack_in_arena/
// And from community feedback on changes
// Formula from https://www.reddit.com/r/SWGalaxyOfHeroes/comments/49kbrq/arena_rank_range/d0sr

import { ApplicationCommandOptionType } from "discord.js";
import Command from "../base/slashCommand.ts";
import { arenaJumps } from "../data/constants/units.ts";
import type { BotInteraction, BotType } from "../types/types.ts";

export default class Arenarank extends Command {
    static readonly metadata = {
        name: "arenarank",
        guildOnly: false,
        options: [
            {
                name: "rank",
                type: ApplicationCommandOptionType.Integer,
                description: "The rank to calculate the drops from",
                required: true,
            },
            {
                name: "hops",
                type: ApplicationCommandOptionType.Integer,
                description: "How many more ranks to calculate",
            },
        ],
    };

    constructor(Bot: BotType) {
        super(Bot, Arenarank.metadata);
    }

    run(_Bot: BotType, interaction: BotInteraction) {
        const currentRank = interaction.options.getInteger("rank");
        const rankHops = interaction.options.getInteger("hops") || 5;

        if (Number.isNaN(currentRank) || !currentRank) {
            return super.error(interaction, interaction.language.get("COMMAND_ARENARANK_INVALID_NUMBER"), { example: "arenarank 55" });
        }

        // If they are rank 1, don't bother calculating anything
        if (currentRank === 1) return interaction.reply({ content: interaction.language.get("COMMAND_ARENARANK_BEST_RANK") });

        const { battles, isEstimated } = this.computeArenaRanks(currentRank, rankHops);

        return interaction.reply({
            content: interaction.language.get(
                "COMMAND_ARENARANK_RANKLIST",
                currentRank,
                battles.length - 1,
                battles.length - 1 > 1 ? "s" : "",
                isEstimated ? "**(estimate)**" : "",
                battles.join(" → "),
            ),
        });
    }

    private computeArenaRanks(currentRank: number, rankHops: number): { battles: number[]; isEstimated: boolean } {
        const isEstimated = !arenaJumps[currentRank.toString()];
        const battles: number[] = [currentRank];

        if (currentRank === 1) return { battles, isEstimated };

        for (let battle = 0; battle < rankHops; battle++) {
            const nextRank = this.findNextRank(battles[battles.length - 1]);
            battles.push(nextRank);
            if (nextRank === 1) break;
        }

        return { battles, isEstimated };
    }
    private findNextRank(currentRank: number): number {
        const rankStr = currentRank.toString();
        const jump = arenaJumps?.[rankStr] || null;
        return jump || Math.floor(currentRank * 0.85);
    }
}
