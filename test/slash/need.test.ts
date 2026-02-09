import assert from "node:assert";
import { describe, it } from "node:test";
import Need from "../../slash/need.ts";

describe("Need", () => {
    // Note: Full need tests require MongoDB, user registration, and swgohAPI.
    // We test command configuration only.

    it("should work without guild context (guildOnly: false)", () => {        const command = new Need();

        assert.strictEqual(command.commandData.guildOnly, false, "Expected guildOnly to be false");
    });

    it("should have correct command configuration", () => {        const command = new Need();

        assert.strictEqual(command.commandData.name, "need", "Expected command name to be 'need'");
        assert.strictEqual(command.commandData.guildOnly, false, "Expected guildOnly to be false");
        assert.strictEqual(command.commandData.enabled, true, "Expected command to be enabled");
        assert.ok(command.commandData.options, "Expected options to be defined");
        assert.strictEqual(command.commandData.options.length, 6, "Expected 6 options");
    });

    it("should have allycode option", () => {        const command = new Need();

        const allycodeOpt = command.commandData.options.find(o => o.name === "allycode");
        assert.ok(allycodeOpt, "Expected allycode option");
        assert.strictEqual(allycodeOpt.required, undefined, "Expected allycode to be optional");
    });

    it("should have battle option with choices", () => {        const command = new Need();

        const battleOpt = command.commandData.options.find(o => o.name === "battle");
        assert.ok(battleOpt, "Expected battle option");
        assert.ok(battleOpt.choices, "Expected battle to have choices");
        assert.ok(battleOpt.choices.length > 0, "Expected battle to have multiple choices");
    });

    it("should have shop option with choices", () => {        const command = new Need();

        const shopOpt = command.commandData.options.find(o => o.name === "shop");
        assert.ok(shopOpt, "Expected shop option");
        assert.ok(shopOpt.choices, "Expected shop to have choices");
        assert.ok(shopOpt.choices.length > 0, "Expected shop to have multiple choices");
    });

    it("should have faction_group_1 option with choices", () => {        const command = new Need();

        const factionOpt = command.commandData.options.find(o => o.name === "faction_group_1");
        assert.ok(factionOpt, "Expected faction_group_1 option");
        assert.ok(factionOpt.choices, "Expected faction_group_1 to have choices");
        assert.ok(factionOpt.choices.length > 0, "Expected faction_group_1 to have multiple choices");
    });

    it("should have faction_group_2 option with choices", () => {        const command = new Need();

        const factionOpt = command.commandData.options.find(o => o.name === "faction_group_2");
        assert.ok(factionOpt, "Expected faction_group_2 option");
        assert.ok(factionOpt.choices, "Expected faction_group_2 to have choices");
        assert.ok(factionOpt.choices.length > 0, "Expected faction_group_2 to have multiple choices");
    });

    it("should have keyword option with choices", () => {        const command = new Need();

        const keywordOpt = command.commandData.options.find(o => o.name === "keyword");
        assert.ok(keywordOpt, "Expected keyword option");
        assert.ok(keywordOpt.choices, "Expected keyword to have choices");
        assert.ok(keywordOpt.choices.length > 0, "Expected keyword to have multiple choices");
    });
});
