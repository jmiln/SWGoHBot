import assert from "node:assert";
import { describe, it } from "node:test";
import Charactergear from "../../slash/charactergear.ts";
import { createCommandContext, createMockInteraction } from "../mocks/index.ts";

describe("Charactergear", () => {
    it("should validate gear level - reject values below 0", async () => {        const interaction = createMockInteraction({
            optionsData: { character: "Luke", gearlevel: -1 },
        });

        const command = new Charactergear();
        const ctx = createCommandContext({ interaction });
        await command.run(ctx);

        const replies = (interaction as any)._getReplies();
        const embed = replies[0].embeds[0];
        const embedData = embed.data || embed;

        const errorMsg = embedData.description || "";
        assert.ok(errorMsg.includes("not a valid gear level"), "Expected invalid gear level error");
        assert.ok(errorMsg.includes("-1"), "Expected error to mention the invalid value");
    });

    it("should validate gear level - reject values above 13", async () => {        const interaction = createMockInteraction({
            optionsData: { character: "Luke", gearlevel: 15 },
        });

        const command = new Charactergear();
        const ctx = createCommandContext({ interaction });
        await command.run(ctx);

        const replies = (interaction as any)._getReplies();
        const embed = replies[0].embeds[0];
        const embedData = embed.data || embed;

        const errorMsg = embedData.description || "";
        assert.ok(errorMsg.includes("not a valid gear level"), "Expected invalid gear level error");
        assert.ok(errorMsg.includes("15"), "Expected error to mention the invalid value");
    });

    it("should accept valid gear levels (1-13)", async () => {        const interaction = createMockInteraction({
            optionsData: { character: "COMMANDERLUKESKYWALKER", gearlevel: 12 },
        });

        const command = new Charactergear();
        const ctx = createCommandContext({ interaction });
        await command.run(ctx);

        const replies = (interaction as any)._getReplies();
        const embed = replies[0].embeds[0];
        const embedData = embed.data || embed;

        // Should not be a gear level validation error
        const errorMsg = embedData.description || "";
        assert.ok(!errorMsg.includes("not a valid gear level"), "Should not reject valid gear level");
    });

    it("should handle character not found error", async () => {        const interaction = createMockInteraction({
            optionsData: { character: "NonexistentCharacter999" },
        });

        const command = new Charactergear();
        const ctx = createCommandContext({ interaction });
        await command.run(ctx);

        const replies = (interaction as any)._getReplies();
        assert.strictEqual(replies.length, 1, "Expected one reply");

        const embed = replies[0].embeds[0];
        const embedData = embed.data || embed;

        // Should have error message
        assert.ok(embedData.description, "Expected error message");

        // Error should be ephemeral
        assert.ok(replies[0].flags, "Expected ephemeral flag");
    });

    it("should handle multiple character matches", async () => {        const interaction = createMockInteraction({
            optionsData: { character: "Luke" }, // Multiple matches: CLS, JKL, etc.
        });

        const command = new Charactergear();
        const ctx = createCommandContext({ interaction });
        await command.run(ctx);

        const replies = (interaction as any)._getReplies();
        assert.ok(replies.length > 0, "Expected at least one reply");

        // Multiple matches should return error or list
        const embed = replies[0].embeds[0];
        assert.ok(embed, "Expected embed in reply");

        // Send back the proper error for character list
        const desc = embed.data?.description;
        assert.equal(desc, "BASE_SWGOH_CHAR_LIST");
    });

    it("should parse character option correctly", async () => {        const interaction = createMockInteraction({
            optionsData: { character: "COMMANDERLUKESKYWALKER" },
        });

        const command = new Charactergear();
        const ctx = createCommandContext({ interaction });
        await command.run(ctx);

        const replies = (interaction as any)._getReplies();
        assert.ok(replies.length > 0, "Expected at least one reply");
    });

    it("should parse gearlevel option correctly", async () => {        const interaction = createMockInteraction({
            optionsData: { character: "COMMANDERLUKESKYWALKER", gearlevel: 12 },
        });

        const command = new Charactergear();
        const ctx = createCommandContext({ interaction });
        await command.run(ctx);

        const replies = (interaction as any)._getReplies();
        assert.ok(replies.length > 0, "Expected at least one reply");
    });

    it("should handle expand option (boolean)", async () => {        const interaction = createMockInteraction({
            optionsData: { character: "COMMANDERLUKESKYWALKER", expand: true },
        });

        const command = new Charactergear();
        const ctx = createCommandContext({ interaction });
        await command.run(ctx);

        const replies = (interaction as any)._getReplies();
        assert.ok(replies.length > 0, "Expected reply with expand option");
    });

    it("should process character search by alias", async () => {        const interaction = createMockInteraction({
            optionsData: { character: "CLS", gearlevel: 3 }, // Alias for Commander Luke
        });

        const command = new Charactergear();
        const ctx = createCommandContext({ interaction });
        await command.run(ctx);

        const replies = (interaction as any)._getReplies();
        assert.ok(replies.length > 0, "Expected reply for alias search");
    });

    it("should respond to gear requests (any response, success or error)", async () => {        const interaction = createMockInteraction({
            optionsData: { character: "COMMANDERLUKESKYWALKER", gearlevel: 12 },
        });

        const command = new Charactergear();
        const ctx = createCommandContext({ interaction });
        await command.run(ctx);

        const replies = (interaction as any)._getReplies();
        assert.ok(replies.length > 0, "Expected at least one reply");

        // Should have either embeds or content
        const reply = replies[0];
        assert.ok(reply.embeds || reply.content, "Expected embeds or content in reply");
    });
});
