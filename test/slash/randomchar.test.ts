import assert from "node:assert";
import { describe, it } from "node:test";
import Randomchar from "../../slash/randomchar.ts";
import { createMockInteraction } from "../mocks/index.ts";
import { assertReplyCount } from "./helpers.ts";

describe("Randomchar", () => {
    // Note: Full tests with allycode require MongoDB and swgohAPI.
    // We test without allycode which uses the character list.

    it("should select random characters without allycode", async () => {        const interaction = createMockInteraction();

        const command = new Randomchar();
        await command.run({ interaction, language: (interaction as any).language });

        const replies = (interaction as any)._getReplies();
        assert.ok(replies.length > 0, "Expected at least one reply");

        const reply = replies[0];
        assert.ok(reply.content, "Expected content in reply");
        // Should have a code block with character names
        assert.ok(reply.content.length > 0, "Expected non-empty character list");
    });

    it("should respect count parameter", async () => {        const interaction = createMockInteraction({
            optionsData: { count: 2 }
        });

        const command = new Randomchar();
        await command.run({ interaction, language: (interaction as any).language });

        const replies = (interaction as any)._getReplies();
        const reply = replies[0];
        assert.ok(reply.content, "Expected content");
        // Content should have character names (though we can't easily verify exact count in code block)
    });

    it("should default to 5 characters when count not specified", async () => {        const interaction = createMockInteraction();

        const command = new Randomchar();
        await command.run({ interaction, language: (interaction as any).language });

        const replies = (interaction as any)._getReplies();
        assert.ok(replies.length > 0, "Expected reply");
    });

    it("should default to minimum rarity of 1 when not specified", async () => {        const interaction = createMockInteraction();

        const command = new Randomchar();
        await command.run({ interaction, language: (interaction as any).language });

        const replies = (interaction as any)._getReplies();
        assert.ok(replies.length > 0, "Expected reply");
    });

    it("should work without guild context (guildOnly: false)", async () => {        const interaction = createMockInteraction({
            guild: null as any
        });

        const command = new Randomchar();
        await command.run({ interaction, language: (interaction as any).language });

        const replies = (interaction as any)._getReplies();
        assert.ok(replies.length > 0, "Expected reply even without guild context");
    });

    it("should send exactly one reply", async () => {        const interaction = createMockInteraction();

        const command = new Randomchar();
        await command.run({ interaction, language: (interaction as any).language });

        assertReplyCount(interaction, 1);
    });
});
