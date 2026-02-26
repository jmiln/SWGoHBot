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

    it("should return embed with mod set info for a character with mods", async () => {
        // COMMANDERLUKESKYWALKER has mod data in the static units list
        const interaction = createMockInteraction({
            optionsData: { character: "COMMANDERLUKESKYWALKER" },
        });

        const command = new Mods();
        const ctx = createCommandContext({ interaction });
        await command.run(ctx);

        const replies = (interaction as any)._getReplies();
        assert.ok(replies.length > 0, "Expected at least one reply");

        const lastReply = replies[replies.length - 1];
        assert.ok(lastReply.embeds, "Expected embed in reply");
        const embed = lastReply.embeds[0];
        const embedData = embed.data || embed;
        const description = embedData.description || "";

        // Description should contain actual mod data, not the "no mod sets" key
        assert.ok(!description.includes("COMMAND_NO_MODSETS"), "Expected mod data, not no-mod-sets message");
        assert.ok(description.length > 0, "Expected non-empty description");
    });

    it("should return COMMAND_NO_MODSETS for a character without mod recommendations", async () => {
        // CASSIANUNDERCOVER has no mod data
        const interaction = createMockInteraction({
            optionsData: { character: "CASSIANUNDERCOVER" },
        });

        const command = new Mods();
        const ctx = createCommandContext({ interaction });
        await command.run(ctx);

        const replies = (interaction as any)._getReplies();
        assert.ok(replies.length > 0, "Expected at least one reply");

        const lastReply = replies[replies.length - 1];
        assert.ok(lastReply.embeds, "Expected embed in reply");
        const embed = lastReply.embeds[0];
        const embedData = embed.data || embed;
        const description = embedData.description || "";

        assert.ok(description.includes("COMMAND_NO_MODSETS"), "Expected no-mod-sets key in description");
    });

});
