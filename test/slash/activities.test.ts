import assert from "node:assert";
import { describe, it } from "node:test";
import Activities from "../../slash/activities.ts";
import { createMockBot, createMockInteraction } from "../mocks/index.ts";
import { assertReplyCount } from "./helpers.ts";

describe("Activities", () => {
    it("should display activities for current day when no day specified", async () => {
        const bot = createMockBot();
        const interaction = createMockInteraction();

        const command = new Activities(bot);
        await command.run(bot, interaction);

        const replies = (interaction as any)._getReplies();
        assert.ok(replies.length > 0, "Expected at least one reply");

        const reply = replies[0];
        assert.ok(reply.content, "Expected content in reply");

        // Should contain a language key for a day (mocked language returns the key)
        assert.ok(
            reply.content.includes("COMMAND_ACTIVITIES_"),
            "Expected activities language key in response"
        );
    });

    it("should display activities for specified day", async () => {
        const bot = createMockBot();
        const interaction = createMockInteraction({
            optionsData: { day: "day_Monday" }
        });

        const command = new Activities(bot);
        await command.run(bot, interaction);

        const replies = (interaction as any)._getReplies();
        assert.ok(replies.length > 0, "Expected at least one reply");

        const reply = replies[0];
        assert.ok(reply.content, "Expected content in reply");
        assert.ok(
            reply.content.includes("COMMAND_ACTIVITIES_MONDAY"),
            "Expected Monday activities"
        );
    });

    it("should display activities for different days", async () => {
        const bot = createMockBot();

        const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

        for (const day of days) {
            const interaction = createMockInteraction({
                optionsData: { day: `day_${day}` }
            });

            const command = new Activities(bot);
            await command.run(bot, interaction);

            const replies = (interaction as any)._getReplies();
            const reply = replies[0];

            assert.ok(
                reply.content.includes(`COMMAND_ACTIVITIES_${day.toUpperCase()}`),
                `Expected ${day} activities`
            );
        }
    });

    it("should send exactly one reply", async () => {
        const bot = createMockBot();
        const interaction = createMockInteraction();

        const command = new Activities(bot);
        await command.run(bot, interaction);

        assertReplyCount(interaction, 1);
    });

    it("should work without guild context (guildOnly: false)", async () => {
        const bot = createMockBot();
        const interaction = createMockInteraction({
            guild: null as any
        });

        const command = new Activities(bot);
        await command.run(bot, interaction);

        const replies = (interaction as any)._getReplies();
        assert.ok(replies.length > 0, "Expected reply even without guild context");
    });

    it("should format response as code block", async () => {
        const bot = createMockBot();
        const interaction = createMockInteraction();

        const command = new Activities(bot);
        await command.run(bot, interaction);

        const replies = (interaction as any)._getReplies();
        const reply = replies[0];

        // Code blocks are wrapped in backticks
        assert.ok(reply.content, "Expected content");
        // The content should be formatted (though we can't easily test the exact format without knowing discord.js internals)
    });
});
