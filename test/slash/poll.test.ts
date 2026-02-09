import assert from "node:assert";
import { describe, it } from "node:test";
import Poll from "../../slash/poll.ts";

describe("Poll", () => {
    // Note: Full poll tests require MongoDB and guild configuration.
    // We test command configuration and subcommands only.

    it("should have create subcommand", () => {
        const command = new Poll();

        const createSubcmd = command.commandData.options.find(o => o.name === "create");
        assert.ok(createSubcmd, "Expected create subcommand");
        assert.strictEqual(createSubcmd.type, 1, "Expected Subcommand type (1)");
    });

    it("should have end subcommand", () => {
        const command = new Poll();

        const endSubcmd = command.commandData.options.find(o => o.name === "end");
        assert.ok(endSubcmd, "Expected end subcommand");
        assert.strictEqual(endSubcmd.type, 1, "Expected Subcommand type (1)");
    });

    it("should have cancel subcommand", () => {
        const command = new Poll();

        const cancelSubcmd = command.commandData.options.find(o => o.name === "cancel");
        assert.ok(cancelSubcmd, "Expected cancel subcommand");
        assert.strictEqual(cancelSubcmd.type, 1, "Expected Subcommand type (1)");
    });

    it("should have view subcommand", () => {
        const command = new Poll();

        const viewSubcmd = command.commandData.options.find(o => o.name === "view");
        assert.ok(viewSubcmd, "Expected view subcommand");
        assert.strictEqual(viewSubcmd.type, 1, "Expected Subcommand type (1)");
    });

    it("should have vote subcommand", () => {
        const command = new Poll();

        const voteSubcmd = command.commandData.options.find(o => o.name === "vote");
        assert.ok(voteSubcmd, "Expected vote subcommand");
        assert.strictEqual(voteSubcmd.type, 1, "Expected Subcommand type (1)");
    });

    it("should work without guild context (guildOnly: false)", () => {
        const command = new Poll();

        assert.strictEqual(command.commandData.guildOnly, false, "Expected guildOnly to be false");
    });

    it("should have correct command configuration", () => {
        const command = new Poll();

        assert.strictEqual(command.commandData.name, "poll", "Expected command name to be 'poll'");
        assert.strictEqual(command.commandData.guildOnly, false, "Expected guildOnly to be false");
        assert.ok(command.commandData.options, "Expected options to be defined");
        assert.strictEqual(command.commandData.options.length, 5, "Expected 5 subcommands");
    });

    it("should have required fields in create subcommand", () => {
        const command = new Poll();

        const createSubcmd = command.commandData.options.find(o => o.name === "create");
        assert.ok(createSubcmd.options, "Expected create subcommand to have options");

        const questionOpt = createSubcmd.options.find(o => o.name === "question");
        const optionsOpt = createSubcmd.options.find(o => o.name === "options");

        assert.ok(questionOpt, "Expected question option");
        assert.strictEqual(questionOpt.required, true, "Expected question to be required");

        assert.ok(optionsOpt, "Expected options option");
        assert.strictEqual(optionsOpt.required, true, "Expected options to be required");
    });

    it("should have integer option with min/max in vote subcommand", () => {
        const command = new Poll();

        const voteSubcmd = command.commandData.options.find(o => o.name === "vote");
        const optionOpt = voteSubcmd.options.find(o => o.name === "option");

        assert.ok(optionOpt, "Expected option option in vote subcommand");
        assert.strictEqual(optionOpt.type, 4, "Expected Integer type (4)");
        assert.strictEqual(optionOpt.required, true, "Expected option to be required");
        assert.strictEqual(optionOpt.minValue, 0, "Expected option minValue to be 0");
        assert.strictEqual(optionOpt.maxValue, 10, "Expected option maxValue to be 10");
    });
});
