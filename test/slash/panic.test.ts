import assert from "node:assert";
import { describe, it } from "node:test";
import Panic from "../../slash/panic.ts";
import { createMockBot } from "../mocks/index.ts";

describe("Panic", () => {
    // Note: Full panic tests require MongoDB, user registration, swgohAPI, and image service.
    // We test command configuration only.

    it("should work without guild context (guildOnly: false)", () => {
        const bot = createMockBot();
        const command = new Panic(bot);

        assert.strictEqual(command.commandData.guildOnly, false, "Expected guildOnly to be false");
    });

    it("should have correct command configuration", () => {
        const bot = createMockBot();
        const command = new Panic(bot);

        assert.strictEqual(command.commandData.name, "panic", "Expected command name to be 'panic'");
        assert.strictEqual(command.commandData.guildOnly, false, "Expected guildOnly to be false");
        assert.ok(command.commandData.options, "Expected options to be defined");
        assert.strictEqual(command.commandData.options.length, 2, "Expected 2 options");
    });

    it("should have required unit option with autocomplete", () => {
        const bot = createMockBot();
        const command = new Panic(bot);

        const unitOpt = command.commandData.options.find(o => o.name === "unit");
        assert.ok(unitOpt, "Expected unit option");
        assert.strictEqual(unitOpt.required, true, "Expected unit to be required");
        assert.strictEqual(unitOpt.autocomplete, true, "Expected unit to have autocomplete");
    });

    it("should have optional allycode option", () => {
        const bot = createMockBot();
        const command = new Panic(bot);

        const allycodeOpt = command.commandData.options.find(o => o.name === "allycode");
        assert.ok(allycodeOpt, "Expected allycode option");
        assert.strictEqual(allycodeOpt.required, undefined, "Expected allycode to be optional");
    });

    it("should have description", () => {
        const bot = createMockBot();
        const command = new Panic(bot);

        assert.ok(command.commandData.description, "Expected command to have description");
        assert.ok(command.commandData.description.includes("event"), "Expected description to mention events");
    });
});
