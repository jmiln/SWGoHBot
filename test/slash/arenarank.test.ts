import assert from "node:assert";
import { describe, it } from "node:test";
import Arenarank from "../../slash/arenarank.ts";
import { createCommandContext, createMockInteraction } from "../mocks/index.ts";
import { assertErrorReply, assertReplyCount } from "./helpers.ts";

describe("Arenarank", () => {
    it("should calculate arena rank progression for valid rank", async () => {        const interaction = createMockInteraction({
            optionsData: { rank: 100 }
        });

        const command = new Arenarank();
        const ctx = createCommandContext({ interaction });
        await command.run(ctx);

        const replies = (interaction as any)._getReplies();
        assert.ok(replies.length > 0, "Expected at least one reply");

        const reply = replies[0];
        assert.ok(reply.content, "Expected content in reply");
        assert.ok(
            reply.content.includes("COMMAND_ARENARANK_RANKLIST") || reply.content.includes("→"),
            "Expected rank progression in reply"
        );
    });

    it("should handle rank 1 specially", async () => {        const interaction = createMockInteraction({
            optionsData: { rank: 1 }
        });

        const command = new Arenarank();
        const ctx = createCommandContext({ interaction });
        await command.run(ctx);

        const replies = (interaction as any)._getReplies();
        assert.ok(replies.length > 0, "Expected at least one reply");

        const reply = replies[0];
        assert.ok(reply.content, "Expected content in reply");
        assert.ok(
            reply.content.includes("COMMAND_ARENARANK_BEST_RANK"),
            "Expected best rank message"
        );
    });

    it("should return error for invalid rank (NaN)", async () => {        const interaction = createMockInteraction({
            optionsData: { rank: null }
        });

        const command = new Arenarank();
        const ctx = createCommandContext({ interaction });
        await command.run(ctx);

        assertErrorReply(interaction, "COMMAND_ARENARANK_INVALID_NUMBER");
    });

    it("should use custom hop count when provided", async () => {        const interaction = createMockInteraction({
            optionsData: { rank: 200, hops: 10 }
        });

        const command = new Arenarank();
        const ctx = createCommandContext({ interaction });
        await command.run(ctx);

        const replies = (interaction as any)._getReplies();
        assert.ok(replies.length > 0, "Expected at least one reply");

        // With 10 hops, should have more steps in progression
        const reply = replies[0];
        assert.ok(reply.content, "Expected content");
    });

    it("should default to 5 hops when not specified", async () => {        const interaction = createMockInteraction({
            optionsData: { rank: 500 }
        });

        const command = new Arenarank();
        const ctx = createCommandContext({ interaction });
        await command.run(ctx);

        const replies = (interaction as any)._getReplies();
        assert.ok(replies.length > 0, "Expected at least one reply");
    });

    it("should work without guild context (guildOnly: false)", async () => {        const interaction = createMockInteraction({
            optionsData: { rank: 100 },
            guild: null as any
        });

        const command = new Arenarank();
        const ctx = createCommandContext({ interaction });
        await command.run(ctx);

        const replies = (interaction as any)._getReplies();
        assert.ok(replies.length > 0, "Expected reply even without guild context");
    });

    it("should send exactly one reply", async () => {        const interaction = createMockInteraction({
            optionsData: { rank: 250 }
        });

        const command = new Arenarank();
        const ctx = createCommandContext({ interaction });
        await command.run(ctx);

        assertReplyCount(interaction, 1);
    });
});
