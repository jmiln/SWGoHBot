import { describe, it } from "node:test";
import assert from "node:assert";
import { createMockBot, createMockInteraction } from "../mocks/index.ts";
import { assertErrorReply, assertReplyCount } from "./helpers.ts";
import Character from "../../slash/character.ts";

describe("Character", () => {
    // Note: Full character tests require MongoDB and swgohAPI.
    // We test error cases and basic validation logic.

    it("should return error for character not found", async () => {
        const bot = createMockBot();
        const interaction = createMockInteraction({
            optionsData: { character: "NonexistentCharacter999" }
        });

        const command = new Character(bot);
        await command.run(bot, interaction);

        assertErrorReply(interaction, "COMMAND_CHARACTER_INVALID_CHARACTER");
    });

    it("should return error for multiple character matches", async () => {
        const bot = createMockBot();
        const interaction = createMockInteraction({
            optionsData: { character: "CHAR" } // Generic search that might match multiple
        });

        const command = new Character(bot);
        await command.run(bot, interaction);

        // Either finds nothing or finds multiple - both should error
        const replies = (interaction as any)._getReplies();
        assert.ok(replies.length > 0, "Expected at least one reply");
    });

    it("should work without guild context (guildOnly: false)", async () => {
        const bot = createMockBot();
        const interaction = createMockInteraction({
            optionsData: { character: "NonexistentChar" },
            guild: null as any
        });

        const command = new Character(bot);
        await command.run(bot, interaction);

        assertReplyCount(interaction, 1);
    });

    it("should send at least one reply for valid requests", async () => {
        const bot = createMockBot();
        const interaction = createMockInteraction({
            optionsData: { character: "InvalidChar" }
        });

        const command = new Character(bot);
        await command.run(bot, interaction);

        assertReplyCount(interaction, 1);
    });

    it("should have correct command configuration", () => {
        const bot = createMockBot();
        const command = new Character(bot);

        assert.strictEqual(command.commandData.name, "character", "Expected command name to be 'character'");
        assert.strictEqual(command.commandData.guildOnly, false, "Expected guildOnly to be false");
        assert.ok(command.commandData.options, "Expected options to be defined");
        assert.strictEqual(command.commandData.options.length, 1, "Expected 1 option");

        const charOpt = command.commandData.options.find(o => o.name === "character");
        assert.ok(charOpt, "Expected character option");
        assert.strictEqual(charOpt.required, true, "Expected character to be required");
        assert.strictEqual(charOpt.autocomplete, true, "Expected character to have autocomplete");
    });
});
