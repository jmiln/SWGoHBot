import assert from "node:assert";
import { describe, it } from "node:test";
import Guilds from "../../slash/guilds.ts";
import { createMockBot, createMockInteraction } from "../mocks/index.ts";

/**
 * Helper function to extract description from a reply embed.
 */
function getReplyDescription(reply: any): string | undefined {
    return reply?.embeds?.[0]?.data?.description || reply?.embeds?.[0]?.description;
}

describe("Guilds Command Functionality", () => {
    describe("command configuration", () => {
        it("should have correct basic configuration", () => {
            const bot = createMockBot();
            const command = new Guilds(bot);

            assert.strictEqual(command.commandData.name, "guilds");
            assert.strictEqual(command.commandData.guildOnly, false);
            assert.strictEqual(command.commandData.options.length, 7, "Should have 7 subcommands");
        });

        it("should have all expected subcommands", () => {
            const bot = createMockBot();
            const command = new Guilds(bot);

            const expectedSubcommands = ["gear", "mods", "relics", "roster", "tickets", "tw_summary", "view"];
            const actualSubcommands = command.commandData.options.map(o => o.name);

            for (const expected of expectedSubcommands) {
                assert.ok(actualSubcommands.includes(expected), `Should have ${expected} subcommand`);
            }
        });
    });

    describe("gear subcommand options", () => {
        it("should have allycode option", () => {
            const bot = createMockBot();
            const command = new Guilds(bot);

            const gearSubcmd = command.commandData.options.find(o => o.name === "gear");
            assert.ok(gearSubcmd, "Expected gear subcommand");

            const allycodeOpt = gearSubcmd.options?.find(o => o.name === "allycode");
            assert.ok(allycodeOpt, "Expected allycode option");
            assert.strictEqual(allycodeOpt.type, 3, "Expected String type");
        });

        it("should have sort option with correct range", () => {
            const bot = createMockBot();
            const command = new Guilds(bot);

            const gearSubcmd = command.commandData.options.find(o => o.name === "gear");
            const sortOpt = gearSubcmd.options?.find(o => o.name === "sort");

            assert.ok(sortOpt, "Expected sort option");
            assert.strictEqual(sortOpt.type, 4, "Expected Integer type");
            assert.strictEqual(sortOpt.minValue, 9);
            assert.strictEqual(sortOpt.maxValue, 13);
        });
    });

    describe("mods subcommand options", () => {
        it("should have sort choices", () => {
            const bot = createMockBot();
            const command = new Guilds(bot);

            const modsSubcmd = command.commandData.options.find(o => o.name === "mods");
            const sortOpt = modsSubcmd.options?.find(o => o.name === "sort");

            assert.ok(sortOpt, "Expected sort option");
            assert.ok(sortOpt.choices, "Expected choices");
            assert.ok(sortOpt.choices.length >= 4, "Expected at least 4 sort choices");

            const expectedChoices = ["name", "offense", "6", "speed"];
            for (const expected of expectedChoices) {
                assert.ok(
                    sortOpt.choices.some(c => c.value === expected),
                    `Expected ${expected} choice`
                );
            }
        });
    });

    describe("roster subcommand options", () => {
        it("should have show_allycode boolean option", () => {
            const bot = createMockBot();
            const command = new Guilds(bot);

            const rosterSubcmd = command.commandData.options.find(o => o.name === "roster");
            const showACOpt = rosterSubcmd.options?.find(o => o.name === "show_allycode");

            assert.ok(showACOpt, "Expected show_allycode option");
            assert.strictEqual(showACOpt.type, 5, "Expected Boolean type");
        });

        it("should have registered option", () => {
            const bot = createMockBot();
            const command = new Guilds(bot);

            const rosterSubcmd = command.commandData.options.find(o => o.name === "roster");
            const registeredOpt = rosterSubcmd.options?.find(o => o.name === "registered");

            assert.ok(registeredOpt, "Expected registered option");
            assert.strictEqual(registeredOpt.type, 5, "Expected Boolean type");
        });

        it("should have sort option with choices", () => {
            const bot = createMockBot();
            const command = new Guilds(bot);

            const rosterSubcmd = command.commandData.options.find(o => o.name === "roster");
            const sortOpt = rosterSubcmd.options?.find(o => o.name === "sort");

            assert.ok(sortOpt, "Expected sort option");
            assert.ok(sortOpt.choices, "Expected sort choices");

            const expectedChoices = ["name", "rank", "gp"];
            for (const expected of expectedChoices) {
                assert.ok(
                    sortOpt.choices.some(c => c.value === expected),
                    `Expected ${expected} choice`
                );
            }
        });

        it("should have show_side option with light/dark choices", () => {
            const bot = createMockBot();
            const command = new Guilds(bot);

            const rosterSubcmd = command.commandData.options.find(o => o.name === "roster");
            const showSideOpt = rosterSubcmd.options?.find(o => o.name === "show_side");

            assert.ok(showSideOpt, "Expected show_side option");
            assert.ok(showSideOpt.choices, "Expected side choices");
            assert.strictEqual(showSideOpt.choices.length, 2, "Expected 2 side choices");

            const values = showSideOpt.choices.map(c => c.value);
            assert.ok(values.includes("light"), "Expected light side choice");
            assert.ok(values.includes("dark"), "Expected dark side choice");
        });

        it("should have split_types option", () => {
            const bot = createMockBot();
            const command = new Guilds(bot);

            const rosterSubcmd = command.commandData.options.find(o => o.name === "roster");
            const splitTypesOpt = rosterSubcmd.options?.find(o => o.name === "split_types");

            assert.ok(splitTypesOpt, "Expected split_types option");
            assert.strictEqual(splitTypesOpt.type, 5, "Expected Boolean type");
        });
    });

    describe("tickets subcommand options", () => {
        it("should have sort option", () => {
            const bot = createMockBot();
            const command = new Guilds(bot);

            const ticketsSubcmd = command.commandData.options.find(o => o.name === "tickets");
            const sortOpt = ticketsSubcmd.options?.find(o => o.name === "sort");

            assert.ok(sortOpt, "Expected sort option");
            assert.ok(sortOpt.choices, "Expected sort choices");

            const values = sortOpt.choices.map(c => c.value);
            assert.ok(values.includes("tickets"), "Expected tickets sort choice");
            assert.ok(values.includes("name"), "Expected name sort choice");
        });

        it("should have show_all boolean option", () => {
            const bot = createMockBot();
            const command = new Guilds(bot);

            const ticketsSubcmd = command.commandData.options.find(o => o.name === "tickets");
            const showAllOpt = ticketsSubcmd.options?.find(o => o.name === "show_all");

            assert.ok(showAllOpt, "Expected show_all option");
            assert.strictEqual(showAllOpt.type, 5, "Expected Boolean type");
        });
    });

    describe("tw_summary subcommand options", () => {
        it("should have expand boolean option", () => {
            const bot = createMockBot();
            const command = new Guilds(bot);

            const twSummarySubcmd = command.commandData.options.find(o => o.name === "tw_summary");
            const expandOpt = twSummarySubcmd.options?.find(o => o.name === "expand");

            assert.ok(expandOpt, "Expected expand option");
            assert.strictEqual(expandOpt.type, 5, "Expected Boolean type");
        });
    });

});
