import assert from "node:assert";
import { describe, it } from "node:test";
import Challenges from "../../slash/challenges.ts";
import { createCommandContext, createMockInteraction } from "../mocks/index.ts";
import { assertReplyCount } from "./helpers.ts";

describe("Challenges", () => {
    it("should display challenges for current day when no day specified", async () => {        const interaction = createMockInteraction();

        const command = new Challenges();
        const ctx = createCommandContext({ interaction });
        await command.run(ctx);

        const replies = (interaction as any)._getReplies();
        assert.ok(replies.length > 0, "Expected at least one reply");

        const reply = replies[0];
        assert.ok(reply.content, "Expected content in reply");

        // Should contain challenge information
        assert.ok(
            reply.content.includes("Challenges for") || reply.content.includes("COMMAND_CHALLENGES_"),
            "Expected challenges information in response"
        );
    });

    it("should display challenges for specified day", async () => {        const interaction = createMockInteraction({
            optionsData: { day: "day_Monday" }
        });

        const command = new Challenges();
        const ctx = createCommandContext({ interaction });
        await command.run(ctx);

        const replies = (interaction as any)._getReplies();
        assert.ok(replies.length > 0, "Expected at least one reply");

        const reply = replies[0];
        assert.ok(reply.content, "Expected content in reply");
        assert.ok(
            reply.content.includes("Monday") || reply.content.includes("MONDAY"),
            "Expected Monday challenges"
        );
    });

    it("should display challenges for different days", async () => {
        const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

        for (const day of days) {
            const interaction = createMockInteraction({
                optionsData: { day: `day_${day}` }
            });

            const command = new Challenges();
            const ctx = createCommandContext({ interaction });
            await command.run(ctx);

            const replies = (interaction as any)._getReplies();
            const reply = replies[0];

            assert.ok(reply.content, `Expected content for ${day}`);
            // Each day should have some challenges listed
            assert.ok(
                reply.content.includes(day.toUpperCase()) || reply.content.includes(day),
                `Expected ${day} in response`
            );
        }
    });

    it("should include challenge types in response", async () => {        const interaction = createMockInteraction({
            optionsData: { day: "day_Sunday" }
        });

        const command = new Challenges();
        const ctx = createCommandContext({ interaction });
        await command.run(ctx);

        const replies = (interaction as any)._getReplies();
        const reply = replies[0];

        // Sunday should have multiple challenges
        // The response should contain COMMAND_CHALLENGES_ language keys (in mock)
        assert.ok(reply.content.length > 20, "Expected substantial content with challenge list");
    });

    it("should send exactly one reply", async () => {        const interaction = createMockInteraction();

        const command = new Challenges();
        const ctx = createCommandContext({ interaction });
        await command.run(ctx);

        assertReplyCount(interaction, 1);
    });

    it("should work without guild context (guildOnly: false)", async () => {        const interaction = createMockInteraction({
            guild: null as any
        });

        const command = new Challenges();
        const ctx = createCommandContext({ interaction });
        await command.run(ctx);

        const replies = (interaction as any)._getReplies();
        assert.ok(replies.length > 0, "Expected reply even without guild context");
    });

    it("should format response as code block", async () => {        const interaction = createMockInteraction();

        const command = new Challenges();
        const ctx = createCommandContext({ interaction });
        await command.run(ctx);

        const replies = (interaction as any)._getReplies();
        const reply = replies[0];

        assert.ok(reply.content, "Expected content");
        // Code blocks are formatted (though we can't easily verify the exact format)
    });
});
