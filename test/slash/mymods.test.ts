import assert from "node:assert";
import { describe, it } from "node:test";
import MyMods from "../../slash/mymods.ts";

describe("MyMods", () => {
    // Note: Full mymods tests require MongoDB, user registration, and swgohAPI.
    // We test command configuration and subcommands only.

    it("should have character subcommand", () => {        const command = new MyMods();

        const characterSubcmd = command.commandData.options.find(o => o.name === "character");
        assert.ok(characterSubcmd, "Expected character subcommand");
        assert.strictEqual(characterSubcmd.type, 1, "Expected Subcommand type (1)");
    });

    it("should have best subcommand", () => {        const command = new MyMods();

        const bestSubcmd = command.commandData.options.find(o => o.name === "best");
        assert.ok(bestSubcmd, "Expected best subcommand");
        assert.strictEqual(bestSubcmd.type, 1, "Expected Subcommand type (1)");
    });

    it("should have bestmods subcommand", () => {        const command = new MyMods();

        const bestmodsSubcmd = command.commandData.options.find(o => o.name === "bestmods");
        assert.ok(bestmodsSubcmd, "Expected bestmods subcommand");
        assert.strictEqual(bestmodsSubcmd.type, 1, "Expected Subcommand type (1)");
    });

    it("should have missing subcommand", () => {        const command = new MyMods();

        const missingSubcmd = command.commandData.options.find(o => o.name === "missing");
        assert.ok(missingSubcmd, "Expected missing subcommand");
        assert.strictEqual(missingSubcmd.type, 1, "Expected Subcommand type (1)");
    });

    it("should work without guild context (guildOnly: false)", () => {        const command = new MyMods();

        assert.strictEqual(command.commandData.guildOnly, false, "Expected guildOnly to be false");
    });

    it("should have correct command configuration", () => {        const command = new MyMods();

        assert.strictEqual(command.commandData.name, "mymods", "Expected command name to be 'mymods'");
        assert.strictEqual(command.commandData.guildOnly, false, "Expected guildOnly to be false");
        assert.ok(command.commandData.options, "Expected options to be defined");
        assert.strictEqual(command.commandData.options.length, 4, "Expected 4 subcommands");

        const characterSubcmd = command.commandData.options.find(o => o.name === "character");
        const bestSubcmd = command.commandData.options.find(o => o.name === "best");
        const bestmodsSubcmd = command.commandData.options.find(o => o.name === "bestmods");
        const missingSubcmd = command.commandData.options.find(o => o.name === "missing");

        assert.ok(characterSubcmd, "Expected character subcommand");
        assert.ok(bestSubcmd, "Expected best subcommand");
        assert.ok(bestmodsSubcmd, "Expected bestmods subcommand");
        assert.ok(missingSubcmd, "Expected missing subcommand");
    });

    it("should have stat choices in best subcommand", () => {        const command = new MyMods();

        const bestSubcmd = command.commandData.options.find(o => o.name === "best");
        assert.ok(bestSubcmd.options, "Expected best subcommand to have options");

        const statOpt = bestSubcmd.options.find(o => o.name === "stat");
        assert.ok(statOpt, "Expected stat option in best subcommand");
        assert.ok(statOpt.choices, "Expected stat to have choices");
        assert.ok(statOpt.choices.length > 0, "Expected stat to have multiple choices");
    });
});
