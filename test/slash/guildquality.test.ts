import assert from "node:assert";
import { after, beforeEach, describe, it } from "node:test";
import cache from "../../modules/cache.ts";
import logger from "../../modules/Logger.ts";
import patreonFuncs from "../../modules/patreonFuncs.ts";
import swgohAPI from "../../modules/swapi.ts";
import userReg from "../../modules/users.ts";
import GuildQuality from "../../slash/guildquality.ts";
import type { SWAPIGuild, SWAPIPlayer } from "../../types/swapi_types.ts";
import { closeMongoClient, getMongoClient } from "../helpers/mongodb.ts";
import { createCommandContext, createMockInteraction } from "../mocks/index.ts";
import { assertErrorReply } from "./helpers.ts";

// Mock guild and player data helpers
const createMockGuild = (overrides: Partial<SWAPIGuild> = {}): SWAPIGuild => {
    const now = Date.now();
    return {
        name: "Test Guild",
        id: "guild123",
        desc: "Test guild description",
        members: 50,
        gp: 250000000,
        roster: [
            { allyCode: 111111111, name: "Player1", guildMemberLevel: 3, updated: now } as any,
            { allyCode: 222222222, name: "Player2", guildMemberLevel: 3, updated: now } as any,
            { allyCode: 333333333, name: "Applicant", guildMemberLevel: 1, updated: now } as any, // Should be filtered out
        ],
        updated: now,
        warnings: [],
        ...overrides,
    } as any;
};

const createMockPlayer = (allyCode: number, overrides: Partial<SWAPIPlayer> = {}): SWAPIPlayer => ({
    name: `Player${allyCode}`,
    allyCode: allyCode,
    level: 85,
    stats: [
        { nameKey: "STAT_CHARACTER_GALACTIC_POWER_ACQUIRED_NAME", value: 5000000 },
        { nameKey: "STAT_GALACTIC_POWER_ACQUIRED_NAME", value: 8000000 },
    ],
    roster: [
        // Character with +15 speed mod and G13 R7
        {
            defId: "COMMANDERLUKESKYWALKER",
            nameKey: "Commander Luke Skywalker",
            rarity: 7,
            level: 85,
            gear: 13,
            relic: { currentTier: 7 },
            mods: [
                {
                    slot: 1,
                    set: 1,
                    level: 15,
                    pips: 5,
                    primaryStat: { unitStat: 48, value: 100 },
                    secondaryStat: [
                        { unitStat: 5, value: 20, roll: 0 }, // Speed +20
                    ],
                } as any,
            ],
        } as any,
        // Character with +15 speed mod and G12
        {
            defId: "DARTHVADER",
            nameKey: "Darth Vader",
            rarity: 7,
            level: 85,
            gear: 12,
            relic: { currentTier: 0 },
            mods: [
                {
                    slot: 2,
                    set: 1,
                    level: 15,
                    pips: 5,
                    primaryStat: { unitStat: 48, value: 100 },
                    secondaryStat: [
                        { unitStat: 5, value: 15, roll: 0 }, // Speed +15
                    ],
                } as any,
            ],
        } as any,
    ],
    arena: { char: { rank: 50, squad: [] }, ship: { rank: 100, squad: [] } } as any,
    updated: Date.now(),
    ...overrides,
} as any);

// Store original swgohAPI methods
const originalGuild = swgohAPI.guild.bind(swgohAPI);
const originalUnitStats = swgohAPI.unitStats.bind(swgohAPI);

// Mock data storage
let mockGuildData: SWAPIGuild | null = null;
let mockPlayerData: SWAPIPlayer[] = [];
let mockGuildEnabled = false;
let mockUnitStatsEnabled = false;

// Mock swgohAPI methods
async function mockGuild(allyCode: number, cooldown?: any) {
    if (!mockGuildEnabled) {
        return originalGuild(allyCode, cooldown);
    }
    if (!mockGuildData) {
        throw new Error("I don't know this player, make sure they're registered first");
    }
    return mockGuildData;
}

async function mockUnitStats(allyCodes: number[], cooldown?: any) {
    if (!mockUnitStatsEnabled) {
        return originalUnitStats(allyCodes, cooldown);
    }
    if (mockPlayerData.length === 0) {
        throw new Error("Stats Error");
    }
    return mockPlayerData;
}

describe("GuildQuality", () => {
    // Store original logger methods
    const originalLoggerLog = logger.log;
    const originalLoggerWarn = logger.warn;
    const originalLoggerError = logger.error;
    const originalLoggerInfo = logger.info;

    beforeEach(async () => {
        // Suppress all logger output during tests
        logger.log = () => {};
        logger.warn = () => {};
        logger.error = () => {};
        logger.info = () => {};

        // Initialize modules with real MongoDB testcontainer
        const mongoClient = await getMongoClient();
        cache.init(mongoClient);
        userReg.init(cache as any);
        patreonFuncs.init({} as any);

        // Reset mocks
        mockGuildEnabled = false;
        mockUnitStatsEnabled = false;
        mockGuildData = null;
        mockPlayerData = [];

        // Install mocks
        (swgohAPI as any).guild = mockGuild;
        (swgohAPI as any).unitStats = mockUnitStats;
    });

    after(async () => {
        // Restore logger
        logger.log = originalLoggerLog;
        logger.warn = originalLoggerWarn;
        logger.error = originalLoggerError;
        logger.info = originalLoggerInfo;

        // Close MongoDB connection to prevent hanging
        await closeMongoClient();
    });

    // Error handling tests
    it("should return error when no ally code found", async () => {
        const interaction = createMockInteraction({
            optionsData: {},
        } as any);

        const command = new GuildQuality();
        const ctx = createCommandContext({ interaction });
        await command.run(ctx);

        assertErrorReply(interaction, "No valid ally code");
    });

    it("should return error when guild fetch fails", async () => {
        mockGuildEnabled = true;
        mockGuildData = null; // Will cause mockGuild to throw
        const interaction = createMockInteraction({
            optionsData: { allycode: "123456789" },
        } as any);

        const command = new GuildQuality();
        const ctx = createCommandContext({ interaction });
        await command.run(ctx);

        assertErrorReply(interaction, "Issue getting guild");
    });

    it("should return error when unitStats fails", async () => {
        mockGuildEnabled = true;
        mockUnitStatsEnabled = true;
        mockGuildData = createMockGuild();
        mockPlayerData = []; // Empty array will cause error
        const interaction = createMockInteraction({
            optionsData: { allycode: "123456789" },
        } as any);

        const command = new GuildQuality();
        const ctx = createCommandContext({ interaction });
        await command.run(ctx);

        const replies = (interaction as any)._getReplies();
        assert.ok(replies.length > 0, "Expected a reply");

        const lastReply = replies[replies.length - 1];
        assert.ok(lastReply.embeds, "Expected embed in error reply");
        const embed = lastReply.embeds[0];
        // Just verify there's an embed response when stats fail
        assert.ok(embed, "Expected an embed in the error response");
    });

    // Functionality tests
    it("should filter out non-guild members (guildMemberLevel <= 1)", async () => {
        mockGuildEnabled = true;
        mockUnitStatsEnabled = true;
        mockGuildData = createMockGuild();
        mockPlayerData = [
            createMockPlayer(111111111),
            createMockPlayer(222222222),
        ];        const interaction = createMockInteraction({
            optionsData: { allycode: "123456789" },
        } as any);

        const command = new GuildQuality();
        const ctx = createCommandContext({ interaction });
        await command.run(ctx);

        const replies = (interaction as any)._getReplies();
        const lastReply = replies[replies.length - 1];
        const embed = lastReply.embeds?.[0];
        const description = embed?.description || "";

        // Should only have 2 players (not the applicant)
        assert.ok(!description.includes("Applicant"), "Applicant should not appear in results");
    });

    it("should calculate mod quality correctly", async () => {
        mockGuildEnabled = true;
        mockUnitStatsEnabled = true;
        const player = createMockPlayer(111111111);
        const guild = createMockGuild({
            roster: [{ allyCode: 111111111, name: "Player1", guildMemberLevel: 3 } as any],
        });

        mockGuildData = guild;
        mockPlayerData = [player];        const interaction = createMockInteraction({
            optionsData: { allycode: "123456789" },
        } as any);

        const command = new GuildQuality();
        const ctx = createCommandContext({ interaction });
        await command.run(ctx);

        const replies = (interaction as any)._getReplies();
        const lastReply = replies[replies.length - 1];
        const embed = lastReply.embeds?.[0];
        const description = embed?.description || "";

        // Mod quality should be 0.04 (2 mods / 50 units of 100k GP)
        assert.ok(description.includes("0.04"), `Expected mod quality of 0.04, got: ${description}`);
    });

    it("should calculate gear quality correctly", async () => {
        mockGuildEnabled = true;
        mockUnitStatsEnabled = true;
        const player = createMockPlayer(111111111);
        const guild = createMockGuild({
            roster: [{ allyCode: 111111111, name: "Player1", guildMemberLevel: 3 } as any],
        });

        mockGuildData = guild;
        mockPlayerData = [player];        const interaction = createMockInteraction({
            optionsData: { allycode: "123456789" },
        } as any);

        const command = new GuildQuality();
        const ctx = createCommandContext({ interaction });
        await command.run(ctx);

        const replies = (interaction as any)._getReplies();
        const lastReply = replies[replies.length - 1];
        const embed = lastReply.embeds?.[0];
        const description = embed?.description || "";

        // Gear quality should be 0.055 (rounded to 0.05 or 0.06)
        assert.ok(description.includes("0.05") || description.includes("0.06"),
            `Expected gear quality around 0.05-0.06, got: ${description}`);
    });

    it("should calculate total quality correctly", async () => {
        mockGuildEnabled = true;
        mockUnitStatsEnabled = true;
        const player = createMockPlayer(111111111);
        const guild = createMockGuild({
            roster: [{ allyCode: 111111111, name: "Player1", guildMemberLevel: 3 } as any],
        });

        mockGuildData = guild;
        mockPlayerData = [player];        const interaction = createMockInteraction({
            optionsData: { allycode: "123456789" },
        } as any);

        const command = new GuildQuality();
        const ctx = createCommandContext({ interaction });
        await command.run(ctx);

        const replies = (interaction as any)._getReplies();
        const lastReply = replies[replies.length - 1];
        const embed = lastReply.embeds?.[0];
        const description = embed?.description || "";

        // Total quality should be modQuality + gearQuality (around 0.09-0.10)
        const totalQMatch = description.match(/\|\s+(\d+\.\d+)\s+\|.*Player111111111/);
        assert.ok(totalQMatch, "Expected to find total quality value");
        const totalQ = Number.parseFloat(totalQMatch[1]);
        assert.ok(totalQ > 0, "Total quality should be greater than 0");
    });

    it("should sort players by total quality descending", async () => {
        mockGuildEnabled = true;
        mockUnitStatsEnabled = true;

        // High quality player: lots of mods and high relic
        const player1 = createMockPlayer(111111111, {
            name: "HighQualityPlayer",
            stats: [
                { nameKey: "STAT_CHARACTER_GALACTIC_POWER_ACQUIRED_NAME", value: 5000000 },
                { nameKey: "STAT_GALACTIC_POWER_ACQUIRED_NAME", value: 8000000 },
            ],
            roster: [
                {
                    defId: "CHAR1",
                    gear: 13,
                    relic: { currentTier: 9 },
                    mods: [
                        {
                            slot: 1, set: 1, level: 15, pips: 5,
                            primaryStat: { unitStat: 48, value: 100 },
                            secondaryStat: [{ unitStat: 5, value: 25, roll: 0 }],
                        } as any,
                        {
                            slot: 2, set: 1, level: 15, pips: 5,
                            primaryStat: { unitStat: 48, value: 100 },
                            secondaryStat: [{ unitStat: 5, value: 20, roll: 0 }],
                        } as any,
                    ],
                } as any,
                {
                    defId: "CHAR2",
                    gear: 13,
                    relic: { currentTier: 7 },
                    mods: [
                        {
                            slot: 1, set: 1, level: 15, pips: 5,
                            primaryStat: { unitStat: 48, value: 100 },
                            secondaryStat: [{ unitStat: 5, value: 18, roll: 0 }],
                        } as any,
                    ],
                } as any,
            ],
        });

        // Low quality player: fewer mods, lower gear
        const player2 = createMockPlayer(222222222, {
            name: "LowQualityPlayer",
            stats: [
                { nameKey: "STAT_CHARACTER_GALACTIC_POWER_ACQUIRED_NAME", value: 2000000 },
                { nameKey: "STAT_GALACTIC_POWER_ACQUIRED_NAME", value: 3000000 },
            ],
            roster: [
                {
                    defId: "CHAR3",
                    gear: 11,
                    relic: { currentTier: 0 },
                    mods: [],
                } as any,
            ],
        });

        const guild = createMockGuild({
            roster: [
                { allyCode: 111111111, name: "HighQualityPlayer", guildMemberLevel: 3 } as any,
                { allyCode: 222222222, name: "LowQualityPlayer", guildMemberLevel: 3 } as any,
            ],
        });

        mockGuildData = guild;
        mockPlayerData = [player1, player2];        const interaction = createMockInteraction({
            optionsData: { allycode: "123456789" },
        } as any);

        const command = new GuildQuality();
        const ctx = createCommandContext({ interaction });
        await command.run(ctx);

        const replies = (interaction as any)._getReplies();
        const lastReply = replies[replies.length - 1];
        const embed = lastReply.embeds?.[0];
        const description = embed?.description || "";

        // Higher quality player should appear first
        const highPlayerIndex = description.indexOf("HighQualityPlayer");
        const lowPlayerIndex = description.indexOf("LowQualityPlayer");
        assert.ok(highPlayerIndex > 0 && lowPlayerIndex > 0, "Both players should be in description");
        assert.ok(highPlayerIndex < lowPlayerIndex,
            `Higher quality player should appear before lower quality player. Description: ${description}`);
    });

    it("should calculate guild averages correctly", async () => {
        mockGuildEnabled = true;
        mockUnitStatsEnabled = true;
        const player1 = createMockPlayer(111111111);
        const player2 = createMockPlayer(222222222);
        const guild = createMockGuild({
            roster: [
                { allyCode: 111111111, name: "Player1", guildMemberLevel: 3 } as any,
                { allyCode: 222222222, name: "Player2", guildMemberLevel: 3 } as any,
            ],
        });

        mockGuildData = guild;
        mockPlayerData = [player1, player2];        const interaction = createMockInteraction({
            optionsData: { allycode: "123456789" },
        } as any);

        const command = new GuildQuality();
        const ctx = createCommandContext({ interaction });
        await command.run(ctx);

        const replies = (interaction as any)._getReplies();
        const lastReply = replies[replies.length - 1];
        const embed = lastReply.embeds?.[0];

        // Check for Averages field
        const averagesField = embed?.fields?.find((f: any) => f.name === "Averages");
        assert.ok(averagesField, "Expected Averages field");
        assert.ok(averagesField.value.includes("Mod Quality:"), "Expected Mod Quality in averages");
        assert.ok(averagesField.value.includes("Gear Quality:"), "Expected Gear Quality in averages");
        assert.ok(averagesField.value.includes("Total Quality:"), "Expected Total Quality in averages");
    });

    // Output format tests
    it("should return properly formatted embed", async () => {
        mockGuildEnabled = true;
        mockUnitStatsEnabled = true;
        const player = createMockPlayer(111111111);
        const guild = createMockGuild({
            roster: [{ allyCode: 111111111, name: "Player1", guildMemberLevel: 3 } as any],
        });

        mockGuildData = guild;
        mockPlayerData = [player];        const interaction = createMockInteraction({
            optionsData: { allycode: "123456789" },
        } as any);

        const command = new GuildQuality();
        const ctx = createCommandContext({ interaction });
        await command.run(ctx);

        const replies = (interaction as any)._getReplies();
        assert.ok(replies.length > 0, "Expected at least one reply");

        const lastReply = replies[replies.length - 1];
        assert.ok(lastReply.embeds, "Expected embeds in reply");
        assert.ok(lastReply.embeds.length > 0, "Expected at least one embed");

        const embed = lastReply.embeds[0];
        assert.ok(embed.author, "Expected author in embed");
        assert.ok(embed.author.name.includes("Test Guild"), "Expected guild name in author");
        assert.ok(embed.description, "Expected description with player list");
        assert.ok(embed.fields, "Expected fields in embed");
    });

    it("should include header row in description", async () => {
        mockGuildEnabled = true;
        mockUnitStatsEnabled = true;
        const player = createMockPlayer(111111111);
        const guild = createMockGuild({
            roster: [{ allyCode: 111111111, name: "Player1", guildMemberLevel: 3 } as any],
        });

        mockGuildData = guild;
        mockPlayerData = [player];        const interaction = createMockInteraction({
            optionsData: { allycode: "123456789" },
        } as any);

        const command = new GuildQuality();
        const ctx = createCommandContext({ interaction });
        await command.run(ctx);

        const replies = (interaction as any)._getReplies();
        const embed = replies[replies.length - 1].embeds[0];
        const description = embed.description || "";

        assert.ok(description.includes("ModQ"), "Expected ModQ in header");
        assert.ok(description.includes("GearQ"), "Expected GearQ in header");
        assert.ok(description.includes("TotalQ"), "Expected TotalQ in header");
        assert.ok(description.includes("CharGP"), "Expected CharGP in header");
        assert.ok(description.includes("Name"), "Expected Name in header");
    });

    it("should display character GP in millions", async () => {
        mockGuildEnabled = true;
        mockUnitStatsEnabled = true;
        const player = createMockPlayer(111111111, {
            stats: [
                { nameKey: "STAT_CHARACTER_GALACTIC_POWER_ACQUIRED_NAME", value: 5500000 },
                { nameKey: "STAT_GALACTIC_POWER_ACQUIRED_NAME", value: 8000000 },
            ],
        });
        const guild = createMockGuild({
            roster: [{ allyCode: 111111111, name: "Player1", guildMemberLevel: 3 } as any],
        });

        mockGuildData = guild;
        mockPlayerData = [player];        const interaction = createMockInteraction({
            optionsData: { allycode: "123456789" },
        } as any);

        const command = new GuildQuality();
        const ctx = createCommandContext({ interaction });
        await command.run(ctx);

        const replies = (interaction as any)._getReplies();
        const embed = replies[replies.length - 1].embeds[0];
        const description = embed.description || "";

        // 5.5M character GP should be displayed
        assert.ok(description.includes("5.5M"), `Expected 5.5M in description, got: ${description}`);
    });

    it("should include Extra Info field with formulas", async () => {
        mockGuildEnabled = true;
        mockUnitStatsEnabled = true;
        const player = createMockPlayer(111111111);
        const guild = createMockGuild({
            roster: [{ allyCode: 111111111, name: "Player1", guildMemberLevel: 3 } as any],
        });

        mockGuildData = guild;
        mockPlayerData = [player];        const interaction = createMockInteraction({
            optionsData: { allycode: "123456789" },
        } as any);

        const command = new GuildQuality();
        const ctx = createCommandContext({ interaction });
        await command.run(ctx);

        const replies = (interaction as any)._getReplies();
        const embed = replies[replies.length - 1].embeds[0];

        const infoField = embed?.fields?.find((f: any) => f.name === "Extra Info");
        assert.ok(infoField, "Expected Extra Info field");
        assert.ok(infoField.value.includes("Mod Quality:"), "Expected Mod Quality formula");
        assert.ok(infoField.value.includes("Gear Quality:"), "Expected Gear Quality formula");
        assert.ok(infoField.value.includes("G13 Bonus"), "Expected G13 Bonus explanation");
    });

    it("should include warnings field when guild has warnings", async () => {
        mockGuildEnabled = true;
        mockUnitStatsEnabled = true;
        const player = createMockPlayer(111111111);
        const guild = createMockGuild({
            roster: [{ allyCode: 111111111, name: "Player1", guildMemberLevel: 3 } as any],
            warnings: ["Warning 1", "Warning 2"],
        });

        mockGuildData = guild;
        mockPlayerData = [player];        const interaction = createMockInteraction({
            optionsData: { allycode: "123456789" },
        } as any);

        const command = new GuildQuality();
        const ctx = createCommandContext({ interaction });
        await command.run(ctx);

        const replies = (interaction as any)._getReplies();
        const embed = replies[replies.length - 1].embeds[0];

        const warningsField = embed?.fields?.find((f: any) => f.name === "Warnings");
        assert.ok(warningsField, "Expected Warnings field");
        assert.ok(warningsField.value.includes("Warning 1"), "Expected first warning");
        assert.ok(warningsField.value.includes("Warning 2"), "Expected second warning");
    });

    it("should use provided ally code when given", async () => {
        mockGuildEnabled = true;
        mockUnitStatsEnabled = true;
        const player = createMockPlayer(111111111);
        const guild = createMockGuild({
            roster: [{ allyCode: 111111111, name: "Player1", guildMemberLevel: 3 } as any],
        });

        mockGuildData = guild;
        mockPlayerData = [player];        const interaction = createMockInteraction({
            optionsData: { allycode: "123456789" }, // Provide ally code
        } as any);

        const command = new GuildQuality();
        const ctx = createCommandContext({ interaction });
        await command.run(ctx);

        const replies = (interaction as any)._getReplies();
        const lastReply = replies[replies.length - 1];

        // Should successfully return guild quality
        assert.ok(lastReply.embeds, "Expected embed in reply");
        const embed = lastReply.embeds[0];
        assert.ok(embed, "Expected embed in response");
        // Verify it has content (either description or fields)
        assert.ok(embed.description || embed.fields?.length > 0, "Expected content in successful response");
    });

    it("should handle speed stat by name (UNITSTATSPEED)", async () => {
        mockGuildEnabled = true;
        mockUnitStatsEnabled = true;
        const playerWithNamedStat = createMockPlayer(111111111, {
            roster: [
                {
                    defId: "CHAR1",
                    gear: 13,
                    relic: { currentTier: 7 },
                    mods: [{
                        slot: 1, set: 1, level: 15, pips: 5,
                        primaryStat: { unitStat: 48, value: 100 },
                        secondaryStat: [
                            { unitStat: "UNITSTATSPEED" as any, value: 18, roll: 0 }, // Named stat instead of number 5
                        ],
                    } as any],
                } as any,
            ],
        });

        const guild = createMockGuild({
            roster: [{ allyCode: 111111111, name: "Player1", guildMemberLevel: 3 } as any],
        });

        mockGuildData = guild;
        mockPlayerData = [playerWithNamedStat];        const interaction = createMockInteraction({
            optionsData: { allycode: "123456789" },
        } as any);

        const command = new GuildQuality();
        const ctx = createCommandContext({ interaction });
        await command.run(ctx);

        const replies = (interaction as any)._getReplies();
        const lastReply = replies[replies.length - 1];
        const embed = lastReply.embeds?.[0];
        const description = embed?.description || "";

        // Should count the +18 speed mod (>=15)
        assert.ok(description.includes("0.02"), `Expected mod quality calculation to count UNITSTATSPEED, got: ${description}`);
    });
});
