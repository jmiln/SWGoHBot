import assert from "node:assert";
import { describe, it } from "node:test";
import Modsets from "../../slash/modsets.ts";
import { createCommandContext, createMockInteraction } from "../mocks/index.ts";
import { assertReplyCount } from "./helpers.ts";

describe("Modsets", () => {
    it("should display mod set information", async () => {        const interaction = createMockInteraction();

        const command = new Modsets();
        const ctx = createCommandContext({ interaction });
        await command.run(ctx);

        const replies = (interaction as any)._getReplies();
        assert.ok(replies.length > 0, "Expected at least one reply");

        const reply = replies[0];
        assert.ok(reply.content, "Expected content in reply");

        // The modsets command uses language.get("COMMAND_MODSETS_OUTPUT")
        // which returns the key itself in mock
        assert.ok(
            reply.content.includes("COMMAND_MODSETS_OUTPUT"),
            "Expected mod sets output in reply"
        );
    });

    it("should send exactly one reply", async () => {        const interaction = createMockInteraction();

        const command = new Modsets();
        const ctx = createCommandContext({ interaction });
        await command.run(ctx);

        assertReplyCount(interaction, 1);
    });

    it("should work without guild context (guildOnly: false)", async () => {        const interaction = createMockInteraction({
            guild: null as any
        });

        const command = new Modsets();
        const ctx = createCommandContext({ interaction });
        await command.run(ctx);

        const replies = (interaction as any)._getReplies();
        assert.ok(replies.length > 0, "Expected reply even without guild context");
    });
});
