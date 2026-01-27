import assert from "node:assert";
import { describe, it } from "node:test";
import ArenaAlert from "../../slash/arenaalert.ts";
import { createMockBot } from "../mocks/index.ts";

describe("ArenaAlert", () => {
    // Note: Full arenaalert tests require MongoDB and Patreon verification.
    // We test command configuration only.

    it("should work without guild context (guildOnly: false)", () => {
        const bot = createMockBot();
        const command = new ArenaAlert(bot);

        assert.strictEqual(command.commandData.guildOnly, false, "Expected guildOnly to be false");
    });

    it("should be enabled", () => {
        const bot = createMockBot();
        const command = new ArenaAlert(bot);

        assert.strictEqual(command.commandData.enabled, true, "Expected command to be enabled");
    });

    it("should have correct command configuration", () => {
        const bot = createMockBot();
        const command = new ArenaAlert(bot);

        assert.strictEqual(command.commandData.name, "arenaalert", "Expected command name to be 'arenaalert'");
        assert.strictEqual(command.commandData.guildOnly, false, "Expected guildOnly to be false");
        assert.ok(command.commandData.options, "Expected options to be defined");
    });

    it("should have enabledms option with choices", () => {
        const bot = createMockBot();
        const command = new ArenaAlert(bot);

        const enabledmsOpt = command.commandData.options.find(o => o.name === "enabledms");
        assert.ok(enabledmsOpt, "Expected enabledms option");
        assert.ok(enabledmsOpt.choices, "Expected enabledms to have choices");
        assert.ok(enabledmsOpt.choices.length > 0, "Expected enabledms to have multiple choices");
    });

    it("should have arena option with choices", () => {
        const bot = createMockBot();
        const command = new ArenaAlert(bot);

        const arenaOpt = command.commandData.options.find(o => o.name === "arena");
        assert.ok(arenaOpt, "Expected arena option");
        assert.ok(arenaOpt.choices, "Expected arena to have choices");
        assert.ok(arenaOpt.choices.length > 0, "Expected arena to have multiple choices");
    });

    it("should have payout_result option with choices", () => {
        const bot = createMockBot();
        const command = new ArenaAlert(bot);

        const payoutResultOpt = command.commandData.options.find(o => o.name === "payout_result");
        assert.ok(payoutResultOpt, "Expected payout_result option");
        assert.ok(payoutResultOpt.choices, "Expected payout_result to have choices");
    });

    it("should have payout_warning option", () => {
        const bot = createMockBot();
        const command = new ArenaAlert(bot);

        const payoutWarningOpt = command.commandData.options.find(o => o.name === "payout_warning");
        assert.ok(payoutWarningOpt, "Expected payout_warning option");
    });
});
