import assert from "node:assert/strict";
import test from "node:test";
import { Status } from "discord.js";
import BotShards, { formatShardInfo, type ShardData } from "../../slash/botshards.ts";
import { createMockBot, createMockInteraction } from "../mocks/index.ts";

test.describe("BotShards Command", () => {
    test("formatShardInfo() correctly formats shard information", () => {
        const results: ShardData[] = [
            [[0], Status.Ready, 42, 100],
            [[1], Status.Ready, 38, 95],
            [[2], Status.Connecting, 50, 105],
        ];
        const shardCount = 3;

        const formatted = formatShardInfo(results, shardCount);
        const lines = formatted.split("\n");

        assert.equal(lines[0], "Shard | Status | Guilds | Ping");
        assert.equal(lines[1], "______________________________");
        assert.equal(lines[2], " 1/3 |  Ready |   100  | 42 ms");
        assert.equal(lines[3], " 2/3 |  Ready |    95  | 38 ms");
        assert.equal(lines[4], " 3/3 | Connecting |   105  | 50 ms");
    });

    test("formatShardInfo() handles single shard", () => {
        const results: ShardData[] = [[[0], Status.Ready, 25, 50]];
        const shardCount = 1;

        const formatted = formatShardInfo(results, shardCount);
        const lines = formatted.split("\n");

        assert.equal(lines.length, 3); // header + separator + 1 shard
        assert.equal(lines[2], " 1/1 |  Ready |    50  | 25 ms");
    });

    test("run() replies with formatted shard information", async () => {
        const bot = createMockBot();
        const replyCalls: any[] = [];

        const mockClient = {
            shard: {
                count: 2,
                broadcastEval: async () => [
                    [[0], Status.Ready, 30, 75],
                    [[1], Status.Ready, 35, 80],
                ],
            },
        };

        const interaction = createMockInteraction({
            client: mockClient as any,
            reply: async (data) => replyCalls.push(data),
        });

        const cmd = new BotShards(bot);
        await cmd.run(bot, interaction);

        assert.equal(replyCalls.length, 1);
        assert.ok(replyCalls[0].content.includes("Shard | Status | Guilds | Ping"));
        assert.ok(replyCalls[0].content.includes("1/2"));
        assert.ok(replyCalls[0].content.includes("2/2"));
    });

    test("run() handles error when broadcastEval fails", async () => {
        const bot = createMockBot();
        const replyCalls: any[] = [];

        const mockClient = {
            shard: {
                count: 2,
                broadcastEval: async () => {
                    throw new Error("Broadcast failed");
                },
            },
        };

        const interaction = createMockInteraction({
            client: mockClient as any,
            reply: async (data) => replyCalls.push(data),
        });

        const cmd = new BotShards(bot);
        await cmd.run(bot, interaction);

        assert.equal(replyCalls.length, 1);
        assert.equal(replyCalls[0], "❌ Error fetching shard information.");
    });

    test("run() handles error when broadcastEval returns empty results", async () => {
        const bot = createMockBot();
        const replyCalls: any[] = [];

        const mockClient = {
            shard: {
                count: 2,
                broadcastEval: async () => [],
            },
        };

        const interaction = createMockInteraction({
            client: mockClient as any,
            reply: async (data) => replyCalls.push(data),
        });

        const cmd = new BotShards(bot);
        await cmd.run(bot, interaction);

        assert.equal(replyCalls.length, 1);
        assert.equal(replyCalls[0], "❌ Error fetching shard information.");
    });
});
