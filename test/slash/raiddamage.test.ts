import { describe, it } from "node:test";
import assert from "node:assert";
import { createMockBot } from "../mocks/index.ts";
import RaidDamage from "../../slash/raiddamage.ts";

describe("RaidDamage", () => {
    // Note: Full raiddamage tests require raid data.
    // We test command configuration only.

    it("should work without guild context (guildOnly: false)", () => {
        const bot = createMockBot();
        const command = new RaidDamage(bot);

        assert.strictEqual(command.commandData.guildOnly, false, "Expected guildOnly to be false");
    });

    it("should be enabled", () => {
        const bot = createMockBot();
        const command = new RaidDamage(bot);

        assert.strictEqual(command.commandData.enabled, true, "Expected command to be enabled");
    });

    it("should have correct command configuration", () => {
        const bot = createMockBot();
        const command = new RaidDamage(bot);

        assert.strictEqual(command.commandData.name, "raiddamage", "Expected command name to be 'raiddamage'");
        assert.strictEqual(command.commandData.guildOnly, false, "Expected guildOnly to be false");
        assert.ok(command.commandData.options, "Expected options to be defined");
        assert.strictEqual(command.commandData.options.length, 3, "Expected 3 options");
    });

    it("should have required raid option with choices", () => {
        const bot = createMockBot();
        const command = new RaidDamage(bot);

        const raidOpt = command.commandData.options.find(o => o.name === "raid");
        assert.ok(raidOpt, "Expected raid option");
        assert.strictEqual(raidOpt.required, true, "Expected raid to be required");
        assert.ok(raidOpt.choices, "Expected raid to have choices");
        assert.strictEqual(raidOpt.choices.length, 4, "Expected 4 raid choices");
    });

    it("should have required phase option with choices", () => {
        const bot = createMockBot();
        const command = new RaidDamage(bot);

        const phaseOpt = command.commandData.options.find(o => o.name === "phase");
        assert.ok(phaseOpt, "Expected phase option");
        assert.strictEqual(phaseOpt.required, true, "Expected phase to be required");
        assert.ok(phaseOpt.choices, "Expected phase to have choices");
        assert.strictEqual(phaseOpt.choices.length, 4, "Expected 4 phase choices");
    });

    it("should have required amount option", () => {
        const bot = createMockBot();
        const command = new RaidDamage(bot);

        const amountOpt = command.commandData.options.find(o => o.name === "amount");
        assert.ok(amountOpt, "Expected amount option");
        assert.strictEqual(amountOpt.required, true, "Expected amount to be required");
    });

    it("should have raid choices including Rancor, cRancor, HAAT, and Sith", () => {
        const bot = createMockBot();
        const command = new RaidDamage(bot);

        const raidOpt = command.commandData.options.find(o => o.name === "raid");
        const choiceValues = raidOpt.choices.map(c => c.value);

        assert.ok(choiceValues.includes("Rancor"), "Expected Rancor raid choice");
        assert.ok(choiceValues.includes("cRancor"), "Expected cRancor raid choice");
        assert.ok(choiceValues.includes("HAAT"), "Expected HAAT raid choice");
        assert.ok(choiceValues.includes("Sith"), "Expected Sith raid choice");
    });
});
