import { describe, it } from "node:test";
import assert from "node:assert";
import { createMockBot } from "../mocks/index.ts";
import Guilds from "../../slash/guilds.ts";

describe("Guilds", () => {
    // Note: Full guilds tests require MongoDB, guild data, and swgohAPI.
    // We test command configuration and subcommands only.

    it("should have gear subcommand", () => {
        const bot = createMockBot();
        const command = new Guilds(bot);

        const gearSubcmd = command.commandData.options.find(o => o.name === "gear");
        assert.ok(gearSubcmd, "Expected gear subcommand");
        assert.strictEqual(gearSubcmd.type, 1, "Expected Subcommand type (1)");
    });

    it("should have mods subcommand", () => {
        const bot = createMockBot();
        const command = new Guilds(bot);

        const modsSubcmd = command.commandData.options.find(o => o.name === "mods");
        assert.ok(modsSubcmd, "Expected mods subcommand");
        assert.strictEqual(modsSubcmd.type, 1, "Expected Subcommand type (1)");
    });

    it("should have relics subcommand", () => {
        const bot = createMockBot();
        const command = new Guilds(bot);

        const relicsSubcmd = command.commandData.options.find(o => o.name === "relics");
        assert.ok(relicsSubcmd, "Expected relics subcommand");
        assert.strictEqual(relicsSubcmd.type, 1, "Expected Subcommand type (1)");
    });

    it("should have roster subcommand", () => {
        const bot = createMockBot();
        const command = new Guilds(bot);

        const rosterSubcmd = command.commandData.options.find(o => o.name === "roster");
        assert.ok(rosterSubcmd, "Expected roster subcommand");
        assert.strictEqual(rosterSubcmd.type, 1, "Expected Subcommand type (1)");
    });

    it("should have tickets subcommand", () => {
        const bot = createMockBot();
        const command = new Guilds(bot);

        const ticketsSubcmd = command.commandData.options.find(o => o.name === "tickets");
        assert.ok(ticketsSubcmd, "Expected tickets subcommand");
        assert.strictEqual(ticketsSubcmd.type, 1, "Expected Subcommand type (1)");
    });

    it("should have tw_summary subcommand", () => {
        const bot = createMockBot();
        const command = new Guilds(bot);

        const twSummarySubcmd = command.commandData.options.find(o => o.name === "tw_summary");
        assert.ok(twSummarySubcmd, "Expected tw_summary subcommand");
        assert.strictEqual(twSummarySubcmd.type, 1, "Expected Subcommand type (1)");
    });

    it("should have view subcommand", () => {
        const bot = createMockBot();
        const command = new Guilds(bot);

        const viewSubcmd = command.commandData.options.find(o => o.name === "view");
        assert.ok(viewSubcmd, "Expected view subcommand");
        assert.strictEqual(viewSubcmd.type, 1, "Expected Subcommand type (1)");
    });

    it("should work without guild context (guildOnly: false)", () => {
        const bot = createMockBot();
        const command = new Guilds(bot);

        assert.strictEqual(command.commandData.guildOnly, false, "Expected guildOnly to be false");
    });

    it("should have correct command configuration", () => {
        const bot = createMockBot();
        const command = new Guilds(bot);

        assert.strictEqual(command.commandData.name, "guilds", "Expected command name to be 'guilds'");
        assert.strictEqual(command.commandData.guildOnly, false, "Expected guildOnly to be false");
        assert.ok(command.commandData.options, "Expected options to be defined");
        assert.strictEqual(command.commandData.options.length, 7, "Expected 7 subcommands");
    });

    it("should have sort choices in mods subcommand", () => {
        const bot = createMockBot();
        const command = new Guilds(bot);

        const modsSubcmd = command.commandData.options.find(o => o.name === "mods");
        assert.ok(modsSubcmd.options, "Expected mods subcommand to have options");

        const sortOpt = modsSubcmd.options.find(o => o.name === "sort");
        assert.ok(sortOpt, "Expected sort option");
        assert.ok(sortOpt.choices, "Expected sort to have choices");
        assert.ok(sortOpt.choices.length > 0, "Expected sort to have multiple choices");
    });

    it("should have integer sort option with min/max in gear subcommand", () => {
        const bot = createMockBot();
        const command = new Guilds(bot);

        const gearSubcmd = command.commandData.options.find(o => o.name === "gear");
        const sortOpt = gearSubcmd.options.find(o => o.name === "sort");

        assert.ok(sortOpt, "Expected sort option");
        assert.strictEqual(sortOpt.type, 4, "Expected Integer type (4)");
        assert.strictEqual(sortOpt.minValue, 9, "Expected sort minValue to be 9");
        assert.strictEqual(sortOpt.maxValue, 13, "Expected sort maxValue to be 13");
    });
});
