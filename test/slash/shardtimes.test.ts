import assert from "node:assert";
import { describe, it } from "node:test";
import Shardtimes from "../../slash/shardtimes.ts";

describe("Shardtimes", () => {
    // Note: Full shardtimes tests require MongoDB and guild configuration.
    // We test command configuration and subcommands only.

    it("should have add subcommand", () => {        const command = new Shardtimes();

        const addSubcmd = command.commandData.options.find(o => o.name === "add");
        assert.ok(addSubcmd, "Expected add subcommand");
        assert.strictEqual(addSubcmd.type, 1, "Expected Subcommand type (1)");
    });

    it("should have remove subcommand", () => {        const command = new Shardtimes();

        const removeSubcmd = command.commandData.options.find(o => o.name === "remove");
        assert.ok(removeSubcmd, "Expected remove subcommand");
        assert.strictEqual(removeSubcmd.type, 1, "Expected Subcommand type (1)");
    });

    it("should have copy subcommand", () => {        const command = new Shardtimes();

        const copySubcmd = command.commandData.options.find(o => o.name === "copy");
        assert.ok(copySubcmd, "Expected copy subcommand");
        assert.strictEqual(copySubcmd.type, 1, "Expected Subcommand type (1)");
    });

    it("should have view subcommand", () => {        const command = new Shardtimes();

        const viewSubcmd = command.commandData.options.find(o => o.name === "view");
        assert.ok(viewSubcmd, "Expected view subcommand");
        assert.strictEqual(viewSubcmd.type, 1, "Expected Subcommand type (1)");
    });

    it("should work without guild context (guildOnly: false)", () => {        const command = new Shardtimes();

        assert.strictEqual(command.commandData.guildOnly, false, "Expected guildOnly to be false");
    });

    it("should have correct command configuration", () => {        const command = new Shardtimes();

        assert.strictEqual(command.commandData.name, "shardtimes", "Expected command name to be 'shardtimes'");
        assert.strictEqual(command.commandData.guildOnly, false, "Expected guildOnly to be false");
        assert.ok(command.commandData.options, "Expected options to be defined");
        assert.strictEqual(command.commandData.options.length, 4, "Expected 4 subcommands");
    });

    it("should have required user field in add subcommand", () => {        const command = new Shardtimes();

        const addSubcmd = command.commandData.options.find(o => o.name === "add");
        assert.ok(addSubcmd.options, "Expected add subcommand to have options");

        const userOpt = addSubcmd.options.find(o => o.name === "user");
        assert.ok(userOpt, "Expected user option");
        assert.strictEqual(userOpt.required, true, "Expected user to be required");
    });

    it("should have required dest_channel field in copy subcommand", () => {        const command = new Shardtimes();

        const copySubcmd = command.commandData.options.find(o => o.name === "copy");
        const destChannelOpt = copySubcmd.options.find(o => o.name === "dest_channel");

        assert.ok(destChannelOpt, "Expected dest_channel option");
        assert.strictEqual(destChannelOpt.required, true, "Expected dest_channel to be required");
    });
});
