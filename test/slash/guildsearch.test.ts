import { describe, it } from "node:test";
import assert from "node:assert";
import { createMockBot } from "../mocks/index.ts";
import GuildSearch from "../../slash/guildsearch.ts";

describe("GuildSearch", () => {
    // Note: Full guildsearch tests require MongoDB, guild data, and swgohAPI.
    // We test command configuration and subcommands only.

    it("should have character subcommand", () => {
        const bot = createMockBot();
        const command = new GuildSearch(bot);

        const characterSubcmd = command.commandData.options.find(o => o.name === "character");
        assert.ok(characterSubcmd, "Expected character subcommand");
        assert.strictEqual(characterSubcmd.type, 1, "Expected Subcommand type (1)");
    });

    it("should have ship subcommand", () => {
        const bot = createMockBot();
        const command = new GuildSearch(bot);

        const shipSubcmd = command.commandData.options.find(o => o.name === "ship");
        assert.ok(shipSubcmd, "Expected ship subcommand");
        assert.strictEqual(shipSubcmd.type, 1, "Expected Subcommand type (1)");
    });

    it("should work without guild context (guildOnly: false)", () => {
        const bot = createMockBot();
        const command = new GuildSearch(bot);

        assert.strictEqual(command.commandData.guildOnly, false, "Expected guildOnly to be false");
    });

    it("should have correct command configuration", () => {
        const bot = createMockBot();
        const command = new GuildSearch(bot);

        assert.strictEqual(command.commandData.name, "guildsearch", "Expected command name to be 'guildsearch'");
        assert.strictEqual(command.commandData.guildOnly, false, "Expected guildOnly to be false");
        assert.ok(command.commandData.options, "Expected options to be defined");
        assert.strictEqual(command.commandData.options.length, 2, "Expected 2 subcommands");

        const characterSubcmd = command.commandData.options.find(o => o.name === "character");
        const shipSubcmd = command.commandData.options.find(o => o.name === "ship");

        assert.ok(characterSubcmd, "Expected character subcommand");
        assert.ok(shipSubcmd, "Expected ship subcommand");
    });

    it("should have sort choices in character subcommand", () => {
        const bot = createMockBot();
        const command = new GuildSearch(bot);

        const characterSubcmd = command.commandData.options.find(o => o.name === "character");
        assert.ok(characterSubcmd.options, "Expected character subcommand to have options");

        const sortOpt = characterSubcmd.options.find(o => o.name === "sort");
        assert.ok(sortOpt, "Expected sort option");
        assert.ok(sortOpt.choices, "Expected sort to have choices");
        assert.ok(sortOpt.choices.length > 0, "Expected sort to have multiple choices");
    });

    it("should have stat choices in character subcommand", () => {
        const bot = createMockBot();
        const command = new GuildSearch(bot);

        const characterSubcmd = command.commandData.options.find(o => o.name === "character");
        const statOpt = characterSubcmd.options.find(o => o.name === "stat");

        assert.ok(statOpt, "Expected stat option");
        assert.ok(statOpt.choices, "Expected stat to have choices");
        assert.ok(statOpt.choices.length > 0, "Expected stat to have multiple stat choices");
    });

    it("should have integer options with min/max values", () => {
        const bot = createMockBot();
        const command = new GuildSearch(bot);

        const characterSubcmd = command.commandData.options.find(o => o.name === "character");
        const topOpt = characterSubcmd.options.find(o => o.name === "top");
        const rarityOpt = characterSubcmd.options.find(o => o.name === "rarity");

        assert.ok(topOpt, "Expected top option");
        assert.strictEqual(topOpt.type, 4, "Expected Integer type (4)");
        assert.strictEqual(topOpt.minValue, 0, "Expected top minValue to be 0");
        assert.strictEqual(topOpt.maxValue, 50, "Expected top maxValue to be 50");

        assert.ok(rarityOpt, "Expected rarity option");
        assert.strictEqual(rarityOpt.type, 4, "Expected Integer type (4)");
        assert.strictEqual(rarityOpt.minValue, 0, "Expected rarity minValue to be 0");
        assert.strictEqual(rarityOpt.maxValue, 7, "Expected rarity maxValue to be 7");
    });
});
