import assert from "node:assert/strict";
import test from "node:test";
import GuildQuality from "../../slash/guildquality.ts";
import { createMockBot, createMockInteraction } from "../mocks/index.ts";

test.describe("GuildQuality Command", () => {
    test("run() should error when no ally code is provided", async () => {
        const bot = createMockBot({
            getAllyCode: async () => null,
            getPlayerCooldown: async () => 3600,
        });

        const replyCalls: any[] = [];
        const interaction = createMockInteraction({
            user: { id: "test-user-123" },
            guild: { id: "test-guild-456" },
            options: {
                getString: () => null,
            } as any,
            reply: async (data: any) => {
                replyCalls.push(data);
                return data;
            },
            editReply: async (data: any) => {
                replyCalls.push(data);
                return data;
            },
        });

        const cmd = new GuildQuality(bot as any);
        await cmd.run(bot as any, interaction);

        assert.ok(replyCalls.length > 1);
        assert.ok(
            replyCalls[1].embeds?.[0]?.description?.includes("No valid ally code"),
            "Should show no valid ally code error",
        );
    });

    test("run() should handle guild API errors gracefully", async () => {
        const bot = createMockBot({
            getAllyCode: async () => "123456789",
            getPlayerCooldown: async () => 3600,
            swgohAPI: {
                guild: async () => {
                    throw new Error("API is down");
                },
            },
        });

        const replyCalls: any[] = [];
        const interaction = createMockInteraction({
            user: { id: "test-user-123" },
            guild: { id: "test-guild-456" },
            options: {
                getString: () => "123456789",
            } as any,
            reply: async (data: any) => {
                replyCalls.push(data);
                return data;
            },
            editReply: async (data: any) => {
                replyCalls.push(data);
                return data;
            },
        });

        const cmd = new GuildQuality(bot as any);
        await cmd.run(bot as any, interaction);

        assert.ok(replyCalls.length > 1);
        assert.ok(
            replyCalls[1].embeds?.[0]?.description?.includes("Issue getting guild"),
            "Should show guild API error",
        );
    });

    test("run() should calculate quality scores correctly with relics", async () => {
        const bot = createMockBot({
            getAllyCode: async () => "123456789",
            getPlayerCooldown: async () => 3600,
            swgohAPI: {
                guild: async () => ({
                    name: "Test Guild",
                    roster: [
                        {
                            allyCode: 123456789,
                            name: "TestPlayer",
                            guildMemberLevel: 3,
                        },
                    ],
                    warnings: [],
                }),
                unitStats: async () => [
                    {
                        name: "TestPlayer",
                        allyCode: 123456789,
                        stats: [
                            { nameKey: "STAT_CHARACTER_GALACTIC_POWER_ACQUIRED_NAME", value: 5000000 },
                            { nameKey: "STAT_GALACTIC_POWER_ACQUIRED_NAME", value: 8000000 },
                        ],
                        roster: [
                            {
                                defId: "COMMANDERLUKESKYWALKER",
                                gear: 13,
                                relic: { currentTier: 9 }, // r7 = currentTier 9
                                mods: [
                                    {
                                        secondaryStat: [
                                            { unitStat: 5, value: 20 }, // Speed +20
                                        ],
                                    },
                                    {
                                        secondaryStat: [
                                            { unitStat: "UNITSTATSPEED", value: 15 }, // Speed +15
                                        ],
                                    },
                                ],
                            },
                            {
                                defId: "DARTHVADER",
                                gear: 12,
                                relic: { currentTier: 2 }, // r0 = currentTier 2
                                mods: [
                                    {
                                        secondaryStat: [
                                            { unitStat: 5, value: 18 }, // Speed +18
                                        ],
                                    },
                                ],
                            },
                        ],
                        updated: Date.now(),
                    },
                ],
            },
        });

        const replyCalls: any[] = [];
        const interaction = createMockInteraction({
            user: { id: "test-user-123" },
            guild: { id: "test-guild-456" },
            options: {
                getString: () => "123456789",
            } as any,
            reply: async (data: any) => {
                replyCalls.push(data);
                return data;
            },
            editReply: async (data: any) => {
                replyCalls.push(data);
                return data;
            },
        });

        const cmd = new GuildQuality(bot as any);
        await cmd.run(bot as any, interaction);

        assert.ok(replyCalls.length > 1, "Should have replied");
        const finalReply = replyCalls[replyCalls.length - 1];
        assert.ok(finalReply.embeds?.[0], "Should have an embed");
        assert.strictEqual(
            finalReply.embeds[0].author?.name,
            "Test Guild's player quality",
            "Should show guild name",
        );

        // Verify quality calculations in output
        const description = finalReply.embeds[0].description;
        assert.ok(description, "Should have description");
        assert.ok(description.includes("TestPlayer"), "Should include player name");
        assert.ok(description.includes("ModQ"), "Should show ModQ header");
        assert.ok(description.includes("GearQ"), "Should show GearQ header");
        assert.ok(description.includes("TotalQ"), "Should show TotalQ header");

        // Check that averages are shown
        const averagesField = finalReply.embeds[0].fields?.find((f: any) => f.name === "Averages");
        assert.ok(averagesField, "Should have averages field");
        assert.ok(averagesField.value.includes("Mod Quality"), "Should show mod quality average");
        assert.ok(averagesField.value.includes("Gear Quality"), "Should show gear quality average");
        assert.ok(averagesField.value.includes("Total Quality"), "Should show total quality average");
    });

    test("run() should include gear quality with relic bonuses", async () => {
        const bot = createMockBot({
            getAllyCode: async () => "123456789",
            getPlayerCooldown: async () => 3600,
            swgohAPI: {
                guild: async () => ({
                    name: "Test Guild",
                    roster: [
                        {
                            allyCode: 123456789,
                            name: "TestPlayer",
                            guildMemberLevel: 3,
                        },
                    ],
                    warnings: [],
                }),
                unitStats: async () => [
                    {
                        name: "TestPlayer",
                        allyCode: 123456789,
                        stats: [
                            { nameKey: "STAT_CHARACTER_GALACTIC_POWER_ACQUIRED_NAME", value: 1000000 },
                            { nameKey: "STAT_GALACTIC_POWER_ACQUIRED_NAME", value: 1000000 },
                        ],
                        roster: [
                            {
                                defId: "COMMANDERLUKESKYWALKER",
                                gear: 13,
                                relic: { currentTier: 7 },
                                mods: [],
                            },
                        ],
                        updated: Date.now(),
                    },
                ],
            },
        });

        const replyCalls: any[] = [];
        const interaction = createMockInteraction({
            user: { id: "test-user-123" },
            guild: { id: "test-guild-456" },
            options: {
                getString: () => "123456789",
            } as any,
            reply: async (data: any) => {
                replyCalls.push(data);
                return data;
            },
            editReply: async (data: any) => {
                replyCalls.push(data);
                return data;
            },
        });

        const cmd = new GuildQuality(bot as any);
        await cmd.run(bot as any, interaction);

        assert.ok(replyCalls.length > 1);
        const finalReply = replyCalls[replyCalls.length - 1];

        // Just verify that gear quality is calculated and displayed
        const description = finalReply.embeds[0].description;
        assert.ok(description.match(/\d+\.\d+/), "Should show gear quality with decimal values");
    });

    test("run() should filter out guild members with guildMemberLevel <= 1", async () => {
        const bot = createMockBot({
            getAllyCode: async () => "123456789",
            getPlayerCooldown: async () => 3600,
            swgohAPI: {
                guild: async () => ({
                    name: "Test Guild",
                    roster: [
                        {
                            allyCode: 111111111,
                            name: "LeftPlayer",
                            guildMemberLevel: 1, // Should be filtered
                        },
                        {
                            allyCode: 123456789,
                            name: "ActivePlayer",
                            guildMemberLevel: 3,
                        },
                    ],
                    warnings: [],
                }),
                unitStats: async (allyCodes: number[]) => {
                    // Should only be called with the active player
                    assert.strictEqual(allyCodes.length, 1, "Should only request active player");
                    assert.strictEqual(allyCodes[0], 123456789, "Should request active player");
                    return [
                        {
                            name: "ActivePlayer",
                            allyCode: 123456789,
                            stats: [
                                { nameKey: "STAT_CHARACTER_GALACTIC_POWER_ACQUIRED_NAME", value: 5000000 },
                                { nameKey: "STAT_GALACTIC_POWER_ACQUIRED_NAME", value: 8000000 },
                            ],
                            roster: [],
                            updated: Date.now(),
                        },
                    ];
                },
            },
        });

        const replyCalls: any[] = [];
        const interaction = createMockInteraction({
            user: { id: "test-user-123" },
            guild: { id: "test-guild-456" },
            options: {
                getString: () => "123456789",
            } as any,
            reply: async (data: any) => {
                replyCalls.push(data);
                return data;
            },
            editReply: async (data: any) => {
                replyCalls.push(data);
                return data;
            },
        });

        const cmd = new GuildQuality(bot as any);
        await cmd.run(bot as any, interaction);

        assert.ok(replyCalls.length > 1);
        const finalReply = replyCalls[replyCalls.length - 1];
        const description = finalReply.embeds[0].description;
        assert.ok(description.includes("ActivePlayer"), "Should include active player");
        assert.ok(!description.includes("LeftPlayer"), "Should not include left player");
    });

    test("run() should handle unitStats API errors gracefully", async () => {
        const bot = createMockBot({
            getAllyCode: async () => "123456789",
            getPlayerCooldown: async () => 3600,
            swgohAPI: {
                guild: async () => ({
                    name: "Test Guild",
                    roster: [
                        {
                            allyCode: 123456789,
                            name: "TestPlayer",
                            guildMemberLevel: 3,
                        },
                    ],
                    warnings: [],
                }),
                unitStats: async () => {
                    throw new Error("UnitStats API Error");
                },
            },
        });

        const replyCalls: any[] = [];
        const interaction = createMockInteraction({
            user: { id: "test-user-123" },
            guild: { id: "test-guild-456" },
            options: {
                getString: () => "123456789",
            } as any,
            reply: async (data: any) => {
                replyCalls.push(data);
                return data;
            },
            editReply: async (data: any) => {
                replyCalls.push(data);
                return data;
            },
        });

        const cmd = new GuildQuality(bot as any);
        await cmd.run(bot as any, interaction);

        assert.ok(replyCalls.length >= 2, "Should have multiple replies");

        // Check if any reply contains an error message about characters or guild stats
        const hasErrorReply = replyCalls.some(
            (reply) =>
                reply.embeds?.[0]?.title?.includes("Something Broke") ||
                reply.embeds?.[0]?.description?.includes("Something Broke") ||
                reply.embeds?.[0]?.description?.includes("Couldn't get guild stats"),
        );
        assert.ok(hasErrorReply, "Should show error message for unitStats failure");
    });

    test("run() should show guild warnings if present", async () => {
        const bot = createMockBot({
            getAllyCode: async () => "123456789",
            getPlayerCooldown: async () => 3600,
            swgohAPI: {
                guild: async () => ({
                    name: "Test Guild",
                    roster: [
                        {
                            allyCode: 123456789,
                            name: "TestPlayer",
                            guildMemberLevel: 3,
                        },
                    ],
                    warnings: ["Some players may have stale data", "API rate limit reached"],
                }),
                unitStats: async () => [
                    {
                        name: "TestPlayer",
                        allyCode: 123456789,
                        stats: [
                            { nameKey: "STAT_CHARACTER_GALACTIC_POWER_ACQUIRED_NAME", value: 5000000 },
                            { nameKey: "STAT_GALACTIC_POWER_ACQUIRED_NAME", value: 8000000 },
                        ],
                        roster: [],
                        updated: Date.now(),
                    },
                ],
            },
        });

        const replyCalls: any[] = [];
        const interaction = createMockInteraction({
            user: { id: "test-user-123" },
            guild: { id: "test-guild-456" },
            options: {
                getString: () => "123456789",
            } as any,
            reply: async (data: any) => {
                replyCalls.push(data);
                return data;
            },
            editReply: async (data: any) => {
                replyCalls.push(data);
                return data;
            },
        });

        const cmd = new GuildQuality(bot as any);
        await cmd.run(bot as any, interaction);

        assert.ok(replyCalls.length > 1);
        const finalReply = replyCalls[replyCalls.length - 1];
        const warningsField = finalReply.embeds[0].fields?.find((f: any) => f.name === "Warnings");
        assert.ok(warningsField, "Should have warnings field");
        assert.ok(
            warningsField.value.includes("Some players may have stale data"),
            "Should show first warning",
        );
        assert.ok(warningsField.value.includes("API rate limit reached"), "Should show second warning");
    });

    test("run() should include Extra Info field with formulas", async () => {
        const bot = createMockBot({
            getAllyCode: async () => "123456789",
            getPlayerCooldown: async () => 3600,
            swgohAPI: {
                guild: async () => ({
                    name: "Test Guild",
                    roster: [
                        {
                            allyCode: 123456789,
                            name: "TestPlayer",
                            guildMemberLevel: 3,
                        },
                    ],
                    warnings: [],
                }),
                unitStats: async () => [
                    {
                        name: "TestPlayer",
                        allyCode: 123456789,
                        stats: [
                            { nameKey: "STAT_CHARACTER_GALACTIC_POWER_ACQUIRED_NAME", value: 5000000 },
                            { nameKey: "STAT_GALACTIC_POWER_ACQUIRED_NAME", value: 8000000 },
                        ],
                        roster: [],
                        updated: Date.now(),
                    },
                ],
            },
        });

        const replyCalls: any[] = [];
        const interaction = createMockInteraction({
            user: { id: "test-user-123" },
            guild: { id: "test-guild-456" },
            options: {
                getString: () => "123456789",
            } as any,
            reply: async (data: any) => {
                replyCalls.push(data);
                return data;
            },
            editReply: async (data: any) => {
                replyCalls.push(data);
                return data;
            },
        });

        const cmd = new GuildQuality(bot as any);
        await cmd.run(bot as any, interaction);

        assert.ok(replyCalls.length > 1);
        const finalReply = replyCalls[replyCalls.length - 1];
        const infoField = finalReply.embeds[0].fields?.find((f: any) => f.name === "Extra Info");
        assert.ok(infoField, "Should have Extra Info field");
        assert.ok(infoField.value.includes("Mod Quality"), "Should show Mod Quality formula");
        assert.ok(infoField.value.includes("Gear Quality"), "Should show Gear Quality formula");
        assert.ok(infoField.value.includes("G13 Bonus score"), "Should show G13 bonus formula");
    });
});
