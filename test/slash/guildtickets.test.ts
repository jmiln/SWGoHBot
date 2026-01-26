import { describe, it } from "node:test";
import assert from "node:assert";
import { createMockBot } from "../mocks/index.ts";
import GuildTickets from "../../slash/guildtickets.ts";

describe("GuildTickets", () => {
    // Note: Full guildtickets tests require MongoDB and Patreon verification.
    // We test command configuration and subcommand structure only.

    it("should work without guild context (guildOnly: false)", () => {
        const bot = createMockBot();
        const command = new GuildTickets(bot);

        assert.strictEqual(command.commandData.guildOnly, false, "Expected guildOnly to be false");
    });

    it("should be enabled", () => {
        const bot = createMockBot();
        const command = new GuildTickets(bot);

        assert.strictEqual(command.commandData.enabled, true, "Expected command to be enabled");
    });

    it("should have correct command configuration", () => {
        const bot = createMockBot();
        const command = new GuildTickets(bot);

        assert.strictEqual(command.commandData.name, "guildtickets", "Expected command name to be 'guildtickets'");
        assert.strictEqual(command.commandData.guildOnly, false, "Expected guildOnly to be false");
        assert.ok(command.commandData.options, "Expected options to be defined");
    });

    it("should have set subcommand", () => {
        const bot = createMockBot();
        const command = new GuildTickets(bot);

        const setSubcmd = command.commandData.options.find(o => o.name === "set");
        assert.ok(setSubcmd, "Expected set subcommand");
        assert.strictEqual(setSubcmd.type, 1, "Expected Subcommand type (1)");
    });

    it("should have view subcommand", () => {
        const bot = createMockBot();
        const command = new GuildTickets(bot);

        const viewSubcmd = command.commandData.options.find(o => o.name === "view");
        assert.ok(viewSubcmd, "Expected view subcommand");
        assert.strictEqual(viewSubcmd.type, 1, "Expected Subcommand type (1)");
    });

    it("should have channel option in set subcommand", () => {
        const bot = createMockBot();
        const command = new GuildTickets(bot);

        const setSubcmd = command.commandData.options.find(o => o.name === "set");
        assert.ok(setSubcmd.options, "Expected set subcommand to have options");

        const channelOpt = setSubcmd.options.find(o => o.name === "channel");
        assert.ok(channelOpt, "Expected channel option");
    });

    it("should have sortby option with choices in set subcommand", () => {
        const bot = createMockBot();
        const command = new GuildTickets(bot);

        const setSubcmd = command.commandData.options.find(o => o.name === "set");
        const sortbyOpt = setSubcmd.options.find(o => o.name === "sortby");

        assert.ok(sortbyOpt, "Expected sortby option");
        assert.ok(sortbyOpt.choices, "Expected sortby to have choices");
        assert.ok(sortbyOpt.choices.length > 0, "Expected sortby to have multiple choices");
    });
});
