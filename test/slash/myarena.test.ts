import { describe, it } from "node:test";
import assert from "node:assert";
import { createMockBot } from "../mocks/index.ts";
import MyArena from "../../slash/myarena.ts";

describe("MyArena", () => {
    // Note: Full myarena tests require MongoDB, user registration, and swgohAPI.
    // We test command configuration only.

    it("should work without guild context (guildOnly: false)", () => {
        const bot = createMockBot();
        const command = new MyArena(bot);

        assert.strictEqual(command.commandData.guildOnly, false, "Expected guildOnly to be false");
    });

    it("should have correct command configuration", () => {
        const bot = createMockBot();
        const command = new MyArena(bot);

        assert.strictEqual(command.commandData.name, "myarena", "Expected command name to be 'myarena'");
        assert.strictEqual(command.commandData.guildOnly, false, "Expected guildOnly to be false");
        assert.ok(command.commandData.options, "Expected options to be defined");
        assert.strictEqual(command.commandData.options.length, 2, "Expected 2 options");

        const allycodeOpt = command.commandData.options.find(o => o.name === "allycode");
        const statsOpt = command.commandData.options.find(o => o.name === "stats");

        assert.ok(allycodeOpt, "Expected allycode option");
        assert.ok(statsOpt, "Expected stats option");
        assert.strictEqual(allycodeOpt.required, undefined, "Expected allycode to be optional");
        assert.strictEqual(statsOpt.required, undefined, "Expected stats to be optional");
    });

    it("should have description", () => {
        const bot = createMockBot();
        const command = new MyArena(bot);

        assert.ok(command.commandData.description, "Expected command to have description");
        assert.ok(command.commandData.description.length > 0, "Expected non-empty description");
    });

    it("should have stats option as boolean type", () => {
        const bot = createMockBot();
        const command = new MyArena(bot);

        const statsOpt = command.commandData.options.find(o => o.name === "stats");
        assert.ok(statsOpt, "Expected stats option");
        assert.strictEqual(statsOpt.type, 5, "Expected Boolean type (5)");
    });
});
