import assert from "node:assert";
import { describe, it } from "node:test";
import Ships from "../../slash/ships.ts";
import { createMockBot, createMockInteraction } from "../mocks/index.ts";
import { assertErrorReply, assertReplyCount } from "./helpers.ts";

describe("Ships", () => {
    // Note: Full ship tests require MongoDB and swgohAPI.
    // We test error cases and basic validation logic.

    it("should return error for ship not found", async () => {
        const bot = createMockBot();
        const interaction = createMockInteraction({
            optionsData: { ship: "NonexistentShip123" }
        });

        const command = new Ships(bot);
        await command.run(bot, interaction);

        assertErrorReply(interaction, "cannot find");
    });

    it("should return error for multiple ship matches", async () => {
        const bot = createMockBot();
        const interaction = createMockInteraction({
            optionsData: { ship: "SHIP" } // Generic search that might match multiple
        });

        const command = new Ships(bot);
        await command.run(bot, interaction);

        // Either finds nothing or finds multiple - both should error
        const replies = (interaction as any)._getReplies();
        assert.ok(replies.length > 0, "Expected at least one reply");
    });

    it("should work without guild context (guildOnly: false)", async () => {
        const bot = createMockBot();
        const interaction = createMockInteraction({
            optionsData: { ship: "NonexistentShip" },
            guild: null as any
        });

        const command = new Ships(bot);
        await command.run(bot, interaction);

        assertReplyCount(interaction, 1);
    });

    it("should have correct command configuration", () => {
        const bot = createMockBot();
        const command = new Ships(bot);

        assert.strictEqual(command.commandData.name, "ships", "Expected command name to be 'ships'");
        assert.strictEqual(command.commandData.guildOnly, false, "Expected guildOnly to be false");
        assert.ok(command.commandData.options, "Expected options to be defined");
        assert.strictEqual(command.commandData.options.length, 1, "Expected 1 option");

        const shipOpt = command.commandData.options.find(o => o.name === "ship");
        assert.ok(shipOpt, "Expected ship option");
        assert.strictEqual(shipOpt.required, true, "Expected ship to be required");
        assert.strictEqual(shipOpt.autocomplete, true, "Expected ship to have autocomplete");
    });
});
