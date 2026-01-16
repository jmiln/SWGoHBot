import assert from "node:assert/strict";
import test from "node:test";
import GrandArena from "../../slash/grandarena.ts";
import { createMockBot, createMockInteraction } from "../mocks/index.ts";

test.describe("GrandArena Command", () => {
    test("run() should error when user 1 is invalid", async () => {
        const bot = createMockBot({
            getAllyCode: async () => null,
            getPlayerCooldown: async () => 3600,
        });

        const replyCalls: any[] = [];
        const interaction = createMockInteraction({
            user: { id: "test-user-123" },
            guild: { id: "test-guild-456" },
            options: {
                getString: (name: string) => {
                    if (name === "allycode_1") return "invaliduser";
                    if (name === "allycode_2") return "123456789";
                    return null;
                },
            } as any,
            reply: async (data: any) => { replyCalls.push(data); return data; },
        });

        const cmd = new GrandArena(bot as any);
        await cmd.run(bot as any, interaction);

        assert.ok(replyCalls.length > 1);
        assert.ok(replyCalls[1].embeds?.[0]?.description?.includes("COMMAND_GRANDARENA_INVALID_USER"));
    });

    test("run() should error when user 2 is invalid", async () => {
        const bot = createMockBot({
            getAllyCode: async (interaction: any, allycode: string) => {
                if (allycode === "123456789") return "123456789";
                return null;
            },
            getPlayerCooldown: async () => 3600,
        });

        const replyCalls: any[] = [];
        const interaction = createMockInteraction({
            user: { id: "test-user-123" },
            guild: { id: "test-guild-456" },
            options: {
                getString: (name: string) => {
                    if (name === "allycode_1") return "123456789";
                    if (name === "allycode_2") return "invaliduser";
                    return null;
                },
            } as any,
            reply: async (data: any) => { replyCalls.push(data); return data; },
        });

        const cmd = new GrandArena(bot as any);
        await cmd.run(bot as any, interaction);

        assert.ok(replyCalls.length > 1);
        assert.ok(replyCalls[1].embeds?.[0]?.description?.includes("COMMAND_GRANDARENA_INVALID_USER"));
    });

    test("run() should error when both users are 'me' and not registered", async () => {
        const bot = createMockBot({
            getAllyCode: async () => null,
            getPlayerCooldown: async () => 3600,
        });

        const replyCalls: any[] = [];
        const interaction = createMockInteraction({
            user: { id: "test-user-123" },
            guild: { id: "test-guild-456" },
            options: {
                getString: (name: string) => {
                    if (name === "allycode_1") return "me";
                    if (name === "allycode_2") return "me";
                    return null;
                },
            } as any,
            reply: async (data: any) => { replyCalls.push(data); return data; },
        });

        const cmd = new GrandArena(bot as any);
        await cmd.run(bot as any, interaction);

        assert.ok(replyCalls.length > 1);
        assert.ok(replyCalls[1].embeds?.[0]?.description?.includes("COMMAND_GRANDARENA_UNREGISTERED"));
    });

    test("run() should error when invalid character is provided", async () => {
        const bot = createMockBot({
            getAllyCode: async (interaction: any, allycode: string) => {
                return allycode;
            },
            getPlayerCooldown: async () => 3600,
            swgohAPI: {
                unitStats: async () => [
                    {
                        name: "Player1",
                        updated: Date.now(),
                        roster: [
                            {
                                defId: "COMMANDERLUKESKYWALKER",
                                combatType: 1,
                                level: 85,
                                rarity: 7,
                                gear: 13,
                                gp: 25000,
                                skills: [],
                                stats: { final: { Speed: 200 } },
                            },
                        ],
                    },
                    {
                        name: "Player2",
                        updated: Date.now(),
                        roster: [
                            {
                                defId: "REY",
                                combatType: 1,
                                level: 85,
                                rarity: 7,
                                gear: 13,
                                gp: 25000,
                                skills: [],
                                stats: { final: { Speed: 210 } },
                            },
                        ],
                    },
                ],
            } as any,
        });

        const replyCalls: any[] = [];
        const interaction = createMockInteraction({
            user: { id: "test-user-123" },
            guild: { id: "test-guild-456" },
            options: {
                getString: (name: string) => {
                    if (name === "allycode_1") return "123456789";
                    if (name === "allycode_2") return "987654321";
                    if (name === "characters") return "InvalidCharacter";
                    return null;
                },
            } as any,
            reply: async (data: any) => { replyCalls.push(data); return data; },
        });

        const cmd = new GrandArena(bot as any);
        await cmd.run(bot as any, interaction);

        assert.ok(replyCalls.length > 1);
        assert.ok(replyCalls[1].embeds?.[0]?.description?.includes("COMMAND_GRANDARENA_INVALID_CHAR"));
    });

    test("run() should error when invalid faction is provided", async () => {
        const bot = createMockBot({
            getAllyCode: async (interaction: any, allycode: string) => {
                return allycode;
            },
            getPlayerCooldown: async () => 3600,
            swgohAPI: {
                unitStats: async () => [
                    {
                        name: "Player1",
                        updated: Date.now(),
                        roster: [
                            {
                                defId: "COMMANDERLUKESKYWALKER",
                                combatType: 1,
                                level: 85,
                                rarity: 7,
                                gear: 13,
                                gp: 25000,
                                skills: [],
                                stats: { final: { Speed: 200 } },
                            },
                        ],
                    },
                    {
                        name: "Player2",
                        updated: Date.now(),
                        roster: [
                            {
                                defId: "REY",
                                combatType: 1,
                                level: 85,
                                rarity: 7,
                                gear: 13,
                                gp: 25000,
                                skills: [],
                                stats: { final: { Speed: 210 } },
                            },
                        ],
                    },
                ],
            } as any,
        });

        const replyCalls: any[] = [];
        const interaction = createMockInteraction({
            user: { id: "test-user-123" },
            guild: { id: "test-guild-456" },
            options: {
                getString: (name: string) => {
                    if (name === "allycode_1") return "123456789";
                    if (name === "allycode_2") return "987654321";
                    if (name === "faction") return "InvalidFaction";
                    return null;
                },
            } as any,
            reply: async (data: any) => { replyCalls.push(data); return data; },
        });

        const cmd = new GrandArena(bot as any);
        await cmd.run(bot as any, interaction);

        assert.ok(replyCalls.length > 1);
        assert.ok(replyCalls[1].embeds?.[0]?.description?.includes("did not find a match for the faction"));
    });

    test("run() should successfully compare two players", async () => {
        const bot = createMockBot({
            getAllyCode: async (interaction: any, allycode: string) => {
                return allycode;
            },
            getPlayerCooldown: async () => 3600,
            swgohAPI: {
                unitStats: async () => [
                    {
                        name: "Player1",
                        updated: Date.now(),
                        roster: [
                            {
                                defId: "COMMANDERLUKESKYWALKER",
                                combatType: 1,
                                level: 85,
                                rarity: 7,
                                gear: 13,
                                gp: 25000,
                                equipped: [],
                                relic: { currentTier: 9 },
                                skills: [
                                    { isZeta: true, tier: 8, tiers: 8, isOmicron: false },
                                    { isZeta: false, tier: 8, tiers: 8, isOmicron: true },
                                ],
                                stats: { final: { Speed: 200 } },
                                mods: [
                                    { pips: 6, secondaryStat: [{ unitStat: 5, value: 25 }] },
                                    { pips: 5, secondaryStat: [{ unitStat: 5, value: 15 }] },
                                ],
                            },
                            {
                                defId: "MILLENNIUMFALCON",
                                combatType: 2,
                                level: 85,
                                rarity: 7,
                                gp: 20000,
                                skills: [],
                                stats: { final: { Speed: 150 } },
                            },
                        ],
                        arena: {
                            char: { rank: 50 },
                            ship: { rank: 100 },
                        },
                    },
                    {
                        name: "Player2",
                        updated: Date.now(),
                        roster: [
                            {
                                defId: "REY",
                                combatType: 1,
                                level: 85,
                                rarity: 7,
                                gear: 12,
                                gp: 22000,
                                equipped: [1, 2],
                                skills: [
                                    { isZeta: true, tier: 8, tiers: 8, isOmicron: false },
                                ],
                                stats: { final: { Speed: 210 } },
                                mods: [
                                    { pips: 6, secondaryStat: [{ unitStat: 5, value: 20 }] },
                                ],
                            },
                            {
                                defId: "HOUNDSTOOTH",
                                combatType: 2,
                                level: 85,
                                rarity: 7,
                                gp: 18000,
                                skills: [],
                                stats: { final: { Speed: 140 } },
                            },
                        ],
                        arena: {
                            char: { rank: 75 },
                            ship: { rank: 125 },
                        },
                    },
                ],
            } as any,
        });

        const replyCalls: any[] = [];
        const interaction = createMockInteraction({
            user: { id: "test-user-123" },
            guild: { id: "test-guild-456" },
            options: {
                getString: (name: string) => {
                    if (name === "allycode_1") return "123456789";
                    if (name === "allycode_2") return "987654321";
                    return null;
                },
            } as any,
            reply: async (data: any) => { replyCalls.push(data); return data; },
            editReply: async (data: any) => { replyCalls.push(data); return data; },
        });

        const cmd = new GrandArena(bot as any);
        await cmd.run(bot as any, interaction);

        assert.ok(replyCalls.length > 1, "Should call reply and editReply");
        const embedReply = replyCalls[1];
        // The author name comes from a language string, so just check the structure exists
        assert.ok(embedReply.embeds?.[0]?.author?.name, "Should have author name");
        assert.ok(embedReply.embeds?.[0]?.fields?.length > 0, "Should have fields");

        // Check that various sections are present
        const fieldNames = embedReply.embeds?.[0]?.fields?.map((f: any) => f.name);
        assert.ok(fieldNames.includes("General Overview"));
        assert.ok(fieldNames.includes("GP Stats Overview"));
        assert.ok(fieldNames.includes("Character Gear Counts"));
        assert.ok(fieldNames.includes("Character Rarity Counts"));
        assert.ok(fieldNames.includes("Galactic Legend Overview"));
        assert.ok(fieldNames.includes("Character Relic Counts"));
        assert.ok(fieldNames.includes("Mod Stats Overview"));
    });

    test("run() should compare specific characters when provided", async () => {
        const bot = createMockBot({
            getAllyCode: async (interaction: any, allycode: string) => {
                return allycode;
            },
            getPlayerCooldown: async () => 3600,
            swgohAPI: {
                unitStats: async () => [
                    {
                        name: "Player1",
                        updated: Date.now(),
                        roster: [
                            {
                                defId: "COMMANDERLUKESKYWALKER",
                                combatType: 1,
                                level: 85,
                                rarity: 7,
                                gear: 13,
                                gp: 25000,
                                equipped: [],
                                relic: { currentTier: 9 },
                                skills: [
                                    { isZeta: true, tier: 8, tiers: 8, isOmicron: false },
                                ],
                                stats: { final: { Speed: 200 } },
                                mods: [],
                            },
                        ],
                        arena: {
                            char: { rank: 50 },
                            ship: { rank: 100 },
                        },
                    },
                    {
                        name: "Player2",
                        updated: Date.now(),
                        roster: [
                            {
                                defId: "COMMANDERLUKESKYWALKER",
                                combatType: 1,
                                level: 85,
                                rarity: 7,
                                gear: 12,
                                gp: 22000,
                                equipped: [1, 2],
                                skills: [
                                    { isZeta: false, tier: 7, tiers: 8, isOmicron: false },
                                ],
                                stats: { final: { Speed: 180 } },
                                mods: [],
                            },
                        ],
                        arena: {
                            char: { rank: 75 },
                            ship: { rank: 125 },
                        },
                    },
                ],
            } as any,
        });

        const replyCalls: any[] = [];
        const interaction = createMockInteraction({
            user: { id: "test-user-123" },
            guild: { id: "test-guild-456" },
            options: {
                getString: (name: string) => {
                    if (name === "allycode_1") return "123456789";
                    if (name === "allycode_2") return "987654321";
                    if (name === "characters") return "cls";
                    return null;
                },
            } as any,
            reply: async (data: any) => { replyCalls.push(data); return data; },
            editReply: async (data: any) => { replyCalls.push(data); return data; },
        });

        const cmd = new GrandArena(bot as any);
        await cmd.run(bot as any, interaction);

        assert.ok(replyCalls.length > 1, "Should call reply and editReply");

        // Check that CLS is in the comparison
        const fieldNames = replyCalls[1].embeds?.[0]?.fields?.map((f: any) => f.name);
        const clsField = fieldNames.find((name: string) => name.includes("Commander Luke Skywalker"));
        assert.ok(clsField, "Should have CLS character comparison");
    });

    test("run() should handle API errors gracefully", async () => {
        const bot = createMockBot({
            getAllyCode: async (interaction: any, allycode: string) => {
                return allycode;
            },
            getPlayerCooldown: async () => 3600,
            swgohAPI: {
                unitStats: async () => {
                    throw new Error("API Error");
                },
            } as any,
        });

        const replyCalls: any[] = [];
        const interaction = createMockInteraction({
            user: { id: "test-user-123" },
            guild: { id: "test-guild-456" },
            options: {
                getString: (name: string) => {
                    if (name === "allycode_1") return "123456789";
                    if (name === "allycode_2") return "987654321";
                    return null;
                },
            } as any,
            reply: async (data: any) => { replyCalls.push(data); return data; },
        });

        const cmd = new GrandArena(bot as any);
        await cmd.run(bot as any, interaction);

        assert.ok(replyCalls.length > 1);
        assert.ok(replyCalls[1].embeds?.[0]?.description?.includes("API Error"));
    });
});
