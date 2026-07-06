import assert from "node:assert";
import { describe, it } from "node:test";
import { characters } from "../../data/constants/units.ts";
import Randomchar from "../../slash/randomchar.ts";
import { createCommandContext, createMockInteraction } from "../mocks/index.ts";
import { assertReplyCount, getLastReply } from "./helpers.ts";

// These tests cover the no-allycode branch, which draws from the in-memory bot `characters`
// list and needs no network/DB. The allycode branch (roster fetch + rarity filter via
// swgohAPI/fetchPlayerWithCooldown) is a separate path and is not covered here.
//
// Note: the `rarity` option only filters within the allycode branch; it has no effect when
// no allycode is supplied, so these tests deliberately do not assert rarity behavior.

const validNames = new Set(characters.map((c) => c.name));

/** Extract the character lines from the ``` code block the command replies with. */
function replyLines(interaction: unknown): string[] {
    const content = getLastReply(interaction as never).content as string;
    return content
        .replace(/```/g, "")
        .trim()
        .split("\n")
        .filter((l) => l.length > 0);
}

async function runWith(optionsData: Record<string, unknown> = {}): Promise<string[]> {
    const interaction = createMockInteraction(Object.keys(optionsData).length ? { optionsData } : undefined);
    const command = new Randomchar();
    await command.run(createCommandContext({ interaction }));
    return replyLines(interaction);
}

describe("Randomchar (no allycode)", () => {
    it("defaults to 5 characters when count is not specified", async () => {
        const lines = await runWith();
        assert.strictEqual(lines.length, 5);
    });

    it("returns exactly the requested count", async () => {
        assert.strictEqual((await runWith({ count: 1 })).length, 1);
        assert.strictEqual((await runWith({ count: 2 })).length, 2);
        assert.strictEqual((await runWith({ count: 3 })).length, 3);
    });

    it("returns distinct characters (no duplicates)", async () => {
        const lines = await runWith({ count: 5 });
        assert.strictEqual(new Set(lines).size, lines.length, `Expected all distinct, got: ${lines.join(", ")}`);
    });

    it("only returns names from the real character list", async () => {
        const lines = await runWith({ count: 5 });
        for (const name of lines) {
            assert.ok(validNames.has(name), `Unexpected character name not in the roster list: "${name}"`);
        }
    });

    it("wraps the output in a code block and replies once", async () => {
        const interaction = createMockInteraction({ optionsData: { count: 3 } });
        const command = new Randomchar();
        await command.run(createCommandContext({ interaction }));

        const reply = getLastReply(interaction);
        assert.ok(reply.content.startsWith("```"), "Expected a code block fence");
        assert.ok(reply.content.trimEnd().endsWith("```"), "Expected the code block to be closed");
        assertReplyCount(interaction, 1);
    });
});
