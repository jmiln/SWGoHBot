import assert from "node:assert";
import { describe, it } from "node:test";
import Info from "../../slash/info.ts";
import { createMockBot, createMockInteraction } from "../mocks/index.ts";
import { assertReplyCount } from "./helpers.ts";

describe("Info", () => {
    it("should display bot information and stats", async () => {
        const bot = createMockBot();
        const interaction = createMockInteraction();

        const command = new Info(bot);
        await command.run(bot, interaction);

        const replies = (interaction as any)._getReplies();
        assert.ok(replies.length > 0, "Expected at least one reply");

        const reply = replies[0];
        assert.ok(reply.embeds, "Expected embed reply");

        const embed = reply.embeds[0];
        assert.ok(embed.author, "Expected author in embed");
        assert.ok(embed.description, "Expected description with stats");

        // The description should be a code block containing stats
        const description = embed.description || "";
        assert.ok(description.length > 0, "Expected non-empty description");
    });

    it("should include links in embed fields", async () => {
        const bot = createMockBot();
        const interaction = createMockInteraction();

        const command = new Info(bot);
        await command.run(bot, interaction);

        const replies = (interaction as any)._getReplies();
        const embed = replies[0].embeds[0];

        // The info command adds links as fields from content.links
        // Mock language.get("COMMAND_INFO_OUTPUT") returns an object
        assert.ok(embed.fields !== undefined, "Expected fields in embed");
    });

    it("should work without guild context (guildOnly: false)", async () => {
        const bot = createMockBot();
        const interaction = createMockInteraction({
            guild: null as any
        });

        const command = new Info(bot);
        await command.run(bot, interaction);

        const replies = (interaction as any)._getReplies();
        assert.ok(replies.length > 0, "Expected reply even without guild context");
    });

    it("should send exactly one reply", async () => {
        const bot = createMockBot();
        const interaction = createMockInteraction();

        const command = new Info(bot);
        await command.run(bot, interaction);

        assertReplyCount(interaction, 1);
    });

    it("should have a random color for the embed", async () => {
        const bot = createMockBot();
        const interaction = createMockInteraction();

        const command = new Info(bot);
        await command.run(bot, interaction);

        const replies = (interaction as any)._getReplies();
        const embed = replies[0].embeds[0];

        // Color should be a number (random color)
        assert.ok(typeof embed.color === "number", "Expected numeric color");
        assert.ok(embed.color >= 0 && embed.color <= 0xffffff, "Expected valid color range");
    });
});
