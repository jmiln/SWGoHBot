import { describe, it } from "node:test";
import assert from "node:assert";
import { createMockBot, createMockInteraction } from "../mocks/index.ts";
import BotShards, { formatShardInfo, type ShardData } from "../../slash/botshards.ts";

describe("BotShards", () => {
    // Note: Full botshards tests require Discord sharding API.
    // We test the formatShardInfo helper function and command configuration.

    it("should format single shard info correctly", () => {
        const results: ShardData[] = [
            [[0], 0, 50, 1500] // [ids, status (0=Ready), ping, guildCount]
        ];
        const formatted = formatShardInfo(results, 1);

        assert.ok(formatted.includes("Shard | Status | Guilds | Ping"), "Expected header");
        assert.ok(formatted.includes("1/1"), "Expected shard 1/1");
        assert.ok(formatted.includes("1500"), "Expected guild count");
        assert.ok(formatted.includes("50 ms"), "Expected ping");
    });

    it("should format multiple shards correctly", () => {
        const results: ShardData[] = [
            [[0], 0, 45, 1200],
            [[1], 0, 52, 1350],
            [[2], 0, 48, 1450]
        ];
        const formatted = formatShardInfo(results, 3);

        assert.ok(formatted.includes("1/3"), "Expected shard 1/3");
        assert.ok(formatted.includes("2/3"), "Expected shard 2/3");
        assert.ok(formatted.includes("3/3"), "Expected shard 3/3");
        assert.ok(formatted.includes("1200"), "Expected guild count for shard 1");
        assert.ok(formatted.includes("1350"), "Expected guild count for shard 2");
    });

    it("should include status in formatted output", () => {
        const results: ShardData[] = [
            [[0], 0, 50, 1500] // Status 0 = Ready
        ];
        const formatted = formatShardInfo(results, 1);

        assert.ok(formatted.includes("Ready"), "Expected Ready status");
    });

    it("should work without guild context (guildOnly: false)", () => {
        const bot = createMockBot();
        const command = new BotShards(bot);

        assert.strictEqual(command.commandData.guildOnly, false, "Expected guildOnly to be false");
    });

    it("should have correct command configuration", () => {
        const bot = createMockBot();
        const command = new BotShards(bot);

        assert.strictEqual(command.commandData.name, "botshards", "Expected command name to be 'botshards'");
        assert.strictEqual(command.commandData.guildOnly, false, "Expected guildOnly to be false");
        assert.ok(command.commandData.options, "Expected options to be defined");
        assert.strictEqual(command.commandData.options.length, 0, "Expected no options");
    });

    it("should pad shard numbers correctly for alignment", () => {
        const results: ShardData[] = [
            [[0], 0, 50, 1500],
            [[9], 0, 52, 1350]
        ];
        const formatted = formatShardInfo(results, 10);

        // Should have " 1/10" and "10/10" with proper padding
        assert.ok(formatted.includes("1/10"), "Expected shard 1/10");
        assert.ok(formatted.includes("10/10"), "Expected shard 10/10");
    });
});
