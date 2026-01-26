import { describe, it } from "node:test";
import assert from "node:assert";
import { createMockBot } from "../mocks/index.ts";
import UserConf from "../../slash/userconf.ts";

describe("UserConf", () => {
    // Note: Full userconf tests require MongoDB and user registration.
    // We test command configuration and subcommands only.

    it("should have allycodes subcommand group", () => {
        const bot = createMockBot();
        const command = new UserConf(bot);

        const allycodesGroup = command.commandData.options.find(o => o.name === "allycodes");
        assert.ok(allycodesGroup, "Expected allycodes subcommand group");
        assert.strictEqual(allycodesGroup.type, 2, "Expected SubcommandGroup type (2)");
    });

    it("should have arenaalert subcommand", () => {
        const bot = createMockBot();
        const command = new UserConf(bot);

        const arenaalertSubcmd = command.commandData.options.find(o => o.name === "arenaalert");
        assert.ok(arenaalertSubcmd, "Expected arenaalert subcommand");
        assert.strictEqual(arenaalertSubcmd.type, 1, "Expected Subcommand type (1)");
    });

    it("should have add, remove, make_primary subcommands in allycodes group", () => {
        const bot = createMockBot();
        const command = new UserConf(bot);

        const allycodesGroup = command.commandData.options.find(o => o.name === "allycodes");
        assert.ok(allycodesGroup.options, "Expected allycodes group to have options");

        const addSubcmd = allycodesGroup.options.find(o => o.name === "add");
        const removeSubcmd = allycodesGroup.options.find(o => o.name === "remove");
        const makePrimarySubcmd = allycodesGroup.options.find(o => o.name === "make_primary");

        assert.ok(addSubcmd, "Expected add subcommand");
        assert.strictEqual(addSubcmd.type, 1, "Expected Subcommand type (1)");

        assert.ok(removeSubcmd, "Expected remove subcommand");
        assert.strictEqual(removeSubcmd.type, 1, "Expected Subcommand type (1)");

        assert.ok(makePrimarySubcmd, "Expected make_primary subcommand");
        assert.strictEqual(makePrimarySubcmd.type, 1, "Expected Subcommand type (1)");
    });

    it("should work without guild context (guildOnly: false)", () => {
        const bot = createMockBot();
        const command = new UserConf(bot);

        assert.strictEqual(command.commandData.guildOnly, false, "Expected guildOnly to be false");
    });

    it("should have correct command configuration", () => {
        const bot = createMockBot();
        const command = new UserConf(bot);

        assert.strictEqual(command.commandData.name, "userconf", "Expected command name to be 'userconf'");
        assert.strictEqual(command.commandData.guildOnly, false, "Expected guildOnly to be false");
        assert.ok(command.commandData.options, "Expected options to be defined");
        assert.ok(command.commandData.options.length >= 2, "Expected at least 2 options");
    });

    it("should have required allycode field in add subcommand", () => {
        const bot = createMockBot();
        const command = new UserConf(bot);

        const allycodesGroup = command.commandData.options.find(o => o.name === "allycodes");
        const addSubcmd = allycodesGroup.options.find(o => o.name === "add");
        const allycodeOpt = addSubcmd.options.find(o => o.name === "allycode");

        assert.ok(allycodeOpt, "Expected allycode option");
        assert.strictEqual(allycodeOpt.required, true, "Expected allycode to be required");
    });

    it("should have choices in arenaalert subcommand options", () => {
        const bot = createMockBot();
        const command = new UserConf(bot);

        const arenaalertSubcmd = command.commandData.options.find(o => o.name === "arenaalert");
        assert.ok(arenaalertSubcmd.options, "Expected arenaalert to have options");

        const enableDmsOpt = arenaalertSubcmd.options.find(o => o.name === "enable_dms");
        const arenaOpt = arenaalertSubcmd.options.find(o => o.name === "arena");

        if (enableDmsOpt) {
            assert.ok(enableDmsOpt.choices, "Expected enable_dms to have choices");
            assert.ok(enableDmsOpt.choices.length > 0, "Expected enable_dms to have multiple choices");
        }

        if (arenaOpt) {
            assert.ok(arenaOpt.choices, "Expected arena to have choices");
            assert.ok(arenaOpt.choices.length > 0, "Expected arena to have multiple choices");
        }
    });
});
