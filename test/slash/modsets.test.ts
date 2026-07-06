import assert from "node:assert";
import { describe, it } from "node:test";
import Modsets from "../../slash/modsets.ts";
import { createCommandContext, createMockInteraction } from "../mocks/index.ts";
import { assertReplyCount, getLastReply } from "./helpers.ts";

// modsets is a static command: it replies with COMMAND_MODSETS_OUTPUT wrapped in an
// `md` code block. There is no branching logic, so the tests assert the formatting
// contract (code block + correct string key) and that it replies exactly once.
describe("Modsets", () => {
    it("wraps the mod-sets output in an `md` code block", async () => {
        const interaction = createMockInteraction();
        const command = new Modsets();
        await command.run(createCommandContext({ interaction }));

        const reply = getLastReply(interaction);
        assert.ok(reply.content.startsWith("```md\n"), "Expected an md code block fence");
        assert.ok(reply.content.trimEnd().endsWith("```"), "Expected the code block to be closed");
        assert.ok(reply.content.includes("COMMAND_MODSETS_OUTPUT"), "Expected the mod-sets output string");
    });

    it("sends exactly one reply", async () => {
        const interaction = createMockInteraction();
        const command = new Modsets();
        await command.run(createCommandContext({ interaction }));

        assertReplyCount(interaction, 1);
    });
});
