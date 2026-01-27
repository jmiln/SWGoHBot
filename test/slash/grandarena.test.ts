import assert from "node:assert";
import { describe, it } from "node:test";
import GrandArena from "../../slash/grandarena.ts";
import { createMockBot } from "../mocks/index.ts";

describe("GrandArena", () => {
    // Note: Full grandarena tests require MongoDB and swgohAPI.
    // We test command configuration only.

    it("should work without guild context (guildOnly: false)", () => {
        const bot = createMockBot();
        const command = new GrandArena(bot);

        assert.strictEqual(command.commandData.guildOnly, false, "Expected guildOnly to be false");
    });

    it("should be enabled", () => {
        const bot = createMockBot();
        const command = new GrandArena(bot);

        assert.strictEqual(command.commandData.enabled, true, "Expected command to be enabled");
    });

    it("should have correct command configuration", () => {
        const bot = createMockBot();
        const command = new GrandArena(bot);

        assert.strictEqual(command.commandData.name, "grandarena", "Expected command name to be 'grandarena'");
        assert.strictEqual(command.commandData.guildOnly, false, "Expected guildOnly to be false");
        assert.ok(command.commandData.options, "Expected options to be defined");
        assert.strictEqual(command.commandData.options.length, 4, "Expected 4 options");
    });

    it("should have required allycode_1 option", () => {
        const bot = createMockBot();
        const command = new GrandArena(bot);

        const allycode1Opt = command.commandData.options.find(o => o.name === "allycode_1");
        assert.ok(allycode1Opt, "Expected allycode_1 option");
        assert.strictEqual(allycode1Opt.required, true, "Expected allycode_1 to be required");
    });

    it("should have required allycode_2 option", () => {
        const bot = createMockBot();
        const command = new GrandArena(bot);

        const allycode2Opt = command.commandData.options.find(o => o.name === "allycode_2");
        assert.ok(allycode2Opt, "Expected allycode_2 option");
        assert.strictEqual(allycode2Opt.required, true, "Expected allycode_2 to be required");
    });

    it("should have optional characters option", () => {
        const bot = createMockBot();
        const command = new GrandArena(bot);

        const charactersOpt = command.commandData.options.find(o => o.name === "characters");
        assert.ok(charactersOpt, "Expected characters option");
        assert.strictEqual(charactersOpt.required, undefined, "Expected characters to be optional");
    });

    it("should have optional faction option", () => {
        const bot = createMockBot();
        const command = new GrandArena(bot);

        const factionOpt = command.commandData.options.find(o => o.name === "faction");
        assert.ok(factionOpt, "Expected faction option");
        assert.strictEqual(factionOpt.required, undefined, "Expected faction to be optional");
    });
});
