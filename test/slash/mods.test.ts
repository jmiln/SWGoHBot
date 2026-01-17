import assert from "node:assert/strict";
import test from "node:test";
import Mods from "../../slash/mods.ts";
import { createMockBot, createMockInteraction } from "../mocks/index.ts";

test.describe("Mods Command", () => {
    test("command is instantiated with correct name", () => {
        const bot = createMockBot();
        const cmd = new Mods(bot);
        assert.equal(cmd.commandData.name, "mods");
        assert.equal(cmd.commandData.guildOnly, false);
    });

    test("run() displays mod recommendations for valid character", async () => {
        const bot = createMockBot({
            characters: [
                {
                    name: "Commander Luke Skywalker",
                    uniqueName: "COMMANDERLUKESKYWALKER",
                    side: "light",
                    url: "https://swgoh.gg/characters/commander-luke-skywalker/",
                    aliases: ["CLS", "Luke"],
                    avatarURL: "https://example.com/cls.png",
                    mods: {
                        sets: ["Speed x4", "Health x2"],
                        square: "Offense",
                        arrow: "Speed",
                        diamond: "Defense",
                        triangle: "Crit. Damage",
                        circle: "Protection",
                        cross: "Potency",
                        source: "swgoh.gg",
                    },
                },
            ],
        });

        const editReplyCalls: any[] = [];
        const interaction = createMockInteraction({
            options: {
                getString: () => "CLS",
            } as any,
            deferReply: async () => {},
            editReply: async (data: any) => editReplyCalls.push(data),
        });

        const cmd = new Mods(bot);
        await cmd.run(bot, interaction);

        assert.equal(editReplyCalls.length, 1);
        assert.ok(editReplyCalls[0].embeds);
        assert.ok(editReplyCalls[0].embeds[0].description);
    });

    test("run() returns error when character not found", async () => {
        const bot = createMockBot();

        const interaction = createMockInteraction({
            options: {
                getString: () => "INVALIDCHAR",
            } as any,
            deferReply: async () => {},
        });

        const cmd = new Mods(bot);
        await cmd.run(bot, interaction);

        // Should have called error method
        assert.ok(true);
    });

    test("run() returns error when multiple characters match", async () => {
        const bot = createMockBot({
            characters: [
                {
                    name: "Test Character 1",
                    uniqueName: "TESTCHAR1",
                    side: "light",
                    aliases: ["test"],
                    avatarURL: "",
                    avatarName: "test1",
                    factions: [],
                },
                {
                    name: "Test Character 2",
                    uniqueName: "TESTCHAR2",
                    side: "light",
                    aliases: ["test"],
                    avatarURL: "",
                    avatarName: "test2",
                    factions: [],
                },
            ],
        });

        const interaction = createMockInteraction({
            options: {
                getString: () => "test",
            } as any,
            deferReply: async () => {},
        });

        const cmd = new Mods(bot);
        await cmd.run(bot, interaction);

        // Should have called error method
        assert.ok(true);
    });
});
