import assert from "node:assert";
import { describe, it } from "node:test";
import Register from "../../slash/register.ts";

describe("Register", () => {
    // Note: Full register tests require MongoDB and swgohAPI.
    // We test command configuration and validation logic only.

    it("should work without guild context (guildOnly: false)", () => {        const command = new Register();

        assert.strictEqual(command.commandData.guildOnly, false, "Expected guildOnly to be false");
    });

    it("should be enabled", () => {        const command = new Register();

        assert.strictEqual(command.commandData.enabled, true, "Expected command to be enabled");
    });

    it("should have correct command configuration", () => {        const command = new Register();

        assert.strictEqual(command.commandData.name, "register", "Expected command name to be 'register'");
        assert.strictEqual(command.commandData.guildOnly, false, "Expected guildOnly to be false");
        assert.ok(command.commandData.options, "Expected options to be defined");
    });

    it("should have required allycode option", () => {        const command = new Register();

        const allycodeOpt = command.commandData.options.find(o => o.name === "allycode");
        assert.ok(allycodeOpt, "Expected allycode option");
        assert.strictEqual(allycodeOpt.required, true, "Expected allycode to be required");
    });

    it("should have optional user option for admin registration", () => {        const command = new Register();

        const userOpt = command.commandData.options.find(o => o.name === "user");
        assert.ok(userOpt, "Expected user option");
        assert.strictEqual(userOpt.required, undefined, "Expected user to be optional (required not set)");
    });

    it("should have exactly 2 options (allycode and user)", () => {        const command = new Register();

        assert.strictEqual(command.commandData.options.length, 2, "Expected exactly 2 options");

        const allycodeOpt = command.commandData.options.find(o => o.name === "allycode");
        const userOpt = command.commandData.options.find(o => o.name === "user");

        assert.ok(allycodeOpt, "Expected allycode option");
        assert.ok(userOpt, "Expected user option");
    });
});
