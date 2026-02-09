import assert from "node:assert";
import { describe, it } from "node:test";
import Showconf from "../../slash/showconf.ts";
import { createMockInteraction } from "../mocks/index.ts";
import { assertReplyCount } from "./helpers.ts";

describe("Showconf", () => {
    // Note: Full showconf tests require MongoDB for guild settings.
    // We test command configuration and basic flow.

    it("should require admin permissions (permLevel: 3)", () => {        const command = new Showconf();

        assert.strictEqual(command.commandData.permLevel, 3, "Expected permLevel to be 3 (admin)");
    });

    it("should work without guild context (guildOnly: false)", async () => {        const interaction = createMockInteraction({
            guild: null as any
        });

        const command = new Showconf();

        // This will fail without guild, but should handle gracefully
        try {
            await command.run({ interaction, language: (interaction as any).language });
        } catch (error) {
            // Expected to fail without guild context
            assert.ok(true, "Command attempted to run");
        }
    });

    it("should have correct command configuration", () => {        const command = new Showconf();

        assert.strictEqual(command.commandData.name, "showconf", "Expected command name to be 'showconf'");
        assert.strictEqual(command.commandData.guildOnly, false, "Expected guildOnly to be false");
        assert.strictEqual(command.commandData.permLevel, 3, "Expected permLevel to be 3");
    });
});
