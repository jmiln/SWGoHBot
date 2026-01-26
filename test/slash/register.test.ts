import { describe, it } from "node:test";
import assert from "node:assert";
import { createMockBot } from "../mocks/index.ts";
import Register from "../../slash/register.ts";

describe("Register", () => {
    // Note: Full register tests require MongoDB and swgohAPI.
    // We test command configuration and validation logic only.

    it("should work without guild context (guildOnly: false)", () => {
        const bot = createMockBot();
        const command = new Register(bot);

        assert.strictEqual(command.commandData.guildOnly, false, "Expected guildOnly to be false");
    });

    it("should be enabled", () => {
        const bot = createMockBot();
        const command = new Register(bot);

        assert.strictEqual(command.commandData.enabled, true, "Expected command to be enabled");
    });

    it("should have correct command configuration", () => {
        const bot = createMockBot();
        const command = new Register(bot);

        assert.strictEqual(command.commandData.name, "register", "Expected command name to be 'register'");
        assert.strictEqual(command.commandData.guildOnly, false, "Expected guildOnly to be false");
        assert.ok(command.commandData.options, "Expected options to be defined");
    });

    it("should have required allycode option", () => {
        const bot = createMockBot();
        const command = new Register(bot);

        const allycodeOpt = command.commandData.options.find(o => o.name === "allycode");
        assert.ok(allycodeOpt, "Expected allycode option");
        assert.strictEqual(allycodeOpt.required, true, "Expected allycode to be required");
    });

    it("should have optional user option for admin registration", () => {
        const bot = createMockBot();
        const command = new Register(bot);

        const userOpt = command.commandData.options.find(o => o.name === "user");
        assert.ok(userOpt, "Expected user option");
        assert.strictEqual(userOpt.required, undefined, "Expected user to be optional (required not set)");
    });

    it("should have exactly 2 options (allycode and user)", () => {
        const bot = createMockBot();
        const command = new Register(bot);

        assert.strictEqual(command.commandData.options.length, 2, "Expected exactly 2 options");

        const allycodeOpt = command.commandData.options.find(o => o.name === "allycode");
        const userOpt = command.commandData.options.find(o => o.name === "user");

        assert.ok(allycodeOpt, "Expected allycode option");
        assert.ok(userOpt, "Expected user option");
    });
});
