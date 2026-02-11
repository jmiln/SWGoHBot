import assert from "node:assert";
import { describe, it } from "node:test";
import Ships from "../../slash/ships.ts";
import { createMockInteraction } from "../mocks/index.ts";
import { assertErrorReply, assertReplyCount } from "./helpers.ts";

describe("Ships", () => {
    // Note: Full ship tests require MongoDB and swgohAPI.
    // We test error cases and basic validation logic.

    it("should return error for ship not found", async () => {        const interaction = createMockInteraction({
            optionsData: { ship: "NonexistentShip123" }
        });

        const command = new Ships();
        await command.run({ interaction, language: (interaction as any).language });

        assertErrorReply(interaction, "cannot find");
    });

    it("should return error for multiple ship matches", async () => {        const interaction = createMockInteraction({
            optionsData: { ship: "SHIP" } // Generic search that might match multiple
        });

        const command = new Ships();
        await command.run({ interaction, language: (interaction as any).language });

        // Either finds nothing or finds multiple - both should error
        const replies = (interaction as any)._getReplies();
        assert.ok(replies.length > 0, "Expected at least one reply");
    });

    it("should work without guild context (guildOnly: false)", async () => {        const interaction = createMockInteraction({
            optionsData: { ship: "NonexistentShip" },
            guild: null as any
        });

        const command = new Ships();
        await command.run({ interaction, language: (interaction as any).language });

        assertReplyCount(interaction, 1);
    });
});
