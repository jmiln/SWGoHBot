import assert from "node:assert";
import { describe, it } from "node:test";
import GuildUpdate from "../../slash/guildupdate.ts";

describe("GuildUpdate", () => {
    // Note: Full guildupdate tests require MongoDB and Patreon verification.
    // We test command configuration and subcommand structure only.

    it("should work without guild context (guildOnly: false)", () => {        const command = new GuildUpdate();

        assert.strictEqual(command.commandData.guildOnly, false, "Expected guildOnly to be false");
    });

    it("should be enabled", () => {        const command = new GuildUpdate();

        assert.strictEqual(command.commandData.enabled, true, "Expected command to be enabled");
    });

    it("should have correct command configuration", () => {        const command = new GuildUpdate();

        assert.strictEqual(command.commandData.name, "guildupdate", "Expected command name to be 'guildupdate'");
        assert.strictEqual(command.commandData.guildOnly, false, "Expected guildOnly to be false");
        assert.ok(command.commandData.options, "Expected options to be defined");
        assert.strictEqual(command.commandData.options.length, 2, "Expected 2 subcommands (set, view)");
    });

    it("should have set subcommand", () => {        const command = new GuildUpdate();

        const setSubcmd = command.commandData.options.find(o => o.name === "set");
        assert.ok(setSubcmd, "Expected set subcommand");
        assert.strictEqual(setSubcmd.type, 1, "Expected Subcommand type (1)");
    });

    it("should have view subcommand", () => {        const command = new GuildUpdate();

        const viewSubcmd = command.commandData.options.find(o => o.name === "view");
        assert.ok(viewSubcmd, "Expected view subcommand");
        assert.strictEqual(viewSubcmd.type, 1, "Expected Subcommand type (1)");
    });

    it("should have channel option in set subcommand", () => {        const command = new GuildUpdate();

        const setSubcmd = command.commandData.options.find(o => o.name === "set");
        assert.ok(setSubcmd.options, "Expected set subcommand to have options");

        const channelOpt = setSubcmd.options.find(o => o.name === "channel");
        assert.ok(channelOpt, "Expected channel option");
    });

    it("should have allycode option in set subcommand", () => {        const command = new GuildUpdate();

        const setSubcmd = command.commandData.options.find(o => o.name === "set");
        const allycodeOpt = setSubcmd.options.find(o => o.name === "allycode");

        assert.ok(allycodeOpt, "Expected allycode option");
        assert.strictEqual(allycodeOpt.required, undefined, "Expected allycode to be optional (required not set)");
    });
});
