import assert from "node:assert";
import { describe, it } from "node:test";
import { createMockInteraction } from "./index.ts";

describe("Mock Verification", () => {
    it("createMockInteraction returns comprehensive Interaction object", async () => {
        const interaction = createMockInteraction({
            optionsData: {
                character: "vader",
                limit: 10,
                verbose: true
            }
        });

        // Verify Discord properties
        assert.ok(interaction.user);
        assert.ok(interaction.guild);
        assert.ok(interaction.member);
        assert.ok(interaction.client);
        assert.strictEqual(interaction.channelId, "123");
        assert.strictEqual(interaction.commandName, "test");

        // Verify options work
        assert.strictEqual(interaction.options.getString("character"), "vader");
        assert.strictEqual(interaction.options.getInteger("limit"), 10);
        assert.strictEqual(interaction.options.getBoolean("verbose"), true);

        // Verify state tracking
        assert.strictEqual(interaction.deferred, false);
        assert.strictEqual(interaction.replied, false);

        await interaction.deferReply();
        assert.strictEqual(interaction.deferred, true);

        await interaction.reply("Test response");
        assert.strictEqual(interaction.replied, true);

        const replies = (interaction as any)._getReplies();
        assert.strictEqual(replies.length, 1);
        assert.strictEqual(replies[0], "Test response");
    });

    it("createMockInteraction language mock supports named placeholders", () => {
        const interaction = createMockInteraction();

        // Test numeric placeholders
        const result1 = interaction.language.get("Hello {{0}}, you have {{1}} messages", "User", "5");
        assert.strictEqual(result1, "Hello User, you have 5 messages");

        // Test named placeholders
        const result2 = interaction.language.get("Hello {{name}}, you have {{count}} messages", { name: "User", count: 5 });
        assert.strictEqual(result2, "Hello User, you have 5 messages");

        // Test object returns
        const result3 = interaction.language.get("COMMAND_INFO_OUTPUT");
        assert.strictEqual(typeof result3, "object");
        assert.strictEqual((result3 as any).statHeader, "Stats");
    });

    it("createMockInteraction tracks reply state correctly", async () => {
        const interaction = createMockInteraction();

        await interaction.reply("First reply");
        await interaction.followUp("Follow up message");

        const replies = (interaction as any)._getReplies();
        assert.strictEqual(replies.length, 2);
        assert.strictEqual(replies[0], "First reply");
        assert.strictEqual(replies[1], "Follow up message");

        await interaction.editReply("Edited reply");
        assert.strictEqual(replies[1], "Edited reply");
    });
});
