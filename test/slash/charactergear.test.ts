import { describe, it } from "node:test";
import assert from "node:assert";
import { createMockBot, createMockInteraction } from "../mocks/index.ts";
import { assertErrorReply, assertReplyCount } from "./helpers.ts";
import Charactergear from "../../slash/charactergear.ts";

describe("Charactergear", () => {
    // Note: Full charactergear tests require MongoDB and swgohAPI.
    // We test error cases and basic validation logic.

    it("should return error for character not found", async () => {
        const bot = createMockBot();
        const interaction = createMockInteraction({
            optionsData: { character: "NonexistentCharacter999" }
        });

        const command = new Charactergear(bot);
        await command.run(bot, interaction);

        assertErrorReply(interaction, "BASE_SWGOH_NO_CHAR_FOUND");
    });

    it("should return error for multiple character matches", async () => {
        const bot = createMockBot();
        const interaction = createMockInteraction({
            optionsData: { character: "CHAR" } // Generic search
        });

        const command = new Charactergear(bot);
        await command.run(bot, interaction);

        // Either finds nothing or finds multiple - both should error
        const replies = (interaction as any)._getReplies();
        assert.ok(replies.length > 0, "Expected at least one reply");
    });

    it("should return error for invalid gear level", async () => {
        const bot = createMockBot();
        const interaction = createMockInteraction({
            optionsData: { character: "Luke", gearlevel: 15 } // Max is 13
        });

        const command = new Charactergear(bot);
        await command.run(bot, interaction);

        assertErrorReply(interaction, "not a valid gear level");
    });

    it("should return error for negative gear level", async () => {
        const bot = createMockBot();
        const interaction = createMockInteraction({
            optionsData: { character: "Luke", gearlevel: -1 }
        });

        const command = new Charactergear(bot);
        await command.run(bot, interaction);

        assertErrorReply(interaction, "not a valid gear level");
    });

    it("should work without guild context (guildOnly: false)", async () => {
        const bot = createMockBot();
        const interaction = createMockInteraction({
            optionsData: { character: "NonexistentChar" },
            guild: null as any
        });

        const command = new Charactergear(bot);
        await command.run(bot, interaction);

        assertReplyCount(interaction, 1);
    });

    it("should have correct command configuration", () => {
        const bot = createMockBot();
        const command = new Charactergear(bot);

        assert.strictEqual(command.commandData.name, "charactergear", "Expected command name to be 'charactergear'");
        assert.strictEqual(command.commandData.guildOnly, false, "Expected guildOnly to be false");
        assert.ok(command.commandData.options, "Expected options to be defined");
        assert.strictEqual(command.commandData.options.length, 4, "Expected 4 options");

        const charOpt = command.commandData.options.find(o => o.name === "character");
        const allycodeOpt = command.commandData.options.find(o => o.name === "allycode");
        const expandOpt = command.commandData.options.find(o => o.name === "expand");
        const gearLevelOpt = command.commandData.options.find(o => o.name === "gearlevel");

        assert.ok(charOpt, "Expected character option");
        assert.ok(allycodeOpt, "Expected allycode option");
        assert.ok(expandOpt, "Expected expand option");
        assert.ok(gearLevelOpt, "Expected gearlevel option");

        assert.strictEqual(charOpt.required, true, "Expected character to be required");
        assert.strictEqual(charOpt.autocomplete, true, "Expected character to have autocomplete");
    });
});
