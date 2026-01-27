import assert from "node:assert";
import { describe, it } from "node:test";
import MyProfile from "../../slash/myprofile.ts";
import { createMockBot } from "../mocks/index.ts";

describe("MyProfile", () => {
    // Note: Full myprofile tests require MongoDB, user registration, and swgohAPI.
    // We test command configuration only.

    it("should work without guild context (guildOnly: false)", () => {
        const bot = createMockBot();
        const command = new MyProfile(bot);

        assert.strictEqual(command.commandData.guildOnly, false, "Expected guildOnly to be false");
    });

    it("should have correct command configuration", () => {
        const bot = createMockBot();
        const command = new MyProfile(bot);

        assert.strictEqual(command.commandData.name, "myprofile", "Expected command name to be 'myprofile'");
        assert.strictEqual(command.commandData.guildOnly, false, "Expected guildOnly to be false");
        assert.ok(command.commandData.options, "Expected options to be defined");
        assert.strictEqual(command.commandData.options.length, 1, "Expected 1 option");

        const allycodeOpt = command.commandData.options.find(o => o.name === "allycode");
        assert.ok(allycodeOpt, "Expected allycode option");
        assert.strictEqual(allycodeOpt.required, undefined, "Expected allycode to be optional");
    });

    it("should have description", () => {
        const bot = createMockBot();
        const command = new MyProfile(bot);

        assert.ok(command.commandData.description, "Expected command to have description");
        assert.ok(command.commandData.description.length > 0, "Expected non-empty description");
    });
});
