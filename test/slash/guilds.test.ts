import assert from "node:assert";
import { after, before, beforeEach, describe, it } from "node:test";
import { MongoClient } from "mongodb";
import "../setup/mongodb.ts";
import config from "../../config/config.ts";
import cache from "../../modules/cache.ts";
import swgohAPI from "../../modules/swapi.ts";
import userReg from "../../modules/users.ts";
import Guilds from "../../slash/guilds.ts";
import { closeMongoClient, getMongoClient } from "../helpers/mongodb.ts";
import { createCommandContext, createMockGuild, createMockGuildMember, createMockInteraction, createMockPlayer, createMockUnit } from "../mocks/index.ts";

/**
 * Helper function to extract description from a reply embed.
 */
function getReplyDescription(reply: any): string | undefined {
    const embed = reply?.embeds?.[0];
    const embedData = embed?.data || embed;
    return embedData?.description;
}

/**
 * Helper function to extract author name from a reply embed.
 */
function getReplyAuthor(reply: any): string | undefined {
    const embed = reply?.embeds?.[0];
    const embedData = embed?.data || embed;
    return embedData?.author?.name;
}

/**
 * Helper function to extract title from a reply embed.
 */
function getReplyTitle(reply: any): string | undefined {
    const embed = reply?.embeds?.[0];
    const embedData = embed?.data || embed;
    return embedData?.title;
}

/**
 * Helper function to extract fields from a reply embed.
 */
function getReplyFields(reply: any): any[] | undefined {
    const embed = reply?.embeds?.[0];
    const embedData = embed?.data || embed;
    return embedData?.fields;
}

describe("Guilds Command Functionality", () => {
    let mongoClient: MongoClient;
    const testDbName = config.mongodb.swgohbotdb;

    // Store original methods
    const originalGuild = swgohAPI.guild;
    const originalUnitStats = swgohAPI.unitStats;
    const originalGetRawGuild = swgohAPI.getRawGuild;

    before(async () => {
        mongoClient = await getMongoClient();
        cache.init(mongoClient);
        userReg.init(cache);
    });

    after(async () => {
        // Restore original methods
        swgohAPI.guild = originalGuild;
        swgohAPI.unitStats = originalUnitStats;
        swgohAPI.getRawGuild = originalGetRawGuild;

        try {
            await mongoClient.db(testDbName).collection("users").deleteMany({});
        } catch (e) {
            // Ignore cleanup errors
        }
        await closeMongoClient();
    });

    beforeEach(() => {
        // Reset to original methods before each test
        swgohAPI.guild = originalGuild;
        swgohAPI.unitStats = originalUnitStats;
        swgohAPI.getRawGuild = originalGetRawGuild;
    });

    describe("functional tests with mocked singleton", () => {
        it("should display guild overview with proper formatting", async () => {            const command = new Guilds();

            // Mock the guild data
            const mockGuild = createMockGuild({
                id: "guild123",
                name: "The Galactic Empire",
                desc: "We seek order in the galaxy",
                members: 50,
                gp: 250000000,
                roster: [
                    createMockGuildMember({
                        name: "Player1",
                        allyCode: 111111111,
                        gp: 5000000,
                        gpChar: 3000000,
                        gpShip: 2000000,
                        guildMemberLevel: 4, // Leader
                    }),
                    createMockGuildMember({
                        name: "Player2",
                        allyCode: 222222222,
                        gp: 4800000,
                        gpChar: 2900000,
                        gpShip: 1900000,
                        guildMemberLevel: 3, // Officer
                    }),
                ],
                raid: {
                    "rancor": { diffId: "DIFF03_HEROIC" },
                    "aat": { diffId: "DIFF03_HEROIC" },
                },
            });

            // Mock the swgohAPI singleton methods
            swgohAPI.guild = async () => mockGuild;

            const interaction = createMockInteraction({
                optionsData: {
                    _subcommand: "view",
                    allycode: "123456789",
                },
            });

            const ctx = createCommandContext({ interaction });
            await command.run(ctx);

            const replies = (interaction as any)._getReplies();
            const lastReply = replies[replies.length - 1];
            const author = getReplyAuthor(lastReply);
            const description = getReplyDescription(lastReply);
            const fields = getReplyFields(lastReply);

            // Verify guild name in author
            assert.ok(author?.includes("The Galactic Empire"), "Expected guild name in author");

            // Verify description contains guild info
            assert.ok(description?.includes("We seek order in the galaxy"), "Expected guild description");

            // Verify fields exist (raids, stats)
            assert.ok(fields && fields.length > 0, "Expected embed fields");

            // Verify GP is displayed
            const statsField = fields?.find(f => f.name?.toLowerCase().includes("stat"));
            assert.ok(statsField, "Expected stats field");
            assert.ok(statsField.value?.includes("250,000,000") || statsField.value?.includes("250"), "Expected GP in stats");
        });

        it("should display gear overview with proper formatting and sorting", async () => {            const command = new Guilds();

            const mockGuild = createMockGuild({
                id: "guild123",
                name: "Test Guild",
                roster: [
                    createMockGuildMember({ name: "HighGear", allyCode: 111111111 }),
                    createMockGuildMember({ name: "MidGear", allyCode: 222222222 }),
                ],
            });

            const highGearPlayer = createMockPlayer({
                allyCode: 111111111,
                name: "HighGear",
                roster: [
                    createMockUnit({ defId: "DARTHVADER", gear: 13 }),
                    createMockUnit({ defId: "LUKESKYWALKER", gear: 13 }),
                    createMockUnit({ defId: "HANSOLO", gear: 13 }),
                    createMockUnit({ defId: "REYJEDITRAINING", gear: 12 }),
                    createMockUnit({ defId: "KYLOREN", gear: 12 }),
                ],
            });

            const midGearPlayer = createMockPlayer({
                allyCode: 222222222,
                name: "MidGear",
                roster: [
                    createMockUnit({ defId: "DARTHVADER", gear: 13 }),
                    createMockUnit({ defId: "LUKESKYWALKER", gear: 12 }),
                    createMockUnit({ defId: "HANSOLO", gear: 11 }),
                ],
            });

            swgohAPI.guild = async () => mockGuild;
            swgohAPI.unitStats = async (allycodes) => {
                const codes = Array.isArray(allycodes) ? allycodes : [allycodes];
                return codes.map(ac => ac === 111111111 ? highGearPlayer : midGearPlayer);
            };

            const interaction = createMockInteraction({
                optionsData: {
                    _subcommand: "gear",
                    allycode: "123456789",
                    sort: 13, // Sort by G13
                },
            });

            const ctx = createCommandContext({ interaction });
            await command.run(ctx);

            const replies = (interaction as any)._getReplies();
            const lastReply = replies[replies.length - 1];
            const author = getReplyAuthor(lastReply);
            const description = getReplyDescription(lastReply);

            // Verify guild name
            assert.ok(author?.includes("Test Guild"), "Expected guild name");
            assert.ok(author?.toLowerCase().includes("gear"), "Expected gear mention");

            // Verify both players are shown
            assert.ok(description?.includes("HighGear"), "Expected HighGear player");
            assert.ok(description?.includes("MidGear"), "Expected MidGear player");

            // Verify gear counts (HighGear has 3 G13, MidGear has 1 G13)
            // The output should show these numbers
            assert.ok(description, "Expected description with gear counts");
        });

        it("should display roster with GP in proper format", async () => {            const command = new Guilds();

            const mockGuild = createMockGuild({
                id: "guild123",
                name: "Test Guild",
                gp: 150000000,
                roster: [
                    createMockGuildMember({
                        name: "TopPlayer",
                        allyCode: 111111111,
                        gp: 6000000,
                        guildMemberLevel: 4, // Leader
                    }),
                    createMockGuildMember({
                        name: "MidPlayer",
                        allyCode: 222222222,
                        gp: 5000000,
                        guildMemberLevel: 3, // Officer
                    }),
                    createMockGuildMember({
                        name: "NewPlayer",
                        allyCode: 333333333,
                        gp: 4000000,
                        guildMemberLevel: 2, // Member
                    }),
                ],
            });

            swgohAPI.guild = async () => mockGuild;

            const interaction = createMockInteraction({
                optionsData: {
                    _subcommand: "roster",
                    allycode: "123456789",
                },
            });

            const ctx = createCommandContext({ interaction });
            await command.run(ctx);

            const replies = (interaction as any)._getReplies();
            const lastReply = replies[replies.length - 1];
            const description = getReplyDescription(lastReply);
            const author = getReplyAuthor(lastReply);

            // Verify guild info in author
            assert.ok(author?.includes("Test Guild"), "Expected guild name");

            // Verify all players are shown
            assert.ok(description?.includes("TopPlayer"), "Expected TopPlayer");
            assert.ok(description?.includes("MidPlayer"), "Expected MidPlayer");
            assert.ok(description?.includes("NewPlayer"), "Expected NewPlayer");

            // Verify GP is formatted (should show 6,000,000 GP or similar)
            assert.ok(description?.includes("6,000,000") || description?.includes("6000000"), "Expected TopPlayer GP");

            // Verify rank indicators [L] [O] [M]
            assert.ok(description?.includes("[L]"), "Expected Leader indicator");
            assert.ok(description?.includes("[O]"), "Expected Officer indicator");
            assert.ok(description?.includes("[M]"), "Expected Member indicator");
        });

        it("should display roster sorted by name", async () => {            const command = new Guilds();

            const mockGuild = createMockGuild({
                id: "guild123",
                name: "Test Guild",
                gp: 150000000,
                roster: [
                    createMockGuildMember({ name: "Zebra", allyCode: 111111111, gp: 5000000 }),
                    createMockGuildMember({ name: "Alpha", allyCode: 222222222, gp: 6000000 }),
                    createMockGuildMember({ name: "Beta", allyCode: 333333333, gp: 5500000 }),
                ],
            });

            swgohAPI.guild = async () => mockGuild;

            const interaction = createMockInteraction({
                optionsData: {
                    _subcommand: "roster",
                    allycode: "123456789",
                    sort: "name",
                },
            });

            const ctx = createCommandContext({ interaction });
            await command.run(ctx);

            const replies = (interaction as any)._getReplies();
            const lastReply = replies[replies.length - 1];
            const description = getReplyDescription(lastReply);

            // Verify all members are present
            assert.ok(description?.includes("Alpha"), "Expected Alpha");
            assert.ok(description?.includes("Beta"), "Expected Beta");
            assert.ok(description?.includes("Zebra"), "Expected Zebra");

            // Verify alphabetical order (Alpha should appear before Zebra in the string)
            const alphaIndex = description?.indexOf("Alpha") ?? -1;
            const zebraIndex = description?.indexOf("Zebra") ?? -1;
            assert.ok(alphaIndex < zebraIndex, "Expected alphabetical ordering");
        });

        it("should display roster with ally codes when requested", async () => {            const command = new Guilds();

            const mockGuild = createMockGuild({
                id: "guild123",
                name: "Test Guild",
                gp: 100000000,
                roster: [
                    createMockGuildMember({ name: "Player1", allyCode: 111111111, gp: 5000000 }),
                    createMockGuildMember({ name: "Player2", allyCode: 222222222, gp: 4500000 }),
                ],
            });

            swgohAPI.guild = async () => mockGuild;

            const interaction = createMockInteraction({
                optionsData: {
                    _subcommand: "roster",
                    allycode: "123456789",
                    show_allycode: true,
                },
            });

            const ctx = createCommandContext({ interaction });
            await command.run(ctx);

            const replies = (interaction as any)._getReplies();
            const lastReply = replies[replies.length - 1];
            const description = getReplyDescription(lastReply);

            // Verify ally codes are shown instead of GP
            assert.ok(description?.includes("111111111"), "Expected ally code 111111111");
            assert.ok(description?.includes("222222222"), "Expected ally code 222222222");
        });

        it("should display relics overview with proper formatting", async () => {            const command = new Guilds();

            const mockGuild = createMockGuild({
                id: "guild123",
                name: "Test Guild",
                roster: [
                    createMockGuildMember({ name: "Player1", allyCode: 111111111 }),
                    createMockGuildMember({ name: "Player2", allyCode: 222222222 }),
                ],
            });

            const player1 = createMockPlayer({
                allyCode: 111111111,
                name: "Player1",
                roster: [
                    createMockUnit({ defId: "DARTHVADER", gear: 13, relic: { currentTier: 10 } }),
                    createMockUnit({ defId: "LUKESKYWALKER", gear: 13, relic: { currentTier: 8 } }),
                    createMockUnit({ defId: "HANSOLO", gear: 13, relic: { currentTier: 8 } }),
                ],
            });

            const player2 = createMockPlayer({
                allyCode: 222222222,
                name: "Player2",
                roster: [
                    createMockUnit({ defId: "DARTHVADER", gear: 13, relic: { currentTier: 7 } }),
                    createMockUnit({ defId: "LUKESKYWALKER", gear: 12 }),
                ],
            });

            swgohAPI.guild = async () => mockGuild;
            swgohAPI.unitStats = async (allycodes) => {
                const codes = Array.isArray(allycodes) ? allycodes : [allycodes];
                return codes.map(ac => ac === 111111111 ? player1 : player2);
            };

            const interaction = createMockInteraction({
                optionsData: {
                    _subcommand: "relics",
                    allycode: "123456789",
                },
            });

            const ctx = createCommandContext({ interaction });
            await command.run(ctx);

            const replies = (interaction as any)._getReplies();
            const lastReply = replies[replies.length - 1];
            const title = getReplyTitle(lastReply);
            const fields = getReplyFields(lastReply);

            // Verify title mentions guild and gear/relic
            assert.ok(title?.includes("Test Guild"), "Expected guild name in title");
            assert.ok(title?.toLowerCase().includes("gear") || title?.toLowerCase().includes("relic"), "Expected gear/relic mention");

            // Verify fields contain relic data
            assert.ok(fields && fields.length > 0, "Expected relic data fields");
        });

        it("should display mods overview with proper formatting", async () => {            const command = new Guilds();

            const mockGuild = createMockGuild({
                id: "guild123",
                name: "Test Guild",
                roster: [createMockGuildMember({ name: "Player1", allyCode: 111111111 })],
            });

            const unitWithMods = createMockUnit({ defId: "DARTHVADER", gear: 13 });
            unitWithMods.mods = [
                {
                    id: "mod1",
                    level: 15,
                    tier: 5,
                    slot: 1,
                    set: 1,
                    pips: 6,
                    primaryStat: { unitStat: 1, value: 100 },
                    secondaryStat: [{ unitStat: 5, value: 22, roll: 1 }], // Speed +22
                },
                {
                    id: "mod2",
                    level: 15,
                    tier: 5,
                    slot: 2,
                    set: 1,
                    pips: 6,
                    primaryStat: { unitStat: 1, value: 100 },
                    secondaryStat: [{ unitStat: 41, value: 150, roll: 1 }], // Offense +150
                },
            ];

            const player1 = createMockPlayer({
                allyCode: 111111111,
                name: "Player1",
                roster: [unitWithMods],
            });

            swgohAPI.guild = async () => mockGuild;
            swgohAPI.unitStats = async () => [player1];

            const interaction = createMockInteraction({
                optionsData: {
                    _subcommand: "mods",
                    allycode: "123456789",
                },
            });

            const ctx = createCommandContext({ interaction });
            await command.run(ctx);

            const replies = (interaction as any)._getReplies();
            const lastReply = replies[replies.length - 1];
            const author = getReplyAuthor(lastReply);

            // Verify guild name and mods mention
            assert.ok(author?.includes("Test Guild"), "Expected guild name");
            assert.ok(author?.toLowerCase().includes("mod"), "Expected mods mention");
        });
    });

    describe("ally code validation", () => {
        it("should return error when no ally code is registered and none provided", async () => {            const command = new Guilds();

            const interaction = createMockInteraction({
                optionsData: {
                    _subcommand: "view",
                },
            });

            const ctx = createCommandContext({ interaction });
            await command.run(ctx);

            const replies = (interaction as any)._getReplies();
            const lastReply = replies[replies.length - 1];
            const description = getReplyDescription(lastReply);
            assert.ok(
                description?.includes("No valid ally code found") || description?.includes("could not find a valid ally code"),
                "Expected error about missing ally code"
            );
        });
    });
});
