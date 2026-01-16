import assert from "node:assert/strict";
import test from "node:test";
import Faction from "../../slash/faction.ts";
import { createMockBot, createMockInteraction } from "../mocks/index.ts";

test.describe("Faction Command", () => {
    test("run() should error when both faction groups are selected", async () => {
        const bot = createMockBot();
        const replyCalls: any[] = [];
        const interaction = createMockInteraction({
            options: {
                getString: (name: string) => {
                    if (name === "faction_group_1") return "profession_jedi";
                    if (name === "faction_group_2") return "profession_sith";
                    return null;
                },
                getBoolean: () => false,
            } as any,
            reply: async (data) => { replyCalls.push(data); },
        });

        const cmd = new Faction(bot as any);
        await cmd.run(bot as any, interaction);

        assert.ok(replyCalls.length > 0);
        assert.ok(replyCalls[0].embeds?.[0]?.description?.includes("one faction at a time"));
    });

    test("run() should error when no faction is selected", async () => {
        const bot = createMockBot();
        const replyCalls: any[] = [];
        const interaction = createMockInteraction({
            options: {
                getString: () => null,
                getBoolean: () => false,
            } as any,
            reply: async (data) => { replyCalls.push(data); },
        });

        const cmd = new Faction(bot as any);
        await cmd.run(bot as any, interaction);

        assert.ok(replyCalls.length > 0);
        assert.ok(replyCalls[0].embeds?.[0]?.description?.includes("select a faction"));
    });

    test("run() should return faction list without allycode", async () => {
        const bot = createMockBot({
            cache: {
                get: async (db: string, collection: string, query: any) => {
                    if (query.categoryIdList === "profession_jedi") {
                        return [
                            { baseId: "COMMANDERLUKESKYWALKER", nameKey: "Commander Luke Skywalker" },
                            { baseId: "REY", nameKey: "Rey" },
                        ];
                    }
                    return [];
                },
            } as any,
            getAllyCode: async () => null,
        });

        const replyCalls: any[] = [];
        const interaction = createMockInteraction({
            options: {
                getString: (name: string) => {
                    if (name === "faction_group_1") return "profession_jedi";
                    return null;
                },
                getBoolean: () => false,
            } as any,
            reply: async (data) => { replyCalls.push(data); },
        });

        const cmd = new Faction(bot as any);
        await cmd.run(bot as any, interaction);

        assert.ok(replyCalls.length > 0);
        assert.ok(replyCalls[0].embeds?.[0]?.description?.includes("Commander Luke Skywalker"));
        assert.ok(replyCalls[0].embeds?.[0]?.description?.includes("Rey"));
    });

    test("run() should filter characters by leader ability", async () => {
        const bot = createMockBot({
            cache: {
                get: async (db: string, collection: string, query: any) => {
                    if (query.categoryIdList === "profession_jedi") {
                        return [
                            { baseId: "COMMANDERLUKESKYWALKER", nameKey: "Commander Luke Skywalker" },
                            { baseId: "REY", nameKey: "Rey" },
                        ];
                    }
                    return [];
                },
            } as any,
            getAllyCode: async () => null,
            swgohAPI: {
                getCharacter: async (uniqueName: string) => {
                    if (uniqueName === "COMMANDERLUKESKYWALKER") {
                        return {
                            baseId: "COMMANDERLUKESKYWALKER",
                            name: "Commander Luke Skywalker",
                            skillReferenceList: [
                                { skillId: "leaderskill_CLS", cost: { AbilityMatZeta: 0 } },
                                { skillId: "basicskill_CLS", cost: { AbilityMatZeta: 0 } },
                            ],
                        };
                    }
                    return {
                        baseId: "REY",
                        name: "Rey",
                        skillReferenceList: [
                            { skillId: "basicskill_REY", cost: { AbilityMatZeta: 0 } },
                        ],
                    };
                },
            } as any,
        });

        const replyCalls: any[] = [];
        const interaction = createMockInteraction({
            options: {
                getString: (name: string) => {
                    if (name === "faction_group_1") return "profession_jedi";
                    return null;
                },
                getBoolean: (name: string) => name === "leader",
            } as any,
            reply: async (data) => { replyCalls.push(data); },
        });

        const cmd = new Faction(bot as any);
        await cmd.run(bot as any, interaction);

        assert.ok(replyCalls.length > 0);
        assert.ok(replyCalls[0].embeds?.[0]?.description?.includes("Commander Luke Skywalker"));
        assert.ok(!replyCalls[0].embeds?.[0]?.description?.includes("Rey"));
    });

    test("run() should filter characters by zeta ability", async () => {
        const bot = createMockBot({
            cache: {
                get: async (db: string, collection: string, query: any) => {
                    if (query.categoryIdList === "profession_jedi") {
                        return [
                            { baseId: "COMMANDERLUKESKYWALKER", nameKey: "Commander Luke Skywalker" },
                            { baseId: "REY", nameKey: "Rey" },
                        ];
                    }
                    return [];
                },
            } as any,
            getAllyCode: async () => null,
            swgohAPI: {
                getCharacter: async (uniqueName: string) => {
                    if (uniqueName === "COMMANDERLUKESKYWALKER") {
                        return {
                            baseId: "COMMANDERLUKESKYWALKER",
                            name: "Commander Luke Skywalker",
                            skillReferenceList: [
                                { skillId: "leaderskill_CLS", cost: { AbilityMatZeta: 1 } },
                                { skillId: "basicskill_CLS", cost: { AbilityMatZeta: 0 } },
                            ],
                        };
                    }
                    return {
                        baseId: "REY",
                        name: "Rey",
                        skillReferenceList: [
                            { skillId: "basicskill_REY", cost: { AbilityMatZeta: 0 } },
                        ],
                    };
                },
            } as any,
        });

        const replyCalls: any[] = [];
        const interaction = createMockInteraction({
            options: {
                getString: (name: string) => {
                    if (name === "faction_group_1") return "profession_jedi";
                    return null;
                },
                getBoolean: (name: string) => name === "zeta",
            } as any,
            reply: async (data) => { replyCalls.push(data); },
        });

        const cmd = new Faction(bot as any);
        await cmd.run(bot as any, interaction);

        assert.ok(replyCalls.length > 0);
        assert.ok(replyCalls[0].embeds?.[0]?.description?.includes("Commander Luke Skywalker"));
        assert.ok(!replyCalls[0].embeds?.[0]?.description?.includes("Rey"));
    });

    test("run() should display player roster when allycode provided", async () => {
        const bot = createMockBot({
            cache: {
                get: async (db: string, collection: string, query: any) => {
                    if (query.categoryIdList === "profession_jedi") {
                        return [
                            { baseId: "COMMANDERLUKESKYWALKER", nameKey: "Commander Luke Skywalker" },
                        ];
                    }
                    return [];
                },
            } as any,
            getAllyCode: async () => "123456789",
            getPlayerCooldown: async () => 3600,
            swgohAPI: {
                unitStats: async () => [{
                    name: "TestPlayer",
                    updated: Date.now(),
                    roster: [
                        {
                            defId: "COMMANDERLUKESKYWALKER",
                            nameKey: "Commander Luke Skywalker",
                            rarity: 7,
                            level: 85,
                            gear: 13,
                            gp: 25000,
                            skills: [
                                { isZeta: true, tier: 8, tiers: 8 },
                            ],
                        },
                    ],
                }],
                langChar: async (char: any) => char,
            } as any,
        });

        const deferCalls: any[] = [];
        const editCalls: any[] = [];
        const interaction = createMockInteraction({
            user: { id: "test-user-123" },
            guild: { id: "test-guild-456" },
            options: {
                getString: (name: string) => {
                    if (name === "faction_group_1") return "profession_jedi";
                    if (name === "allycode") return "123456789";
                    return null;
                },
                getBoolean: () => false,
            } as any,
            deferReply: async () => { deferCalls.push(true); },
            editReply: async (data) => { editCalls.push(data); },
        });

        const cmd = new Faction(bot as any);
        await cmd.run(bot as any, interaction);

        assert.ok(deferCalls.length > 0, "Should defer reply");
        assert.ok(editCalls.length > 0, "Should edit reply");
        assert.ok(editCalls[0].embeds?.[0]?.author?.name?.includes("TestPlayer"));
    });
});
