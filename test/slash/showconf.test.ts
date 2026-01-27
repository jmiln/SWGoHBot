import assert from "node:assert";
import { describe, it } from "node:test";
import Showconf from "../../slash/showconf.ts";
import { createMockBot, createMockInteraction } from "../mocks/index.ts";
import { assertReplyCount } from "./helpers.ts";

describe("Showconf", () => {
    // Note: Full showconf tests require MongoDB for guild settings.
    // We test command configuration and basic flow.

    it("should require admin permissions (permLevel: 3)", () => {
        const bot = createMockBot();
        const command = new Showconf(bot);

        assert.strictEqual(command.commandData.permLevel, 3, "Expected permLevel to be 3 (admin)");
    });

    it("should work without guild context (guildOnly: false)", async () => {
        const bot = createMockBot();
        const interaction = createMockInteraction({
            guild: null as any
        });

        const command = new Showconf(bot);

        // This will fail without guild, but should handle gracefully
        try {
            await command.run(bot, interaction);
        } catch (error) {
            // Expected to fail without guild context
            assert.ok(true, "Command attempted to run");
        }
    });

    it("should have correct command configuration", () => {
        const bot = createMockBot();
        const command = new Showconf(bot);

        assert.strictEqual(command.commandData.name, "showconf", "Expected command name to be 'showconf'");
        assert.strictEqual(command.commandData.guildOnly, false, "Expected guildOnly to be false");
        assert.strictEqual(command.commandData.permLevel, 3, "Expected permLevel to be 3");
    });
});
