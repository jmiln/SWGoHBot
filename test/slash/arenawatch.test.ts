import assert from "node:assert";
import { describe, it } from "node:test";
import ArenaWatch from "../../slash/arenawatch.ts";
import { createMockBot } from "../mocks/index.ts";

describe("ArenaWatch", () => {
    // Note: Full arenawatch tests require MongoDB and Patreon verification.
    // We test command configuration and subcommand structure only.

    it("should work without guild context (guildOnly: false)", () => {
        const bot = createMockBot();
        const command = new ArenaWatch(bot);

        assert.strictEqual(command.commandData.guildOnly, false, "Expected guildOnly to be false");
    });

    it("should be enabled", () => {
        const bot = createMockBot();
        const command = new ArenaWatch(bot);

        assert.strictEqual(command.commandData.enabled, true, "Expected command to be enabled");
    });

    it("should have correct command configuration", () => {
        const bot = createMockBot();
        const command = new ArenaWatch(bot);

        assert.strictEqual(command.commandData.name, "arenawatch", "Expected command name to be 'arenawatch'");
        assert.strictEqual(command.commandData.guildOnly, false, "Expected guildOnly to be false");
        assert.ok(command.commandData.options, "Expected options to be defined");
    });

    it("should have allycode subcommand group", () => {
        const bot = createMockBot();
        const command = new ArenaWatch(bot);

        const allycodeGroup = command.commandData.options.find(o => o.name === "allycode");
        assert.ok(allycodeGroup, "Expected allycode subcommand group");
        assert.strictEqual(allycodeGroup.type, 2, "Expected SubcommandGroup type (2)");
    });

    it("should have add subcommand in allycode group", () => {
        const bot = createMockBot();
        const command = new ArenaWatch(bot);

        const allycodeGroup = command.commandData.options.find(o => o.name === "allycode");
        assert.ok(allycodeGroup.options, "Expected allycode group to have options");

        const addSubcmd = allycodeGroup.options.find(o => o.name === "add");
        assert.ok(addSubcmd, "Expected add subcommand");
        assert.strictEqual(addSubcmd.type, 1, "Expected Subcommand type (1)");
    });
});
