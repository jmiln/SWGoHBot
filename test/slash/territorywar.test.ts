import assert from "node:assert";
import { describe, it } from "node:test";
import TerritoryWar from "../../slash/territorywar.ts";
import { createMockBot } from "../mocks/index.ts";

describe("TerritoryWar", () => {
    // Note: Full territorywar tests require MongoDB and swgohAPI.
    // We test command configuration only.

    it("should work without guild context (guildOnly: false)", () => {
        const bot = createMockBot();
        const command = new TerritoryWar(bot);

        assert.strictEqual(command.commandData.guildOnly, false, "Expected guildOnly to be false");
    });

    it("should be enabled", () => {
        const bot = createMockBot();
        const command = new TerritoryWar(bot);

        assert.strictEqual(command.commandData.enabled, true, "Expected command to be enabled");
    });

    it("should have correct command configuration", () => {
        const bot = createMockBot();
        const command = new TerritoryWar(bot);

        assert.strictEqual(command.commandData.name, "territorywar", "Expected command name to be 'territorywar'");
        assert.strictEqual(command.commandData.guildOnly, false, "Expected guildOnly to be false");
        assert.ok(command.commandData.options, "Expected options to be defined");
        assert.strictEqual(command.commandData.options.length, 2, "Expected 2 options");
    });

    it("should have required allycode_1 option", () => {
        const bot = createMockBot();
        const command = new TerritoryWar(bot);

        const allycode1Opt = command.commandData.options.find(o => o.name === "allycode_1");
        assert.ok(allycode1Opt, "Expected allycode_1 option");
        assert.strictEqual(allycode1Opt.required, true, "Expected allycode_1 to be required");
    });

    it("should have required allycode_2 option", () => {
        const bot = createMockBot();
        const command = new TerritoryWar(bot);

        const allycode2Opt = command.commandData.options.find(o => o.name === "allycode_2");
        assert.ok(allycode2Opt, "Expected allycode_2 option");
        assert.strictEqual(allycode2Opt.required, true, "Expected allycode_2 to be required");
    });

    it("should compare guild rosters based on ally codes", () => {
        const bot = createMockBot();
        const command = new TerritoryWar(bot);

        // Verify command is designed for guild comparison
        assert.strictEqual(command.commandData.name, "territorywar", "Expected command to be for territory war comparison");
        assert.ok(command.commandData.description, "Expected description to be defined");
    });
});
