import { describe, it } from "node:test";
import assert from "node:assert";
import { createMockBot } from "../mocks/index.ts";
import Shardtimes from "../../slash/shardtimes.ts";

describe("Shardtimes", () => {
    // Note: Full shardtimes tests require MongoDB and guild configuration.
    // We test command configuration and subcommands only.

    it("should have add subcommand", () => {
        const bot = createMockBot();
        const command = new Shardtimes(bot);

        const addSubcmd = command.commandData.options.find(o => o.name === "add");
        assert.ok(addSubcmd, "Expected add subcommand");
        assert.strictEqual(addSubcmd.type, 1, "Expected Subcommand type (1)");
    });

    it("should have remove subcommand", () => {
        const bot = createMockBot();
        const command = new Shardtimes(bot);

        const removeSubcmd = command.commandData.options.find(o => o.name === "remove");
        assert.ok(removeSubcmd, "Expected remove subcommand");
        assert.strictEqual(removeSubcmd.type, 1, "Expected Subcommand type (1)");
    });

    it("should have copy subcommand", () => {
        const bot = createMockBot();
        const command = new Shardtimes(bot);

        const copySubcmd = command.commandData.options.find(o => o.name === "copy");
        assert.ok(copySubcmd, "Expected copy subcommand");
        assert.strictEqual(copySubcmd.type, 1, "Expected Subcommand type (1)");
    });

    it("should have view subcommand", () => {
        const bot = createMockBot();
        const command = new Shardtimes(bot);

        const viewSubcmd = command.commandData.options.find(o => o.name === "view");
        assert.ok(viewSubcmd, "Expected view subcommand");
        assert.strictEqual(viewSubcmd.type, 1, "Expected Subcommand type (1)");
    });

    it("should work without guild context (guildOnly: false)", () => {
        const bot = createMockBot();
        const command = new Shardtimes(bot);

        assert.strictEqual(command.commandData.guildOnly, false, "Expected guildOnly to be false");
    });

    it("should have correct command configuration", () => {
        const bot = createMockBot();
        const command = new Shardtimes(bot);

        assert.strictEqual(command.commandData.name, "shardtimes", "Expected command name to be 'shardtimes'");
        assert.strictEqual(command.commandData.guildOnly, false, "Expected guildOnly to be false");
        assert.ok(command.commandData.options, "Expected options to be defined");
        assert.strictEqual(command.commandData.options.length, 4, "Expected 4 subcommands");
    });

    it("should have required user field in add subcommand", () => {
        const bot = createMockBot();
        const command = new Shardtimes(bot);

        const addSubcmd = command.commandData.options.find(o => o.name === "add");
        assert.ok(addSubcmd.options, "Expected add subcommand to have options");

        const userOpt = addSubcmd.options.find(o => o.name === "user");
        assert.ok(userOpt, "Expected user option");
        assert.strictEqual(userOpt.required, true, "Expected user to be required");
    });

    it("should have required dest_channel field in copy subcommand", () => {
        const bot = createMockBot();
        const command = new Shardtimes(bot);

        const copySubcmd = command.commandData.options.find(o => o.name === "copy");
        const destChannelOpt = copySubcmd.options.find(o => o.name === "dest_channel");

        assert.ok(destChannelOpt, "Expected dest_channel option");
        assert.strictEqual(destChannelOpt.required, true, "Expected dest_channel to be required");
    });
});
