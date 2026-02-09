import assert from "node:assert";
import { describe, it } from "node:test";
import SetConf from "../../slash/setconf.ts";

describe("SetConf", () => {
    // Note: Full setconf tests require MongoDB and guild configuration.
    // We test command configuration and subcommands only.

    it("should have add subcommand", () => {        const command = new SetConf();

        const addSubcmd = command.commandData.options.find(o => o.name === "add");
        assert.ok(addSubcmd, "Expected add subcommand");
        assert.strictEqual(addSubcmd.type, 1, "Expected Subcommand type (1)");
    });

    it("should have remove subcommand", () => {        const command = new SetConf();

        const removeSubcmd = command.commandData.options.find(o => o.name === "remove");
        assert.ok(removeSubcmd, "Expected remove subcommand");
        assert.strictEqual(removeSubcmd.type, 1, "Expected Subcommand type (1)");
    });

    it("should have set subcommand", () => {        const command = new SetConf();

        const setSubcmd = command.commandData.options.find(o => o.name === "set");
        assert.ok(setSubcmd, "Expected set subcommand");
        assert.strictEqual(setSubcmd.type, 1, "Expected Subcommand type (1)");
    });

    it("should have twlist subcommand group", () => {        const command = new SetConf();

        const twlistGroup = command.commandData.options.find(o => o.name === "twlist");
        assert.ok(twlistGroup, "Expected twlist subcommand group");
        assert.strictEqual(twlistGroup.type, 2, "Expected SubcommandGroup type (2)");
    });

    it("should work without guild context (guildOnly: false)", () => {        const command = new SetConf();

        assert.strictEqual(command.commandData.guildOnly, false, "Expected guildOnly to be false");
    });

    it("should have correct command configuration", () => {        const command = new SetConf();

        assert.strictEqual(command.commandData.name, "setconf", "Expected command name to be 'setconf'");
        assert.strictEqual(command.commandData.guildOnly, false, "Expected guildOnly to be false");
        assert.ok(command.commandData.options, "Expected options to be defined");
        assert.ok(command.commandData.options.length >= 4, "Expected at least 4 options");
    });

    it("should have manage_list, blacklist, view in twlist group", () => {        const command = new SetConf();

        const twlistGroup = command.commandData.options.find(o => o.name === "twlist");
        assert.ok(twlistGroup.options, "Expected twlist group to have options");

        const manageListSubcmd = twlistGroup.options.find(o => o.name === "manage_list");
        const blacklistSubcmd = twlistGroup.options.find(o => o.name === "blacklist");
        const viewSubcmd = twlistGroup.options.find(o => o.name === "view");

        assert.ok(manageListSubcmd, "Expected manage_list subcommand");
        assert.strictEqual(manageListSubcmd.type, 1, "Expected Subcommand type (1)");

        assert.ok(blacklistSubcmd, "Expected blacklist subcommand");
        assert.strictEqual(blacklistSubcmd.type, 1, "Expected Subcommand type (1)");

        assert.ok(viewSubcmd, "Expected view subcommand");
        assert.strictEqual(viewSubcmd.type, 1, "Expected Subcommand type (1)");
    });
});
