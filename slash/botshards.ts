import { codeBlock, Status } from "discord.js";
import Command from "../base/slashCommand.ts";
import type { BotInteraction, BotType } from "../types/types.ts";

export type ShardData = [number[], number, number, number]; // [ids, status, ping, guildCount]

export function formatShardInfo(results: ShardData[], shardCount: number): string {
    const shardInfoArr = ["Shard | Status | Guilds | Ping", "______________________________"];

    for (const data of results) {
        const [id, status, ping, size] = data;
        shardInfoArr.push(
            [
                `${(Number.parseInt(id[0].toString(), 10) + 1).toString().padStart(2)}/${shardCount}`,
                Status[status.toString()].padStart(6),
                `${size.toString().padStart(5)} `,
                `${ping} ms`,
            ].join(" | "),
        );
    }

    return shardInfoArr.join("\n");
}

export default class BotShards extends Command {
    constructor(Bot: BotType) {
        super(Bot, {
            name: "botshards",
            guildOnly: false,
            options: [],
        });
    }

    async run(_Bot: BotType, interaction: BotInteraction) {
        const shardCount = interaction.client.shard.count;

        try {
            const results = await interaction.client.shard.broadcastEval((client) => [
                client.shard.ids,
                client.ws.status,
                client.ws.ping,
                client.guilds.cache.size,
            ]);
            if (!results?.length) {
                throw new Error("[botShards] No results");
            }
            const formatted = formatShardInfo(results as ShardData[], shardCount);
            await interaction.reply({ content: codeBlock("prolog", formatted) });
        } catch (error) {
            console.error(error);
            await interaction.reply("❌ Error.");
        }
    }
}
