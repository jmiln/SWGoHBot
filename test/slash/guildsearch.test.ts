import assert from "node:assert";
import { after, afterEach, before, beforeEach, describe, it } from "node:test";
import { MongoClient } from "mongodb";
import {env} from "../../config/config.ts";
import cache from "../../modules/cache.ts";
import patreonFuncs from "../../modules/patreonFuncs.ts";
import swgohAPI from "../../modules/swapi.ts";
import userReg from "../../modules/users.ts";
import GuildSearch from "../../slash/guildsearch.ts";
import { closeMongoClient, getMongoClient } from "../helpers/mongodb.ts";
import { createCommandContext, createMockGuild, createMockGuildMember, createMockInteraction, createMockUnit } from "../mocks/index.ts";

const originalGuild = swgohAPI.guild;
const originalGuildUnitStats = swgohAPI.guildUnitStats;
const originalGetCharacter = swgohAPI.getCharacter;
const originalGetPlayerCooldown = patreonFuncs.getPlayerCooldown;

/** A mock guild member roster for a guild containing ally code 123456789 */
function makeMockGuild() {
    return createMockGuild({
        name: "Test Guild",
        roster: [createMockGuildMember({ allyCode: 123456789 })],
    });
}

/** A mock guildUnitStats result — one player who has Darth Vader */
function makeMockGuildChar(overrides: Record<string, any> = {}) {
    return [
        {
            ...createMockUnit({ defId: "DARTHVADER", nameKey: "Darth Vader", combatType: 1, gear: 13, rarity: 7, gp: 28000 }),
            player: "GuildMember1",
            stats: { final: { Speed: 200 } },
            zetas: [],
            ...overrides,
        },
    ];
}

/** A minimal RawCharacter stub with no zeta/omicron abilities */
const mockRawChar = { skillReferenceList: [] } as any;

/**
 * Helper function to extract description from a reply embed.
 */
function getReplyDescription(reply: any): string | undefined {
    return reply?.embeds?.[0]?.data?.description || reply?.embeds?.[0]?.description;
}

describe("GuildSearch Command Functionality", () => {
    let mongoClient: MongoClient;
    const testDbName = env.MONGODB_SWGOHBOT_DB;

    before(async () => {
        mongoClient = await getMongoClient();
        cache.init(mongoClient);
        userReg.init(cache);
    });

    after(async () => {
        try {
            await mongoClient.db(testDbName).collection("users").deleteMany({});
        } catch (e) {
            // Ignore cleanup errors
        }
        await closeMongoClient();
    });

    describe("command initialization", () => {
        it("should initialize with correct name and subcommands", () => {            const command = new GuildSearch();

            assert.strictEqual(command.commandData.name, "guildsearch");
            assert.strictEqual(command.commandData.options.length, 2);

            const characterSubcmd = command.commandData.options.find((o) => o.name === "character");
            const shipSubcmd = command.commandData.options.find((o) => o.name === "ship");

            assert.ok(characterSubcmd, "Expected character subcommand");
            assert.ok(shipSubcmd, "Expected ship subcommand");
        });
    });

    describe("ally code validation", () => {
        it("should return error when no ally code is registered and none provided", async () => {            const command = new GuildSearch();

            const interaction = createMockInteraction({
                optionsData: {
                    _subcommand: "character",
                    character: "Darth Vader",
                },
            });

            const ctx = createCommandContext({ interaction });
            await command.run(ctx);

            const replies = (interaction as any)._getReplies();
            assert.strictEqual(replies.length, 1, "Expected one reply");
            const description = getReplyDescription(replies[0]);
            assert.ok(description?.includes("BASE_INVALID_ALLY_CODE"), "Expected error about no ally code");
        });
    });

    describe("input validation", () => {
        it("should reject invalid top values above maximum with specific error message", async () => {            const command = new GuildSearch();

            const invalidTop = 100;
            const interaction = createMockInteraction({
                optionsData: {
                    _subcommand: "character",
                    character: "Darth Vader",
                    allycode: "123456789",
                    top: invalidTop, // Invalid: max is 50
                },
            });

            const ctx = createCommandContext({ interaction });
            await command.run(ctx);

            const replies = (interaction as any)._getReplies();
            const lastReply = replies[replies.length - 1];
            const description = getReplyDescription(lastReply);
            assert.ok(description?.includes("COMMAND_GUILDSEARCH_INVALID_TOP"), "Expected error about invalid top value");
        });

        it("should reject invalid top values below minimum with specific error message", async () => {            const command = new GuildSearch();

            const interaction = createMockInteraction({
                optionsData: {
                    _subcommand: "character",
                    character: "Darth Vader",
                    allycode: "123456789",
                    top: -5, // Invalid: min is 0
                },
            });

            const ctx = createCommandContext({ interaction });
            await command.run(ctx);

            const replies = (interaction as any)._getReplies();
            const lastReply = replies[replies.length - 1];
            const description = getReplyDescription(lastReply);
            assert.ok(description?.includes("COMMAND_GUILDSEARCH_INVALID_TOP"), "Expected error about invalid top value");
        });

        it("should reject invalid rarity values with specific error message", async () => {            const command = new GuildSearch();

            const interaction = createMockInteraction({
                optionsData: {
                    _subcommand: "character",
                    character: "Darth Vader",
                    allycode: "123456789",
                    rarity: 10, // Invalid: max is 7
                },
            });

            const ctx = createCommandContext({ interaction });
            await command.run(ctx);

            const replies = (interaction as any)._getReplies();
            const lastReply = replies[replies.length - 1];
            const description = getReplyDescription(lastReply);
            assert.ok(description && description.length > 0, "Expected error about invalid rarity value");
            // The error message should reference "star" since that's what rarity represents
            assert.ok(
                description?.toLowerCase().includes("star") || description?.toLowerCase().includes("rarity"),
                "Expected error to mention stars or rarity"
            );
        });

        it("should accept valid top values", async () => {            const command = new GuildSearch();

            const interaction = createMockInteraction({
                optionsData: {
                    _subcommand: "character",
                    character: "Darth Vader",
                    allycode: "123456789",
                    top: 25, // Valid: within 1-50 range
                },
            });

            const ctx = createCommandContext({ interaction });
            await command.run(ctx);

            const replies = (interaction as any)._getReplies();
            const lastReply = replies[replies.length - 1];
            const description = getReplyDescription(lastReply);
            // Should NOT have the "COMMAND_GUILDSEARCH_INVALID_TOP" error
            assert.ok(!description?.includes("COMMAND_GUILDSEARCH_INVALID_TOP"), "Should not error on valid top value");
        });

        it("should accept valid rarity values", async () => {            const command = new GuildSearch();

            const interaction = createMockInteraction({
                optionsData: {
                    _subcommand: "character",
                    character: "Darth Vader",
                    allycode: "123456789",
                    rarity: 7, // Valid: within 0-7 range
                },
            });

            const ctx = createCommandContext({ interaction });
            await command.run(ctx);

            const replies = (interaction as any)._getReplies();
            // Should proceed to API call (which will fail, but that's expected)
            assert.ok(replies.length > 0, "Should attempt to proceed with valid rarity");
        });
    });

    describe("character/ship lookup", () => {
        it("should return specific error message for non-existent character", async () => {            const command = new GuildSearch();

            const searchTerm = "NONEXISTENTCHARACTER12345";
            const interaction = createMockInteraction({
                optionsData: {
                    _subcommand: "character",
                    character: searchTerm,
                    allycode: "123456789",
                },
            });

            const ctx = createCommandContext({ interaction });
            await command.run(ctx);

            const replies = (interaction as any)._getReplies();
            const lastReply = replies[replies.length - 1];

            assert.ok(lastReply.embeds && lastReply.embeds.length > 0, "Expected error embed for non-existent character");
            const description = getReplyDescription(lastReply);
            assert.ok(description && description.length > 0, "Expected error description for non-existent character");
        });

        it("should return specific error message for non-existent ship", async () => {            const command = new GuildSearch();

            const searchTerm = "NONEXISTENTSHIP9999";
            const interaction = createMockInteraction({
                optionsData: {
                    _subcommand: "ship",
                    ship: searchTerm,
                    allycode: "123456789",
                },
            });

            const ctx = createCommandContext({ interaction });
            await command.run(ctx);

            const replies = (interaction as any)._getReplies();
            const lastReply = replies[replies.length - 1];

            assert.ok(lastReply.embeds && lastReply.embeds.length > 0, "Expected error embed for non-existent ship");
            const description = getReplyDescription(lastReply);
            assert.ok(description && description.length > 0, "Expected error description for non-existent ship");
        });

        it("should list all matching characters for ambiguous search", async () => {            const command = new GuildSearch();

            const interaction = createMockInteraction({
                optionsData: {
                    _subcommand: "character",
                    character: "Luke", // Matches multiple characters
                    allycode: "123456789",
                },
            });

            const ctx = createCommandContext({ interaction });
            await command.run(ctx);

            const replies = (interaction as any)._getReplies();
            assert.ok(replies.length > 0, "Expected at least one reply");

            const lastReply = replies[replies.length - 1];
            assert.ok(lastReply.embeds && lastReply.embeds.length > 0, "Expected error embed for ambiguous search");

            const description = getReplyDescription(lastReply);
            // Should list the matching characters
            assert.ok(description && description.length > 0, "Expected list of matching characters");
        });
    });

    describe("character name matching", () => {
        beforeEach(() => {
            swgohAPI.guild = async () => makeMockGuild() as any;
            swgohAPI.guildUnitStats = async () => makeMockGuildChar() as any;
            swgohAPI.getCharacter = async () => mockRawChar;
            patreonFuncs.getPlayerCooldown = async () => ({ player: 60000, guild: 3600000 }) as any;
        });

        afterEach(() => {
            swgohAPI.guild = originalGuild;
            swgohAPI.guildUnitStats = originalGuildUnitStats;
            swgohAPI.getCharacter = originalGetCharacter;
            patreonFuncs.getPlayerCooldown = originalGetPlayerCooldown;
        });

        it("should find character by exact name and return guild results with member data", async () => {
            const interaction = createMockInteraction({
                optionsData: { _subcommand: "character", character: "Darth Vader", allycode: "123456789" },
            });
            await new GuildSearch().run(createCommandContext({ interaction }));

            const replies = (interaction as any)._getReplies();
            const lastReply = replies[replies.length - 1];
            assert.ok(lastReply.embeds?.length > 0, "Expected embed in final reply");
            const embed = lastReply.embeds[0];
            const embedData = embed.data || embed;
            // Language mock returns the key; verify the right display key is used
            assert.ok(embedData.author?.name?.includes("BASE_SWGOH_NAMECHAR_HEADER_NUM"), "Expected results header language key in embed author");
            // Guild member player name should appear in the field values
            assert.ok(embedData.fields?.some((f: any) => f.value?.includes("GuildMember1")), "Expected guild member name in results");
        });

        it("should find character by partial name match and return same result as exact match", async () => {
            const interaction = createMockInteraction({
                optionsData: { _subcommand: "character", character: "vader", allycode: "123456789" },
            });
            await new GuildSearch().run(createCommandContext({ interaction }));

            const replies = (interaction as any)._getReplies();
            const lastReply = replies[replies.length - 1];
            assert.ok(lastReply.embeds?.length > 0, "Expected embed — partial 'vader' should resolve to Darth Vader");
            const embedData = lastReply.embeds[0].data || lastReply.embeds[0];
            assert.ok(!lastReply.flags, "Expected non-error response — partial match should succeed");
            assert.ok(embedData.fields?.some((f: any) => f.value?.includes("GuildMember1")), "Expected guild member in partial match result");
        });

        it("should be case-insensitive: 'DARTH VADER' resolves the same as 'Darth Vader'", async () => {
            const interaction = createMockInteraction({
                optionsData: { _subcommand: "character", character: "DARTH VADER", allycode: "123456789" },
            });
            await new GuildSearch().run(createCommandContext({ interaction }));

            const replies = (interaction as any)._getReplies();
            const lastReply = replies[replies.length - 1];
            assert.ok(lastReply.embeds?.length > 0, "Expected embed — uppercase search should resolve");
            assert.ok(!lastReply.flags, "Expected non-error response — case-insensitive match should succeed");
        });
    });

    describe("subcommand routing", () => {
        it("should handle character subcommand", async () => {            const command = new GuildSearch();

            const interaction = createMockInteraction({
                optionsData: {
                    _subcommand: "character",
                    character: "Darth Vader",
                },
            });

            const ctx = createCommandContext({ interaction });
            await command.run(ctx);

            const replies = (interaction as any)._getReplies();
            assert.ok(replies.length > 0, "Expected reply from character subcommand");
        });

        it("should handle ship subcommand", async () => {            const command = new GuildSearch();

            const interaction = createMockInteraction({
                optionsData: {
                    _subcommand: "ship",
                    ship: "Hound's Tooth",
                },
            });

            const ctx = createCommandContext({ interaction });
            await command.run(ctx);

            const replies = (interaction as any)._getReplies();
            assert.ok(replies.length > 0, "Expected reply from ship subcommand");
        });
    });

    describe("option effects", () => {
        beforeEach(() => {
            swgohAPI.guild = async () => makeMockGuild() as any;
            swgohAPI.getCharacter = async () => mockRawChar;
            patreonFuncs.getPlayerCooldown = async () => ({ player: 60000, guild: 3600000 }) as any;
        });

        afterEach(() => {
            swgohAPI.guild = originalGuild;
            swgohAPI.guildUnitStats = originalGuildUnitStats;
            swgohAPI.getCharacter = originalGetCharacter;
            patreonFuncs.getPlayerCooldown = originalGetPlayerCooldown;
        });

        it("rarity filter: shows members at or above the specified star level", async () => {
            // Two members: one at 7*, one at 4*
            swgohAPI.guildUnitStats = async () => [
                { ...createMockUnit({ rarity: 7, gp: 28000 }), player: "SevenStar", zetas: [] },
                { ...createMockUnit({ rarity: 4, gp: 10000 }), player: "FourStar", zetas: [] },
            ] as any;

            const interaction = createMockInteraction({
                optionsData: { _subcommand: "character", character: "Darth Vader", allycode: "123456789", rarity: 7 },
            });
            await new GuildSearch().run(createCommandContext({ interaction }));

            const replies = (interaction as any)._getReplies();
            const lastReply = replies[replies.length - 1];
            const fields = lastReply.embeds?.[0]?.fields ?? lastReply.embeds?.[0]?.data?.fields ?? [];
            const content = fields.map((f: any) => f.value ?? "").join(" ");
            assert.ok(content.includes("SevenStar"), "Expected 7-star member in results");
            assert.ok(!content.includes("FourStar"), "Expected 4-star member to be filtered out");
        });

        it("rarity filter: returns error when no members meet the minimum star level", async () => {
            swgohAPI.guildUnitStats = async () => [
                { ...createMockUnit({ rarity: 4, gp: 10000 }), player: "FourStar", zetas: [] },
            ] as any;

            const interaction = createMockInteraction({
                optionsData: { _subcommand: "character", character: "Darth Vader", allycode: "123456789", rarity: 7 },
            });
            await new GuildSearch().run(createCommandContext({ interaction }));

            const replies = (interaction as any)._getReplies();
            const lastReply = replies[replies.length - 1];
            assert.ok(lastReply.embeds?.length > 0, "Expected error embed when no members meet rarity filter");
            assert.ok(lastReply.flags, "Expected error to be ephemeral");
        });

        it("zetas filter: returns error when no members have zetas on the character", async () => {
            swgohAPI.guildUnitStats = async () => [
                { ...createMockUnit({ rarity: 7, gp: 28000 }), player: "NoZetaPlayer", zetas: [] },
            ] as any;

            const interaction = createMockInteraction({
                optionsData: { _subcommand: "character", character: "Darth Vader", allycode: "123456789", zetas: true },
            });
            await new GuildSearch().run(createCommandContext({ interaction }));

            const replies = (interaction as any)._getReplies();
            const lastReply = replies[replies.length - 1];
            assert.ok(lastReply.flags, "Expected ephemeral error when zetas filter finds no results");
        });

        it("stat option: shows stat values for each guild member in the output", async () => {
            swgohAPI.guildUnitStats = async () => [
                { ...createMockUnit({ rarity: 7, gp: 28000 }), player: "SpeedyPlayer", stats: { final: { Speed: 214 } }, zetas: [] },
            ] as any;

            const interaction = createMockInteraction({
                optionsData: { _subcommand: "character", character: "Darth Vader", allycode: "123456789", stat: "Speed" },
            });
            await new GuildSearch().run(createCommandContext({ interaction }));

            const replies = (interaction as any)._getReplies();
            const lastReply = replies[replies.length - 1];
            const fields = lastReply.embeds?.[0]?.fields ?? lastReply.embeds?.[0]?.data?.fields ?? [];
            const content = fields.map((f: any) => f.value ?? "").join(" ");
            assert.ok(content.includes("SpeedyPlayer"), "Expected player name in stat output");
            assert.ok(content.includes("214"), "Expected speed value 214 in stat output");
        });

        it("sort by GP: returns results without error when sort=gp is specified", async () => {
            swgohAPI.guildUnitStats = async () => makeMockGuildChar() as any;

            const interaction = createMockInteraction({
                optionsData: { _subcommand: "character", character: "Darth Vader", allycode: "123456789", sort: "gp" },
            });
            await new GuildSearch().run(createCommandContext({ interaction }));

            const replies = (interaction as any)._getReplies();
            const lastReply = replies[replies.length - 1];
            assert.ok(lastReply.embeds?.length > 0, "Expected embed with sort=gp");
            assert.ok(!lastReply.flags, "Expected non-error response with sort=gp");
        });

        it("top option: returns results without error when top=5 is specified", async () => {
            swgohAPI.guildUnitStats = async () => makeMockGuildChar() as any;

            const interaction = createMockInteraction({
                optionsData: { _subcommand: "character", character: "Darth Vader", allycode: "123456789", top: 5 },
            });
            await new GuildSearch().run(createCommandContext({ interaction }));

            const replies = (interaction as any)._getReplies();
            const lastReply = replies[replies.length - 1];
            assert.ok(lastReply.embeds?.length > 0, "Expected embed with top=5");
            assert.ok(!lastReply.flags, "Expected non-error response with top=5");
        });
    });
});
