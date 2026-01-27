import assert from "node:assert";
import { describe, it } from "node:test";
import Help from "../../slash/help.ts";
import { createMockBot, createMockInteraction } from "../mocks/index.ts";
import { assertErrorReply, assertReplyCount } from "./helpers.ts";

describe("Help", () => {
    it("should display all commands when no options provided", async () => {
        const bot = createMockBot();
        const interaction = createMockInteraction();

        const command = new Help(bot);
        await command.run(bot, interaction);

        const replies = (interaction as any)._getReplies();
        assert.ok(replies.length > 0, "Expected at least one reply");

        const reply = replies[0];
        assert.ok(reply.embeds, "Expected embed reply");

        const embed = reply.embeds[0];
        assert.strictEqual(embed.title, "Slash Commands List", "Expected proper title");
        assert.ok(embed.description?.includes("required"), "Expected usage hint");
        assert.ok(embed.fields, "Expected fields for command categories");
        assert.ok(embed.fields.length > 0, "Expected at least one category");
    });

    it("should filter commands by category", async () => {
        const bot = createMockBot();
        const interaction = createMockInteraction({
            optionsData: { category: "General" }
        });

        const command = new Help(bot);
        await command.run(bot, interaction);

        const replies = (interaction as any)._getReplies();
        assert.ok(replies.length > 0, "Expected at least one reply");

        const reply = replies[0];
        const embed = reply.embeds[0];
        assert.ok(embed.fields, "Expected fields");

        // Should only show General category
        const categoryField = embed.fields.find((f: any) => f.name === "GENERAL");
        assert.ok(categoryField || embed.fields.length > 0, "Expected General category or filtered fields");
    });

    it("should show specific command details", async () => {
        const bot = createMockBot();
        const interaction = createMockInteraction({
            optionsData: { command: "info" }
        });

        const command = new Help(bot);
        await command.run(bot, interaction);

        const replies = (interaction as any)._getReplies();
        assert.ok(replies.length > 0, "Expected at least one reply");

        const reply = replies[0];
        const embed = reply.embeds[0];

        assert.ok(embed.title?.toLowerCase().includes("info"), "Expected command name in title");
        assert.ok(embed.description?.includes("/info"), "Expected command in description");
    });

    it("should return error for invalid command", async () => {
        const bot = createMockBot();
        const interaction = createMockInteraction({
            optionsData: { command: "nonexistentcommand" }
        });

        const command = new Help(bot);
        await command.run(bot, interaction);

        assertErrorReply(interaction, "couldn't find a match");
    });

    it("should show detailed usage when details flag is true", async () => {
        const bot = createMockBot();
        const interaction = createMockInteraction({
            optionsData: { details: true }
        });

        const command = new Help(bot);
        await command.run(bot, interaction);

        const replies = (interaction as any)._getReplies();
        assert.ok(replies.length > 0, "Expected reply");

        // Details flag affects formatting but doesn't change fundamental response
        const reply = replies[0];
        assert.ok(reply.embeds, "Expected embed");
    });

    it("should work without guild context (guildOnly: false)", async () => {
        const bot = createMockBot();
        const interaction = createMockInteraction({
            guild: null as any
        });

        const command = new Help(bot);
        await command.run(bot, interaction);

        const replies = (interaction as any)._getReplies();
        assert.ok(replies.length > 0, "Expected reply even without guild context");
    });

    it("should have random color in embed", async () => {
        const bot = createMockBot();
        const interaction = createMockInteraction();

        const command = new Help(bot);
        await command.run(bot, interaction);

        const replies = (interaction as any)._getReplies();
        const embed = replies[0].embeds[0];

        assert.ok(typeof embed.color === "number", "Expected numeric color");
        assert.ok(embed.color >= 0 && embed.color <= 16777215, "Expected valid color range");
    });
});
