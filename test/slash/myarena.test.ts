import assert from "node:assert";
import { describe, it } from "node:test";
import MyArena from "../../slash/myarena.ts";

describe("MyArena", () => {
    // Note: Full myarena tests require MongoDB, user registration, and swgohAPI.
    // We test command configuration only.

    it("should work without guild context (guildOnly: false)", () => {        const command = new MyArena();

        assert.strictEqual(command.commandData.guildOnly, false, "Expected guildOnly to be false");
    });

    it("should have correct command configuration", () => {        const command = new MyArena();

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

    it("should have description", () => {        const command = new MyArena();

        assert.ok(command.commandData.description, "Expected command to have description");
        assert.ok(command.commandData.description.length > 0, "Expected non-empty description");
    });

    it("should have stats option as boolean type", () => {        const command = new MyArena();

        const statsOpt = command.commandData.options.find(o => o.name === "stats");
        assert.ok(statsOpt, "Expected stats option");
        assert.strictEqual(statsOpt.type, 5, "Expected Boolean type (5)");
    });
});
