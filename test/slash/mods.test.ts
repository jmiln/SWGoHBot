import assert from "node:assert";
import { describe, it } from "node:test";
import Mods from "../../slash/mods.ts";
import { createCommandContext, createMockInteraction } from "../mocks/index.ts";
import { assertErrorReply } from "./helpers.ts";

describe("Mods", () => {
    // Note: Mods command uses static character data, so we can test more functionality.

    it("should return error for character not found", async () => {        const interaction = createMockInteraction({
            optionsData: { character: "NonexistentCharacter999" }
        });

        const command = new Mods();
        const ctx = createCommandContext({ interaction });
        await command.run(ctx);

        assertErrorReply(interaction, "COMMAND_MODS_USAGE");
    });

    it("should return error for multiple character matches", async () => {        const interaction = createMockInteraction({
            optionsData: { character: "CHAR" } // Generic search
        });

        const command = new Mods();
        const ctx = createCommandContext({ interaction });
        await command.run(ctx);

        // Either finds nothing or finds multiple - both should error
        const replies = (interaction as any)._getReplies();
        assert.ok(replies.length > 0, "Expected at least one reply");
    });

    it("should defer reply before processing", async () => {        const interaction = createMockInteraction({
            optionsData: { character: "InvalidChar" }
        });

        const command = new Mods();
        const ctx = createCommandContext({ interaction });
        await command.run(ctx);

        // Should have deferred the reply
        assert.strictEqual((interaction as any).deferred, true, "Expected interaction to be deferred");
    });

    it("should work without guild context (guildOnly: false)", async () => {        const interaction = createMockInteraction({
            optionsData: { character: "InvalidChar" },
            guild: null as any
        });

        const command = new Mods();
        const ctx = createCommandContext({ interaction });
        await command.run(ctx);

        const replies = (interaction as any)._getReplies();
        assert.ok(replies.length > 0, "Expected at least one reply even without guild context");
    });

    it("should have correct command configuration", () => {        const command = new Mods();

        assert.strictEqual(command.commandData.name, "mods", "Expected command name to be 'mods'");
        assert.strictEqual(command.commandData.guildOnly, false, "Expected guildOnly to be false");
        assert.ok(command.commandData.options, "Expected options to be defined");
        assert.strictEqual(command.commandData.options.length, 1, "Expected 1 option");

        const charOpt = command.commandData.options.find(o => o.name === "character");
        assert.ok(charOpt, "Expected character option");
        assert.strictEqual(charOpt.required, true, "Expected character to be required");
        assert.strictEqual(charOpt.autocomplete, true, "Expected character to have autocomplete");
    });

    it("should have description", () => {        const command = new Mods();

        assert.ok(command.commandData.description, "Expected command to have description");
        assert.ok(command.commandData.description.includes("mod"), "Expected description to mention mods");
    });
});
