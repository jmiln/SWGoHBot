import assert from "node:assert";
import { describe, it } from "node:test";
import RaidDamage from "../../slash/raiddamage.ts";
import { createCommandContext, createMockInteraction } from "../mocks/index.ts";

describe("RaidDamage", () => {
    it("should convert percentage to damage for Rancor P1", async () => {
        const interaction = createMockInteraction({
            optionsData: { raid: "Rancor", phase: "1", amount: "50%" }
        });

        const command = new RaidDamage();
        const ctx = createCommandContext({ interaction });
        await command.run(ctx);

        const replies = (interaction as any)._getReplies();
        assert.strictEqual(replies.length, 1, "Expected one reply");

        const embed = replies[0].embeds[0];
        const embedData = embed.data || embed;
        assert.ok(embedData.description, "Expected description with damage calculation");
    });

    it("should convert damage to percentage for Sith P3", async () => {
        const interaction = createMockInteraction({
            optionsData: { raid: "Sith", phase: "3", amount: "1000000" }
        });

        const command = new RaidDamage();
        const ctx = createCommandContext({ interaction });
        await command.run(ctx);

        const replies = (interaction as any)._getReplies();
        assert.strictEqual(replies.length, 1, "Expected one reply");

        const embed = replies[0].embeds[0];
        const embedData = embed.data || embed;
        assert.ok(embedData.description, "Expected description with percentage");
    });

    it("should handle HAAT raid phases", async () => {
        const interaction = createMockInteraction({
            optionsData: { raid: "HAAT", phase: "2", amount: "25%" }
        });

        const command = new RaidDamage();
        const ctx = createCommandContext({ interaction });
        await command.run(ctx);

        const replies = (interaction as any)._getReplies();
        assert.ok(replies.length > 0, "Expected reply");

        const embed = replies[0].embeds[0];
        const embedData = embed.data || embed;
        assert.ok(embedData.author, "Expected author header");
    });

    it("should handle Challenge Rancor", async () => {
        const interaction = createMockInteraction({
            optionsData: { raid: "cRancor", phase: "4", amount: "10%" }
        });

        const command = new RaidDamage();
        const ctx = createCommandContext({ interaction });
        await command.run(ctx);

        const replies = (interaction as any)._getReplies();
        assert.ok(replies.length > 0, "Expected reply");

        const embed = replies[0].embeds[0];
        assert.ok(embed, "Expected embed response");
    });

    it("should return error for invalid amount (non-numeric)", async () => {
        const interaction = createMockInteraction({
            optionsData: { raid: "Rancor", phase: "1", amount: "abc" }
        });

        const command = new RaidDamage();
        const ctx = createCommandContext({ interaction });
        await command.run(ctx);

        const replies = (interaction as any)._getReplies();
        assert.strictEqual(replies.length, 1, "Expected error reply");

        const reply = replies[0];
        assert.ok(reply.embeds, "Expected error embed");
        assert.ok(reply.flags, "Expected ephemeral error");
    });


    it("should process damage amount and return formatted output", async () => {
        const interaction = createMockInteraction({
            optionsData: { raid: "Sith", phase: "4", amount: "5000000" }
        });

        const command = new RaidDamage();
        const ctx = createCommandContext({ interaction });
        await command.run(ctx);

        const replies = (interaction as any)._getReplies();
        assert.strictEqual(replies.length, 1, "Expected one reply");

        const embed = replies[0].embeds[0];
        const embedData = embed.data || embed;

        // Verify output structure
        assert.ok(embedData.author, "Expected author header");
        assert.ok(embedData.description, "Expected description with calculation");
        assert.ok(embedData.description.length > 0, "Expected non-empty description");
    });

    it("should process percentage amount and return formatted output", async () => {
        const interaction = createMockInteraction({
            optionsData: { raid: "Rancor", phase: "1", amount: "50%" }
        });

        const command = new RaidDamage();
        const ctx = createCommandContext({ interaction });
        await command.run(ctx);

        const replies = (interaction as any)._getReplies();
        assert.strictEqual(replies.length, 1, "Expected one reply");

        const embed = replies[0].embeds[0];
        const embedData = embed.data || embed;

        // Verify output structure (mock language returns keys)
        assert.ok(embedData.author, "Expected author with raid/phase info");
        assert.ok(embedData.description, "Expected description with damage calculation");
        assert.strictEqual(embedData.description, "COMMAND_RAIDDAMAGE_OUT_PERCENT", "Expected percentage output key");
    });

    it("should process plain damage amount correctly", async () => {
        const interaction = createMockInteraction({
            optionsData: { raid: "HAAT", phase: "2", amount: "1000000" }
        });

        const command = new RaidDamage();
        const ctx = createCommandContext({ interaction });
        await command.run(ctx);

        const replies = (interaction as any)._getReplies();
        assert.strictEqual(replies.length, 1, "Expected one reply");

        const embed = replies[0].embeds[0];
        const embedData = embed.data || embed;

        // Verify damage-to-percentage conversion is attempted
        assert.ok(embedData.description, "Expected description");
        assert.strictEqual(embedData.description, "COMMAND_RAIDDAMAGE_OUT_DMG", "Expected damage output key");
    });
});
