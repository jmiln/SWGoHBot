import { describe, it } from "node:test";
import assert from "node:assert";
import { createMockBot } from "../mocks/index.ts";
import Event from "../../slash/event.ts";

describe("Event", () => {
    // Note: Full event tests require MongoDB and guild configuration.
    // We test command configuration and subcommands only.

    it("should have create subcommand", () => {
        const bot = createMockBot();
        const command = new Event(bot);

        const createSubcmd = command.commandData.options.find(o => o.name === "create");
        assert.ok(createSubcmd, "Expected create subcommand");
        assert.strictEqual(createSubcmd.type, 1, "Expected Subcommand type (1)");
    });

    it("should have createjson subcommand", () => {
        const bot = createMockBot();
        const command = new Event(bot);

        const createjsonSubcmd = command.commandData.options.find(o => o.name === "createjson");
        assert.ok(createjsonSubcmd, "Expected createjson subcommand");
        assert.strictEqual(createjsonSubcmd.type, 1, "Expected Subcommand type (1)");
    });

    it("should have delete subcommand", () => {
        const bot = createMockBot();
        const command = new Event(bot);

        const deleteSubcmd = command.commandData.options.find(o => o.name === "delete");
        assert.ok(deleteSubcmd, "Expected delete subcommand");
        assert.strictEqual(deleteSubcmd.type, 1, "Expected Subcommand type (1)");
    });

    it("should have edit subcommand", () => {
        const bot = createMockBot();
        const command = new Event(bot);

        const editSubcmd = command.commandData.options.find(o => o.name === "edit");
        assert.ok(editSubcmd, "Expected edit subcommand");
        assert.strictEqual(editSubcmd.type, 1, "Expected Subcommand type (1)");
    });

    it("should work without guild context (guildOnly: false)", () => {
        const bot = createMockBot();
        const command = new Event(bot);

        assert.strictEqual(command.commandData.guildOnly, false, "Expected guildOnly to be false");
    });

    it("should have correct command configuration", () => {
        const bot = createMockBot();
        const command = new Event(bot);

        assert.strictEqual(command.commandData.name, "event", "Expected command name to be 'event'");
        assert.strictEqual(command.commandData.guildOnly, false, "Expected guildOnly to be false");
        assert.ok(command.commandData.options, "Expected options to be defined");
        assert.ok(command.commandData.options.length >= 4, "Expected at least 4 subcommands");
    });

    it("should have required fields in create subcommand", () => {
        const bot = createMockBot();
        const command = new Event(bot);

        const createSubcmd = command.commandData.options.find(o => o.name === "create");
        assert.ok(createSubcmd.options, "Expected create subcommand to have options");

        const nameOpt = createSubcmd.options.find(o => o.name === "name");
        const dayOpt = createSubcmd.options.find(o => o.name === "day");
        const timeOpt = createSubcmd.options.find(o => o.name === "time");

        assert.ok(nameOpt, "Expected name option");
        assert.strictEqual(nameOpt.required, true, "Expected name to be required");

        assert.ok(dayOpt, "Expected day option");
        assert.strictEqual(dayOpt.required, true, "Expected day to be required");

        assert.ok(timeOpt, "Expected time option");
        assert.strictEqual(timeOpt.required, true, "Expected time to be required");
    });
});
