import assert from "node:assert";
import { describe, it } from "node:test";
import Aliases from "../../slash/aliases.ts";
import { createMockBot } from "../mocks/index.ts";

describe("Aliases", () => {
    // Note: Full aliases tests require MongoDB and guild configuration.
    // We test command configuration and subcommands only.

    it("should have add subcommand", () => {
        const bot = createMockBot();
        const command = new Aliases(bot);

        const addSubcmd = command.commandData.options.find(o => o.name === "add");
        assert.ok(addSubcmd, "Expected add subcommand");
        assert.strictEqual(addSubcmd.type, 1, "Expected Subcommand type (1)");
    });

    it("should have remove subcommand", () => {
        const bot = createMockBot();
        const command = new Aliases(bot);

        const removeSubcmd = command.commandData.options.find(o => o.name === "remove");
        assert.ok(removeSubcmd, "Expected remove subcommand");
        assert.strictEqual(removeSubcmd.type, 1, "Expected Subcommand type (1)");
    });

    it("should have view subcommand", () => {
        const bot = createMockBot();
        const command = new Aliases(bot);

        const viewSubcmd = command.commandData.options.find(o => o.name === "view");
        assert.ok(viewSubcmd, "Expected view subcommand");
        assert.strictEqual(viewSubcmd.type, 1, "Expected Subcommand type (1)");
    });

    it("should require admin permissions (permLevel: 3)", () => {
        const bot = createMockBot();
        const command = new Aliases(bot);

        assert.strictEqual(command.commandData.permLevel, 3, "Expected permLevel to be 3 (admin)");
    });

    it("should work without guild context (guildOnly: false)", () => {
        const bot = createMockBot();
        const command = new Aliases(bot);

        assert.strictEqual(command.commandData.guildOnly, false, "Expected guildOnly to be false");
    });

    it("should have correct command configuration", () => {
        const bot = createMockBot();
        const command = new Aliases(bot);

        assert.strictEqual(command.commandData.name, "aliases", "Expected command name to be 'aliases'");
        assert.strictEqual(command.commandData.guildOnly, false, "Expected guildOnly to be false");
        assert.ok(command.commandData.options, "Expected options to be defined");
        assert.strictEqual(command.commandData.options.length, 3, "Expected 3 subcommands");
    });

    it("should have required fields in add subcommand", () => {
        const bot = createMockBot();
        const command = new Aliases(bot);

        const addSubcmd = command.commandData.options.find(o => o.name === "add");
        assert.ok(addSubcmd.options, "Expected add subcommand to have options");

        const unitOpt = addSubcmd.options.find(o => o.name === "unit");
        const aliasOpt = addSubcmd.options.find(o => o.name === "alias");

        assert.ok(unitOpt, "Expected unit option");
        assert.strictEqual(unitOpt.required, true, "Expected unit to be required");
        assert.strictEqual(unitOpt.autocomplete, true, "Expected unit to have autocomplete");

        assert.ok(aliasOpt, "Expected alias option");
        assert.strictEqual(aliasOpt.required, true, "Expected alias to be required");
    });
});
