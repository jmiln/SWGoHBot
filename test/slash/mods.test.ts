import assert from "node:assert";
import { after, before, describe, it } from "node:test";
import Mods from "../../slash/mods.ts";
import type { BotUnit } from "../../types/types.ts";
import { createCommandContext, createMockInteraction } from "../mocks/index.ts";
import { assertErrorReply } from "./helpers.ts";

const FIXTURE_WITH_MODS: BotUnit = {
    uniqueName: "FIXTURE_WITHMODS",
    name: "Fixture With Mods",
    aliases: ["Fixture With Mods"],
    avatarURL: "https://game-assets.swgoh.gg/textures/tex.charui_test.png",
    avatarName: "charui_test",
    side: "light",
    factions: ["Rebel"],
    mods: {
        sets: ["Speed x4", "Potency x2"],
        square: "Offense",
        arrow: "Speed",
        diamond: "Defense",
        triangle: "Critical Chance",
        circle: "Protection",
        cross: "Potency",
    },
};

const FIXTURE_NO_MODS: BotUnit = {
    uniqueName: "FIXTURE_NOMODS",
    name: "Fixture No Mods",
    aliases: ["Fixture No Mods"],
    avatarURL: "https://game-assets.swgoh.gg/textures/tex.charui_testnomods.png",
    avatarName: "charui_testnomods",
    side: "dark",
    factions: ["Empire"],
};

describe("Mods", () => {
    let originalCharacters: BotUnit[];

    before(() => {
        originalCharacters = Mods.characters;
        Mods.characters = [FIXTURE_WITH_MODS, FIXTURE_NO_MODS];
    });

    after(() => {
        Mods.characters = originalCharacters;
    });

    it("should return error for character not found", async () => {
        const interaction = createMockInteraction({
            optionsData: { character: "NonexistentCharacter999" },
        });

        const command = new Mods();
        const ctx = createCommandContext({ interaction });
        await command.run(ctx);

        assertErrorReply(interaction, "COMMAND_MODS_USAGE");
    });

    it("should return error for multiple character matches", async () => {
        // "fixture" appears in both fixture character names
        const interaction = createMockInteraction({
            optionsData: { character: "fixture" },
        });

        const command = new Mods();
        const ctx = createCommandContext({ interaction });
        await command.run(ctx);

        const replies = (interaction as any)._getReplies();
        assert.ok(replies.length > 0, "Expected at least one reply");
    });

    it("should defer reply before processing", async () => {
        const interaction = createMockInteraction({
            optionsData: { character: "NonexistentChar" },
        });

        const command = new Mods();
        const ctx = createCommandContext({ interaction });
        await command.run(ctx);

        assert.strictEqual((interaction as any).deferred, true, "Expected interaction to be deferred");
    });

    it("should return embed with mod set info for a character with mods", async () => {
        const interaction = createMockInteraction({
            optionsData: { character: "FIXTURE_WITHMODS" },
        });

        const command = new Mods();
        const ctx = createCommandContext({ interaction });
        await command.run(ctx);

        const replies = (interaction as any)._getReplies();
        assert.ok(replies.length > 0, "Expected at least one reply");

        const lastReply = replies[replies.length - 1];
        assert.ok(lastReply.embeds, "Expected embed in reply");
        const embed = lastReply.embeds[0];
        const embedData = embed.data || embed;
        const description = embedData.description || "";

        assert.ok(!description.includes("COMMAND_NO_MODSETS"), "Expected mod data, not no-mod-sets message");
        assert.ok(description.length > 0, "Expected non-empty description");
    });

    it("should return COMMAND_NO_MODSETS for a character without mod recommendations", async () => {
        const interaction = createMockInteraction({
            optionsData: { character: "FIXTURE_NOMODS" },
        });

        const command = new Mods();
        const ctx = createCommandContext({ interaction });
        await command.run(ctx);

        const replies = (interaction as any)._getReplies();
        assert.ok(replies.length > 0, "Expected at least one reply");

        const lastReply = replies[replies.length - 1];
        assert.ok(lastReply.embeds, "Expected embed in reply");
        const embed = lastReply.embeds[0];
        const embedData = embed.data || embed;
        const description = embedData.description || "";

        assert.ok(description.includes("COMMAND_NO_MODSETS"), "Expected no-mod-sets key in description");
    });
});
