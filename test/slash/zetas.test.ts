import assert from "node:assert";
import { describe, it } from "node:test";
import Zetas from "../../slash/zetas.ts";

describe("Zetas", () => {
    // Note: Full zetas tests require MongoDB and swgohAPI.
    // We test command configuration and subcommands only.

    it("should work without guild context (guildOnly: false)", () => {        const command = new Zetas();

        assert.strictEqual(command.commandData.guildOnly, false, "Expected guildOnly to be false");
    });

    it("should be enabled", () => {        const command = new Zetas();

        assert.strictEqual(command.commandData.enabled, true, "Expected command to be enabled");
    });

    it("should have correct command configuration", () => {        const command = new Zetas();

        assert.strictEqual(command.commandData.name, "zetas", "Expected command name to be 'zetas'");
        assert.strictEqual(command.commandData.guildOnly, false, "Expected guildOnly to be false");
        assert.ok(command.commandData.options, "Expected options to be defined");
        assert.strictEqual(command.commandData.options.length, 2, "Expected 2 subcommands");
    });

    it("should have guild subcommand", () => {        const command = new Zetas();

        const guildSubcmd = command.commandData.options.find(o => o.name === "guild");
        assert.ok(guildSubcmd, "Expected guild subcommand");
        assert.strictEqual(guildSubcmd.type, 1, "Expected Subcommand type (1)");
    });

    it("should have player subcommand", () => {        const command = new Zetas();

        const playerSubcmd = command.commandData.options.find(o => o.name === "player");
        assert.ok(playerSubcmd, "Expected player subcommand");
        assert.strictEqual(playerSubcmd.type, 1, "Expected Subcommand type (1)");
    });

    it("should have required allycode in guild subcommand", () => {        const command = new Zetas();

        const guildSubcmd = command.commandData.options.find(o => o.name === "guild");
        assert.ok(guildSubcmd.options, "Expected guild subcommand to have options");

        const allycodeOpt = guildSubcmd.options.find(o => o.name === "allycode");
        assert.ok(allycodeOpt, "Expected allycode option");
        assert.strictEqual(allycodeOpt.required, true, "Expected allycode to be required");
    });

    it("should have optional character option with autocomplete in guild subcommand", () => {        const command = new Zetas();

        const guildSubcmd = command.commandData.options.find(o => o.name === "guild");
        const characterOpt = guildSubcmd.options.find(o => o.name === "character");

        assert.ok(characterOpt, "Expected character option");
        assert.strictEqual(characterOpt.autocomplete, true, "Expected character to have autocomplete");
        assert.strictEqual(characterOpt.required, undefined, "Expected character to be optional");
    });

    it("should have required allycode in player subcommand", () => {        const command = new Zetas();

        const playerSubcmd = command.commandData.options.find(o => o.name === "player");
        assert.ok(playerSubcmd.options, "Expected player subcommand to have options");

        const allycodeOpt = playerSubcmd.options.find(o => o.name === "allycode");
        assert.ok(allycodeOpt, "Expected allycode option");
        assert.strictEqual(allycodeOpt.required, true, "Expected allycode to be required");
    });

    it("should have optional character option with autocomplete in player subcommand", () => {        const command = new Zetas();

        const playerSubcmd = command.commandData.options.find(o => o.name === "player");
        const characterOpt = playerSubcmd.options.find(o => o.name === "character");

        assert.ok(characterOpt, "Expected character option");
        assert.strictEqual(characterOpt.autocomplete, true, "Expected character to have autocomplete");
        assert.strictEqual(characterOpt.required, undefined, "Expected character to be optional");
    });
});
