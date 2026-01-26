import { describe, it } from "node:test";
import assert from "node:assert";
import { createMockBot } from "../mocks/index.ts";
import Versus from "../../slash/versus.ts";

describe("Versus", () => {
    // Note: Full versus tests require MongoDB, user registration, and swgohAPI.
    // We test command configuration only.

    it("should work without guild context (guildOnly: false)", () => {
        const bot = createMockBot();
        const command = new Versus(bot);

        assert.strictEqual(command.commandData.guildOnly, false, "Expected guildOnly to be false");
    });

    it("should be enabled", () => {
        const bot = createMockBot();
        const command = new Versus(bot);

        assert.strictEqual(command.commandData.enabled, true, "Expected command to be enabled");
    });

    it("should have correct command configuration", () => {
        const bot = createMockBot();
        const command = new Versus(bot);

        assert.strictEqual(command.commandData.name, "versus", "Expected command name to be 'versus'");
        assert.strictEqual(command.commandData.guildOnly, false, "Expected guildOnly to be false");
        assert.ok(command.commandData.options, "Expected options to be defined");
        assert.strictEqual(command.commandData.options.length, 3, "Expected 3 options");
    });

    it("should have required allycode options", () => {
        const bot = createMockBot();
        const command = new Versus(bot);

        const allycode1Opt = command.commandData.options.find(o => o.name === "allycode_1");
        const allycode2Opt = command.commandData.options.find(o => o.name === "allycode_2");

        assert.ok(allycode1Opt, "Expected allycode_1 option");
        assert.strictEqual(allycode1Opt.required, true, "Expected allycode_1 to be required");

        assert.ok(allycode2Opt, "Expected allycode_2 option");
        assert.strictEqual(allycode2Opt.required, true, "Expected allycode_2 to be required");
    });

    it("should have required character option with autocomplete", () => {
        const bot = createMockBot();
        const command = new Versus(bot);

        const characterOpt = command.commandData.options.find(o => o.name === "character");
        assert.ok(characterOpt, "Expected character option");
        assert.strictEqual(characterOpt.required, true, "Expected character to be required");
        assert.strictEqual(characterOpt.autocomplete, true, "Expected character to have autocomplete");
    });
});
