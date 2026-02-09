import assert from "node:assert";
import { describe, it } from "node:test";
import MyProfile from "../../slash/myprofile.ts";

describe("MyProfile", () => {
    // Note: Full myprofile tests require MongoDB, user registration, and swgohAPI.
    // We test command configuration only.

    it("should work without guild context (guildOnly: false)", () => {        const command = new MyProfile();

        assert.strictEqual(command.commandData.guildOnly, false, "Expected guildOnly to be false");
    });

    it("should have correct command configuration", () => {        const command = new MyProfile();

        assert.strictEqual(command.commandData.name, "myprofile", "Expected command name to be 'myprofile'");
        assert.strictEqual(command.commandData.guildOnly, false, "Expected guildOnly to be false");
        assert.ok(command.commandData.options, "Expected options to be defined");
        assert.strictEqual(command.commandData.options.length, 1, "Expected 1 option");

        const allycodeOpt = command.commandData.options.find(o => o.name === "allycode");
        assert.ok(allycodeOpt, "Expected allycode option");
        assert.strictEqual(allycodeOpt.required, undefined, "Expected allycode to be optional");
    });

    it("should have description", () => {        const command = new MyProfile();

        assert.ok(command.commandData.description, "Expected command to have description");
        assert.ok(command.commandData.description.length > 0, "Expected non-empty description");
    });
});
