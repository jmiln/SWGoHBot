import { describe, it } from "node:test";
import assert from "node:assert";
import { createMockBot, createMockInteraction } from "../mocks/index.ts";
import { assertErrorReply } from "./helpers.ts";
import Farm from "../../slash/farm.ts";

describe("Farm", () => {
    // Note: Full farm location tests require MongoDB and the swgohAPI module,
    // which are not available in unit tests. We test error cases and basic flow.

    it("should return error for character not found", async () => {
        const bot = createMockBot();
        const interaction = createMockInteraction({
            optionsData: { character: "NonexistentCharacter123" }
        });

        const command = new Farm(bot);
        await command.run(bot, interaction);

        assertErrorReply(interaction, "BASE_SWGOH_NO_CHAR_FOUND");
    });

    it("should have correct command configuration", () => {
        const bot = createMockBot();
        const command = new Farm(bot);

        assert.strictEqual(command.commandData.name, "farm", "Expected command name to be 'farm'");
        assert.strictEqual(command.commandData.guildOnly, false, "Expected guildOnly to be false");
        assert.ok(command.commandData.options, "Expected options to be defined");
        assert.strictEqual(command.commandData.options.length, 1, "Expected exactly one option");
        assert.strictEqual(command.commandData.options[0].name, "character", "Expected character option");
        assert.strictEqual(command.commandData.options[0].required, true, "Expected character to be required");
    });
});
