import assert from "node:assert";
import { describe, it } from "node:test";
import MyCharacter from "../../slash/mycharacter.ts";
import { createMockBot } from "../mocks/index.ts";

describe("MyCharacter", () => {
    // Note: Full mycharacter tests require MongoDB, user registration, and swgohAPI.
    // We test command configuration only.

    it("should have character subcommand", () => {
        const bot = createMockBot();
        const command = new MyCharacter(bot);

        const characterSubcmd = command.commandData.options.find(o => o.name === "character");
        assert.ok(characterSubcmd, "Expected character subcommand");
        assert.strictEqual(characterSubcmd.type, 1, "Expected Subcommand type (1)");
    });

    it("should have ship subcommand", () => {
        const bot = createMockBot();
        const command = new MyCharacter(bot);

        const shipSubcmd = command.commandData.options.find(o => o.name === "ship");
        assert.ok(shipSubcmd, "Expected ship subcommand");
        assert.strictEqual(shipSubcmd.type, 1, "Expected Subcommand type (1)");
    });

    it("should work without guild context (guildOnly: false)", () => {
        const bot = createMockBot();
        const command = new MyCharacter(bot);

        assert.strictEqual(command.commandData.guildOnly, false, "Expected guildOnly to be false");
    });

    it("should have correct command configuration", () => {
        const bot = createMockBot();
        const command = new MyCharacter(bot);

        assert.strictEqual(command.commandData.name, "mycharacter", "Expected command name to be 'mycharacter'");
        assert.strictEqual(command.commandData.guildOnly, false, "Expected guildOnly to be false");
        assert.strictEqual(command.commandData.enabled, true, "Expected command to be enabled");
        assert.ok(command.commandData.options, "Expected options to be defined");
        assert.strictEqual(command.commandData.options.length, 2, "Expected 2 subcommands");

        const characterSubcmd = command.commandData.options.find(o => o.name === "character");
        const shipSubcmd = command.commandData.options.find(o => o.name === "ship");

        assert.ok(characterSubcmd, "Expected character subcommand");
        assert.ok(shipSubcmd, "Expected ship subcommand");

        // Check character subcommand has proper options
        assert.ok(characterSubcmd.options, "Expected character subcommand to have options");
        assert.strictEqual(characterSubcmd.options.length, 2, "Expected character subcommand to have 2 options");

        const charCharOpt = characterSubcmd.options.find(o => o.name === "character");
        const charAllycodeOpt = characterSubcmd.options.find(o => o.name === "allycode");
        assert.ok(charCharOpt, "Expected character option in character subcommand");
        assert.ok(charAllycodeOpt, "Expected allycode option in character subcommand");
        assert.strictEqual(charCharOpt.required, true, "Expected character to be required");

        // Check ship subcommand has proper options
        assert.ok(shipSubcmd.options, "Expected ship subcommand to have options");
        assert.strictEqual(shipSubcmd.options.length, 2, "Expected ship subcommand to have 2 options");

        const shipShipOpt = shipSubcmd.options.find(o => o.name === "ship");
        const shipAllycodeOpt = shipSubcmd.options.find(o => o.name === "allycode");
        assert.ok(shipShipOpt, "Expected ship option in ship subcommand");
        assert.ok(shipAllycodeOpt, "Expected allycode option in ship subcommand");
        assert.strictEqual(shipShipOpt.required, true, "Expected ship to be required");
    });
});
