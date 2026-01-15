import assert from "node:assert/strict";
import test from "node:test";
import Charactergear from "../../slash/charactergear.ts";
import { createMockBot, createMockInteraction } from "../mocks/index.ts";

test.describe("Charactergear Command", () => {
    test("run() should show all gear for a character without expand", async () => {
        const bot = createMockBot();
        bot.swgohAPI.getCharacter = async () => ({
            name: "Commander Luke Skywalker",
            unitTierList: [
                {
                    tier: 1,
                    equipmentSetList: ["Mk 1 Weapon", "Mk 1 Armor"],
                },
                {
                    tier: 2,
                    equipmentSetList: ["Mk 2 Weapon", "Mk 2 Armor"],
                },
            ],
        });

        const replyCalls: any[] = [];
        const interaction = createMockInteraction({
            options: {
                getString: (name: string) => (name === "character" ? "CLS" : null),
                getBoolean: () => false,
                getInteger: () => null,
            } as any,
            language: {
                get: (key: string, ...args: any[]) => {
                    if (key === "COMMAND_CHARACTERGEAR_GEAR_ALL") {
                        return `# ${args[0]}'s Gear\n${args[1]}`;
                    }
                    return key;
                },
            },
            reply: async (data: any) => replyCalls.push(data),
        });

        const cmd = new Charactergear(bot as any);
        await cmd.run(bot as any, interaction);

        assert.ok(replyCalls.length > 0, "Should have called reply");
        assert.ok(replyCalls[0].content, "Should have content");
        assert.match(replyCalls[0].content, /Commander Luke Skywalker/, "Should include character name");
        assert.match(replyCalls[0].content, /Mk 1/, "Should include Mk 1 gear");
        assert.match(replyCalls[0].content, /Mk 2/, "Should include Mk 2 gear");
    });

    test("run() should show gear for specific gear level", async () => {
        const bot = createMockBot();
        bot.swgohAPI.getCharacter = async () => ({
            name: "Commander Luke Skywalker",
            unitTierList: [
                {
                    tier: 1,
                    equipmentSetList: ["Mk 1 Weapon", "Mk 1 Armor"],
                },
                {
                    tier: 2,
                    equipmentSetList: ["Mk 2 Weapon", "Mk 2 Armor"],
                },
                {
                    tier: 3,
                    equipmentSetList: ["Mk 3 Weapon", "Mk 3 Armor"],
                },
            ],
        });

        const replyCalls: any[] = [];
        const interaction = createMockInteraction({
            options: {
                getString: (name: string) => (name === "character" ? "CLS" : null),
                getBoolean: () => false,
                getInteger: () => 2,
            } as any,
            reply: async (data: any) => replyCalls.push(data),
        });

        const cmd = new Charactergear(bot as any);
        await cmd.run(bot as any, interaction);

        assert.ok(replyCalls.length > 0, "Should have called reply");
        assert.ok(replyCalls[0].embeds, "Should have embeds");
        const embed = replyCalls[0].embeds[0];
        assert.ok(embed.fields, "Should have fields");
        assert.ok(
            embed.fields.some((f: any) => f.name.includes("Gear 2") || f.name.includes("Gear Lvl 2")),
            "Should include gear level 2",
        );
    });

    test("run() should handle expanded gear pieces", async () => {
        const bot = createMockBot();
        bot.swgohAPI.getCharacter = async () => ({
            name: "Commander Luke Skywalker",
            unitTierList: [
                {
                    tier: 1,
                    equipmentSetList: ["Mk 1 Weapon"],
                },
            ],
        });

        // Mock cache.get to return gear recipe data
        bot.cache.get = async (db: string, collection: string, query: any) => {
            if (collection === "gear") {
                return [
                    {
                        nameKey: "Mk 1 Weapon",
                        recipeId: "",
                    },
                ];
            }
            return [];
        };

        const replyCalls: any[] = [];
        const interaction = createMockInteraction({
            options: {
                getString: (name: string) => (name === "character" ? "CLS" : null),
                getBoolean: () => true,
                getInteger: () => 1,
            } as any,
            reply: async (data: any) => replyCalls.push(data),
        });

        const cmd = new Charactergear(bot as any);
        await cmd.run(bot as any, interaction);

        assert.ok(replyCalls.length > 0, "Should have called reply");
    });

    test("run() should handle invalid character name", async () => {
        const bot = createMockBot();
        const replyCalls: any[] = [];

        const interaction = createMockInteraction({
            options: {
                getString: (name: string) => (name === "character" ? "InvalidCharacterName123" : null),
                getBoolean: () => false,
                getInteger: () => null,
            } as any,
            reply: async (data: any) => replyCalls.push(data),
        });

        const cmd = new Charactergear(bot as any);
        await cmd.run(bot as any, interaction);

        assert.ok(replyCalls.length > 0, "Should have called reply for error");
        assert.ok(replyCalls[0].embeds, "Should have error embed");
    });

    test("run() should reject invalid gear level", async () => {
        const bot = createMockBot();
        const replyCalls: any[] = [];

        const interaction = createMockInteraction({
            options: {
                getString: (name: string) => (name === "character" ? "CLS" : null),
                getBoolean: () => false,
                getInteger: () => 20,
            } as any,
            reply: async (data: any) => replyCalls.push(data),
        });

        const cmd = new Charactergear(bot as any);
        await cmd.run(bot as any, interaction);

        assert.ok(replyCalls.length > 0, "Should have called reply for error");
        assert.ok(replyCalls[0].embeds, "Should have error embed");
    });

    test("run() should show player-specific gear needs with allycode", async () => {
        const bot = createMockBot();
        bot.getAllyCode = async () => "123456789";
        bot.getPlayerCooldown = async () => ({ updated: Date.now(), refresh: false } as any);
        bot.swgohAPI.getCharacter = async () => ({
            name: "Commander Luke Skywalker",
            unitTierList: [
                {
                    tier: 8,
                    equipmentSetList: ["Mk 8 Weapon", "Mk 8 Armor", "Mk 8 Shield", "Mk 8 Implant", "Mk 8 Comm", "Mk 8 Processor"],
                },
                {
                    tier: 9,
                    equipmentSetList: ["Mk 9 Weapon", "Mk 9 Armor"],
                },
            ],
        } as any);
        bot.swgohAPI.unitStats = async () => [
            {
                name: "TestPlayer",
                updated: Date.now(),
                roster: [
                    {
                        defId: "COMMANDERLUKESKYWALKER",
                        gear: 8,
                        equipped: [{ slot: 0 }, { slot: 1 }],
                    },
                ],
            } as any,
        ];

        const replyCalls: any[] = [];
        const interaction = createMockInteraction({
            options: {
                getString: (name: string) => {
                    if (name === "character") return "CLS";
                    if (name === "allycode") return "123456789";
                    return null;
                },
                getBoolean: () => false,
                getInteger: () => null,
            } as any,
            reply: async (data: any) => replyCalls.push(data),
            user: { id: "user123" } as any,
            guild: { id: "guild123" } as any,
        });

        const cmd = new Charactergear(bot as any);
        await cmd.run(bot as any, interaction);

        assert.ok(replyCalls.length > 0, "Should have called reply");
        assert.ok(replyCalls[0].embeds, "Should have embeds");
        const embed = replyCalls[0].embeds[0];
        assert.ok(embed.author, "Should have author");
        assert.match(embed.author.name, /TestPlayer/, "Should include player name");
    });

    test("run() should handle player without character unlocked", async () => {
        const bot = createMockBot();
        bot.getAllyCode = async () => "123456789";
        bot.getPlayerCooldown = async () => ({ updated: Date.now(), refresh: false } as any);
        bot.swgohAPI.getCharacter = async () => ({
            name: "Commander Luke Skywalker",
            unitTierList: [],
        } as any);
        bot.swgohAPI.unitStats = async () => [
            {
                name: "TestPlayer",
                updated: Date.now(),
                roster: [],
            } as any,
        ];

        const replyCalls: any[] = [];
        const interaction = createMockInteraction({
            options: {
                getString: (name: string) => {
                    if (name === "character") return "CLS";
                    if (name === "allycode") return "123456789";
                    return null;
                },
                getBoolean: () => false,
                getInteger: () => null,
            } as any,
            reply: async (data: any) => replyCalls.push(data),
            user: { id: "user123" } as any,
            guild: { id: "guild123" } as any,
        });

        const cmd = new Charactergear(bot as any);
        await cmd.run(bot as any, interaction);

        assert.ok(replyCalls.length > 0, "Should have called reply");
        assert.ok(replyCalls[0].embeds, "Should have error embed");
    });

    test("run() should handle player with gear already at requested level", async () => {
        const bot = createMockBot();
        bot.getAllyCode = async () => "123456789";
        bot.getPlayerCooldown = async () => ({ updated: Date.now(), refresh: false } as any);
        bot.swgohAPI.getCharacter = async () => ({
            name: "Commander Luke Skywalker",
            unitTierList: [
                {
                    tier: 10,
                    equipmentSetList: ["Mk 10 Weapon"],
                },
            ],
        } as any);
        bot.swgohAPI.unitStats = async () => [
            {
                name: "TestPlayer",
                updated: Date.now(),
                roster: [
                    {
                        defId: "COMMANDERLUKESKYWALKER",
                        gear: 12,
                        equipped: [],
                    },
                ],
            } as any,
        ];

        const replyCalls: any[] = [];
        const interaction = createMockInteraction({
            options: {
                getString: (name: string) => {
                    if (name === "character") return "CLS";
                    if (name === "allycode") return "123456789";
                    return null;
                },
                getBoolean: () => false,
                getInteger: () => 10,
            } as any,
            reply: async (data: any) => replyCalls.push(data),
            user: { id: "user123" } as any,
            guild: { id: "guild123" } as any,
        });

        const cmd = new Charactergear(bot as any);
        await cmd.run(bot as any, interaction);

        assert.ok(replyCalls.length > 0, "Should have called reply");
        assert.ok(replyCalls[0].embeds, "Should have error embed");
    });

    test("run() should handle API errors gracefully", async () => {
        const bot = createMockBot();
        bot.swgohAPI.getCharacter = async () => {
            throw new Error("API Error");
        };

        const replyCalls: any[] = [];
        const interaction = createMockInteraction({
            options: {
                getString: (name: string) => (name === "character" ? "CLS" : null),
                getBoolean: () => false,
                getInteger: () => null,
            } as any,
            reply: async (data: any) => replyCalls.push(data),
        });

        const cmd = new Charactergear(bot as any);
        await cmd.run(bot as any, interaction);

        assert.ok(replyCalls.length > 0, "Should have called reply with error");
    });

    test("run() should filter out ??????? gear pieces", async () => {
        const bot = createMockBot();
        bot.swgohAPI.getCharacter = async () => ({
            name: "Commander Luke Skywalker",
            unitTierList: [
                {
                    tier: 1,
                    equipmentSetList: ["Mk 1 Weapon", "???????", "Mk 1 Armor"],
                },
            ],
        });

        const replyCalls: any[] = [];
        const interaction = createMockInteraction({
            options: {
                getString: (name: string) => (name === "character" ? "CLS" : null),
                getBoolean: () => false,
                getInteger: () => null,
            } as any,
            reply: async (data: any) => replyCalls.push(data),
        });

        const cmd = new Charactergear(bot as any);
        await cmd.run(bot as any, interaction);

        assert.ok(replyCalls.length > 0, "Should have called reply");
        assert.ok(replyCalls[0].content, "Should have content");
        assert.doesNotMatch(replyCalls[0].content, /\?\?\?/, "Should not include ??????? gear");
    });

    test("run() should handle player with maxed gear showing congrats", async () => {
        const bot = createMockBot();
        bot.getAllyCode = async () => "123456789";
        bot.getPlayerCooldown = async () => ({ updated: Date.now(), refresh: false } as any);
        bot.swgohAPI.getCharacter = async () => ({
            name: "Commander Luke Skywalker",
            unitTierList: [
                {
                    tier: 12,
                    equipmentSetList: [],
                },
            ],
        } as any);
        bot.swgohAPI.unitStats = async () => [
            {
                name: "TestPlayer",
                updated: Date.now(),
                roster: [
                    {
                        defId: "COMMANDERLUKESKYWALKER",
                        gear: 12,
                        equipped: [],
                    },
                ],
            } as any,
        ];

        const replyCalls: any[] = [];
        const interaction = createMockInteraction({
            options: {
                getString: (name: string) => {
                    if (name === "character") return "CLS";
                    if (name === "allycode") return "123456789";
                    return null;
                },
                getBoolean: () => false,
                getInteger: () => null,
            } as any,
            reply: async (data: any) => replyCalls.push(data),
            user: { id: "user123" } as any,
            guild: { id: "guild123" } as any,
        });

        const cmd = new Charactergear(bot as any);
        await cmd.run(bot as any, interaction);

        assert.ok(replyCalls.length > 0, "Should have called reply");
        assert.ok(replyCalls[0].embeds, "Should have embeds");
        const embed = replyCalls[0].embeds[0];
        const congratsField = embed.fields?.find((f: any) => f.name === "Congrats!");
        assert.ok(congratsField, "Should have congrats field");
    });

    test("run() should handle player roster warnings", async () => {
        const bot = createMockBot();
        bot.getAllyCode = async () => "123456789";
        bot.getPlayerCooldown = async () => ({ updated: Date.now(), refresh: false } as any);
        bot.swgohAPI.getCharacter = async () => ({
            name: "Commander Luke Skywalker",
            unitTierList: [
                {
                    tier: 8,
                    equipmentSetList: ["Mk 8 Weapon"],
                },
            ],
        } as any);
        bot.swgohAPI.unitStats = async () => [
            {
                name: "TestPlayer",
                updated: Date.now(),
                warnings: ["Your data may be out of sync", "Profile may be private"],
                roster: [
                    {
                        defId: "COMMANDERLUKESKYWALKER",
                        gear: 8,
                        equipped: [],
                    },
                ],
            } as any,
        ];

        const replyCalls: any[] = [];
        const interaction = createMockInteraction({
            options: {
                getString: (name: string) => {
                    if (name === "character") return "CLS";
                    if (name === "allycode") return "123456789";
                    return null;
                },
                getBoolean: () => false,
                getInteger: () => null,
            } as any,
            reply: async (data: any) => replyCalls.push(data),
            user: { id: "user123" } as any,
            guild: { id: "guild123" } as any,
        });

        const cmd = new Charactergear(bot as any);
        await cmd.run(bot as any, interaction);

        assert.ok(replyCalls.length > 0, "Should have called reply");
        assert.ok(replyCalls[0].embeds, "Should have embeds");
        const embed = replyCalls[0].embeds[0];
        const warningsField = embed.fields?.find((f: any) => f.name === "Warnings");
        assert.ok(warningsField, "Should have warnings field");
        assert.match(warningsField.value, /out of sync/, "Should include warning message");
    });
});
