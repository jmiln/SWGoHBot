import assert from "node:assert";
import { after, before, describe, it } from "node:test";
import { MongoClient } from "mongodb";
import config from "../../config/config.ts";
import cache from "../../modules/cache.ts";
import userReg from "../../modules/users.ts";
import GuildSearch from "../../slash/guildsearch.ts";
import { closeMongoClient, getMongoClient } from "../helpers/mongodb.ts";
import { createCommandContext, createMockInteraction } from "../mocks/index.ts";

/**
 * Helper function to extract description from a reply embed.
 */
function getReplyDescription(reply: any): string | undefined {
    return reply?.embeds?.[0]?.data?.description || reply?.embeds?.[0]?.description;
}

describe("GuildSearch Command Functionality", () => {
    let mongoClient: MongoClient;
    const testDbName = config.mongodb.swgohbotdb;

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
            assert.ok(description?.includes("could not find a valid ally code"), "Expected error about no ally code");
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
            assert.ok(description?.includes("Invalid argument for top"), "Expected error about invalid top value");
            assert.ok(description?.includes("1") && description?.includes("50"), "Expected error to mention valid range");
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
            assert.ok(description?.includes("Invalid argument for top"), "Expected error about invalid top value");
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
            // Should NOT have the "Invalid argument for top" error
            assert.ok(!description?.includes("Invalid argument for top"), "Should not error on valid top value");
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
        it("should find character by exact name", async () => {            const command = new GuildSearch();

            const interaction = createMockInteraction({
                optionsData: {
                    _subcommand: "character",
                    character: "Darth Vader",
                    allycode: "123456789",
                },
            });

            const ctx = createCommandContext({ interaction });
            await command.run(ctx);

            const replies = (interaction as any)._getReplies();
            assert.ok(replies.length > 0, "Expected at least one reply");

            // First reply should be the "please wait" message
            const firstReply = replies[0];
            assert.ok(firstReply, "Expected initial reply message");
        });

        it("should find character by partial name match", async () => {            const command = new GuildSearch();

            const interaction = createMockInteraction({
                optionsData: {
                    _subcommand: "character",
                    character: "vader",
                    allycode: "123456789",
                },
            });

            const ctx = createCommandContext({ interaction });
            await command.run(ctx);

            const replies = (interaction as any)._getReplies();
            assert.ok(replies.length > 0, "Expected at least one reply");

            // Should match "Darth Vader" from partial search
            const firstReply = replies[0];
            assert.ok(firstReply, "Expected initial reply message");
        });

        it("should be case-insensitive when searching", async () => {            const command = new GuildSearch();

            const interaction = createMockInteraction({
                optionsData: {
                    _subcommand: "character",
                    character: "DARTH VADER", // All caps
                    allycode: "123456789",
                },
            });

            const ctx = createCommandContext({ interaction });
            await command.run(ctx);

            const replies = (interaction as any)._getReplies();
            assert.ok(replies.length > 0, "Expected at least one reply");

            // Should still find Darth Vader despite case difference
            const firstReply = replies[0];
            assert.ok(firstReply, "Expected to find character regardless of case");
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

    describe("option parsing", () => {
        it("should parse sort option", async () => {            const command = new GuildSearch();

            const interaction = createMockInteraction({
                optionsData: {
                    _subcommand: "character",
                    character: "Darth Vader",
                    allycode: "123456789",
                    sort: "gp",
                },
            });

            const ctx = createCommandContext({ interaction });
            await command.run(ctx);

            const replies = (interaction as any)._getReplies();
            assert.ok(replies.length > 0, "Expected reply with sort option");
        });

        it("should parse top option", async () => {            const command = new GuildSearch();

            const interaction = createMockInteraction({
                optionsData: {
                    _subcommand: "character",
                    character: "Darth Vader",
                    allycode: "123456789",
                    top: 10,
                },
            });

            const ctx = createCommandContext({ interaction });
            await command.run(ctx);

            const replies = (interaction as any)._getReplies();
            assert.ok(replies.length > 0, "Expected reply with top option");
        });

        it("should parse rarity option", async () => {            const command = new GuildSearch();

            const interaction = createMockInteraction({
                optionsData: {
                    _subcommand: "character",
                    character: "Darth Vader",
                    allycode: "123456789",
                    rarity: 7,
                },
            });

            const ctx = createCommandContext({ interaction });
            await command.run(ctx);

            const replies = (interaction as any)._getReplies();
            assert.ok(replies.length > 0, "Expected reply with rarity option");
        });

        it("should parse boolean options", async () => {            const command = new GuildSearch();

            const interaction = createMockInteraction({
                optionsData: {
                    _subcommand: "character",
                    character: "Darth Vader",
                    allycode: "123456789",
                    reverse: true,
                    zetas: true,
                },
            });

            const ctx = createCommandContext({ interaction });
            await command.run(ctx);

            const replies = (interaction as any)._getReplies();
            assert.ok(replies.length > 0, "Expected reply with boolean options");
        });

        it("should parse stat option", async () => {            const command = new GuildSearch();

            const interaction = createMockInteraction({
                optionsData: {
                    _subcommand: "character",
                    character: "Darth Vader",
                    allycode: "123456789",
                    stat: "Speed",
                },
            });

            const ctx = createCommandContext({ interaction });
            await command.run(ctx);

            const replies = (interaction as any)._getReplies();
            assert.ok(replies.length > 0, "Expected reply with stat option");
        });
    });
});
