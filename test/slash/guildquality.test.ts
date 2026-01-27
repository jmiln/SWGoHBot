import assert from "node:assert";
import { describe, it } from "node:test";
import GuildQuality from "../../slash/guildquality.ts";
import { createMockBot } from "../mocks/index.ts";

describe("GuildQuality", () => {
    // Note: Full guildquality tests require MongoDB, guild data, and swgohAPI.
    // We test command configuration only.

    it("should work without guild context (guildOnly: false)", () => {
        const bot = createMockBot();
        const command = new GuildQuality(bot);

        assert.strictEqual(command.commandData.guildOnly, false, "Expected guildOnly to be false");
    });

    it("should have correct command configuration", () => {
        const bot = createMockBot();
        const command = new GuildQuality(bot);

        assert.strictEqual(command.commandData.name, "guildquality", "Expected command name to be 'guildquality'");
        assert.strictEqual(command.commandData.guildOnly, false, "Expected guildOnly to be false");
        assert.ok(command.commandData.options, "Expected options to be defined");
        assert.strictEqual(command.commandData.options.length, 1, "Expected 1 option");
    });

    it("should have optional allycode option", () => {
        const bot = createMockBot();
        const command = new GuildQuality(bot);

        const allycodeOpt = command.commandData.options.find(o => o.name === "allycode");
        assert.ok(allycodeOpt, "Expected allycode option");
        assert.strictEqual(allycodeOpt.required, undefined, "Expected allycode to be optional");
        assert.strictEqual(allycodeOpt.type, 3, "Expected String type (3)");
    });
});
