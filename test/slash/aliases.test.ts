import assert from "node:assert";
import { after, before, describe, it } from "node:test";
import { MongoClient } from "mongodb";
import config from "../../config/config.ts";
import cache from "../../modules/cache.ts";
import Aliases from "../../slash/aliases.ts";
import { closeMongoClient, getMongoClient } from "../helpers/mongodb.ts";
import { createMockInteraction } from "../mocks/index.ts";

/**
 * Helper function to extract description from a reply embed.
 * Handles EmbedBuilder objects which store data in a 'data' property.
 */
function getReplyDescription(reply: any): string | undefined {
    return reply?.embeds?.[0]?.data?.description || reply?.embeds?.[0]?.description;
}

describe("Aliases Command Functionality", () => {
    let mongoClient: MongoClient;
    const testDbName = config.mongodb.swgohbotdb;

    before(async () => {
        // Get MongoDB client from testcontainer and initialize the cache module
        mongoClient = await getMongoClient();
        cache.init(mongoClient);
    });

    after(async () => {
        // Clean up test database
        try {
            await mongoClient.db(testDbName).collection("guildConfigs").deleteMany({});
        } catch (e) {
            // Ignore cleanup errors
        }
        await closeMongoClient();
    });

    describe("add subcommand", () => {
        it("should successfully add an alias for a valid character", async () => {            const command = new Aliases();

            const interaction = createMockInteraction({
                optionsData: {
                    _subcommand: "add",
                    unit: "TRIPLEZERO",  // Using actual character from data file
                    alias: "000",
                },
            });

            await command.run({ interaction, language: (interaction as any).language });

            // Verify the alias was saved to MongoDB
            const savedData = await cache.get(
                testDbName,
                "guildConfigs",
                { guildId: interaction.guild?.id }
            );

            assert.strictEqual(savedData.length, 1, "Expected one guild config to be saved");
            assert.ok(savedData[0].aliases, "Expected aliases array to exist");
            assert.strictEqual(savedData[0].aliases.length, 1, "Expected one alias");
            assert.strictEqual(savedData[0].aliases[0].alias, "000");
            assert.strictEqual(savedData[0].aliases[0].defId, "TRIPLEZERO");

            // Verify success message was sent
            const replies = (interaction as any)._getReplies();
            assert.strictEqual(replies.length, 1, "Expected one reply");
            const description = getReplyDescription(replies[0]);
            assert.ok(
                description?.includes("successfully submitted"),
                "Expected success message"
            );

            // Clean up
            await cache.remove(testDbName, "guildConfigs", { guildId: interaction.guild?.id });
        });

        it("should successfully add an alias for a valid ship", async () => {            const command = new Aliases();

            const interaction = createMockInteraction({
                optionsData: {
                    _subcommand: "add",
                    unit: "HOUNDSTOOTH",
                    alias: "HT",
                },
            });

            await command.run({ interaction, language: (interaction as any).language });

            // Verify the alias was saved to MongoDB
            const savedData = await cache.get(
                testDbName,
                "guildConfigs",
                { guildId: interaction.guild?.id }
            );

            assert.strictEqual(savedData[0].aliases.length, 1, "Expected one alias");
            assert.strictEqual(savedData[0].aliases[0].alias, "HT");
            assert.strictEqual(savedData[0].aliases[0].defId, "HOUNDSTOOTH");
            assert.strictEqual(savedData[0].aliases[0].name, "Hound's Tooth");

            // Clean up
            await cache.remove(testDbName, "guildConfigs", { guildId: interaction.guild?.id });
        });

        it("should return an error when unit does not exist", async () => {            const command = new Aliases();

            const interaction = createMockInteraction({
                optionsData: {
                    _subcommand: "add",
                    unit: "NONEXISTENTUNIT",
                    alias: "NEU",
                },
            });

            await command.run({ interaction, language: (interaction as any).language });

            const replies = (interaction as any)._getReplies();
            assert.strictEqual(replies.length, 1, "Expected one reply");
            // Check if embeds exist and extract description from EmbedBuilder
            assert.ok(replies[0].embeds, "Expected embeds in reply");
            assert.ok(replies[0].embeds[0], "Expected at least one embed");
            const description = replies[0].embeds[0].data?.description || replies[0].embeds[0].description;
            assert.ok(
                description?.includes("couldn't find a matching unit"),
                "Expected error message about unit not found"
            );
        });

        it("should return an error when alias is already in use", async () => {            const command = new Aliases();

            const interaction = createMockInteraction({
                optionsData: {
                    _subcommand: "add",
                    unit: "COMMANDERLUKESKYWALKER",
                    alias: "DV",
                },
            });

            // Pre-populate database with an existing alias
            await cache.put(
                testDbName,
                "guildConfigs",
                { guildId: interaction.guild?.id },
                {
                    aliases: [
                        { alias: "DV", defId: "DARTHVADER", name: "Darth Vader" },
                    ],
                } as never,
                false
            );

            await command.run({ interaction, language: (interaction as any).language });

            const replies = (interaction as any)._getReplies();
            assert.strictEqual(replies.length, 1, "Expected one reply");
            const description1 = getReplyDescription(replies[0]);
            assert.ok(
                description1?.includes("alias is already in use"),
                "Expected error message about duplicate alias"
            );

            // Clean up
            await cache.remove(testDbName, "guildConfigs", { guildId: interaction.guild?.id });
        });
    });

    describe("remove subcommand", () => {
        it("should successfully remove an existing alias", async () => {            const command = new Aliases();

            const interaction = createMockInteraction({
                optionsData: {
                    _subcommand: "remove",
                    alias: "DV",
                },
            });

            // Pre-populate database with aliases
            await cache.put(
                testDbName,
                "guildConfigs",
                { guildId: interaction.guild?.id },
                {
                    aliases: [
                        { alias: "DV", defId: "DARTHVADER", name: "Darth Vader" },
                        { alias: "CLS", defId: "COMMANDERLUKESKYWALKER", name: "Commander Luke Skywalker" },
                    ],
                } as never,
                false
            );

            await command.run({ interaction, language: (interaction as any).language });

            // Verify the alias was removed
            const savedData = await cache.get(
                testDbName,
                "guildConfigs",
                { guildId: interaction.guild?.id }
            );

            assert.strictEqual(savedData[0].aliases.length, 1, "Expected one alias remaining");
            assert.strictEqual(savedData[0].aliases[0].alias, "CLS");
            assert.strictEqual(savedData[0].aliases[0].defId, "COMMANDERLUKESKYWALKER");

            // Verify success message
            const replies = (interaction as any)._getReplies();
            assert.strictEqual(replies.length, 1, "Expected one reply");
            const description2 = getReplyDescription(replies[0]);
            assert.ok(
                description2?.includes("successfully removed"),
                "Expected success message"
            );

            // Clean up
            await cache.remove(testDbName, "guildConfigs", { guildId: interaction.guild?.id });
        });

        it("should return an error when trying to remove non-existent alias", async () => {            const command = new Aliases();

            const interaction = createMockInteraction({
                optionsData: {
                    _subcommand: "remove",
                    alias: "NONEXISTENT",
                },
            });

            // Pre-populate database with aliases (not including the one we'll try to remove)
            await cache.put(
                testDbName,
                "guildConfigs",
                { guildId: interaction.guild?.id },
                {
                    aliases: [
                        { alias: "CLS", defId: "COMMANDERLUKESKYWALKER", name: "Commander Luke Skywalker" },
                    ],
                } as never,
                false
            );

            await command.run({ interaction, language: (interaction as any).language });

            const replies = (interaction as any)._getReplies();
            assert.strictEqual(replies.length, 1, "Expected one reply");
            const description3 = getReplyDescription(replies[0]);
            assert.ok(
                description3?.includes("isn't a current alias"),
                "Expected error message about alias not existing"
            );

            // Clean up
            await cache.remove(testDbName, "guildConfigs", { guildId: interaction.guild?.id });
        });

        it("should remove alias and sort remaining aliases alphabetically", async () => {            const command = new Aliases();

            const interaction = createMockInteraction({
                optionsData: {
                    _subcommand: "remove",
                    alias: "MMM",
                },
            });

            // Pre-populate database with aliases in non-alphabetical order
            await cache.put(
                testDbName,
                "guildConfigs",
                { guildId: interaction.guild?.id },
                {
                    aliases: [
                        { alias: "ZZZ", defId: "UNIT3", name: "Unit 3" },
                        { alias: "AAA", defId: "UNIT1", name: "Unit 1" },
                        { alias: "MMM", defId: "UNIT2", name: "Unit 2" },
                    ],
                } as never,
                false
            );

            await command.run({ interaction, language: (interaction as any).language });

            // Verify aliases are sorted after removal
            const savedData = await cache.get(
                testDbName,
                "guildConfigs",
                { guildId: interaction.guild?.id }
            );

            assert.strictEqual(savedData[0].aliases.length, 2, "Expected two aliases remaining");
            assert.strictEqual(savedData[0].aliases[0].alias, "AAA", "Expected AAA to be first");
            assert.strictEqual(savedData[0].aliases[1].alias, "ZZZ", "Expected ZZZ to be second");

            // Clean up
            await cache.remove(testDbName, "guildConfigs", { guildId: interaction.guild?.id });
        });
    });

    describe("view subcommand", () => {
        it("should display all aliases when they exist", async () => {            const command = new Aliases();

            const interaction = createMockInteraction({
                optionsData: {
                    _subcommand: "view",
                },
            });

            // Pre-populate database with aliases
            await cache.put(
                testDbName,
                "guildConfigs",
                { guildId: interaction.guild?.id },
                {
                    aliases: [
                        { alias: "DV", defId: "DARTHVADER", name: "Darth Vader" },
                        { alias: "CLS", defId: "COMMANDERLUKESKYWALKER", name: "Commander Luke Skywalker" },
                    ],
                } as never,
                false
            );

            await command.run({ interaction, language: (interaction as any).language });

            const replies = (interaction as any)._getReplies();
            assert.strictEqual(replies.length, 1, "Expected one reply");
            assert.ok(replies[0].content, "Expected content in reply");
            assert.ok(
                replies[0].content.includes("DV - Darth Vader"),
                "Expected DV alias in view"
            );
            assert.ok(
                replies[0].content.includes("CLS - Commander Luke Skywalker"),
                "Expected CLS alias in view"
            );

            // Clean up
            await cache.remove(testDbName, "guildConfigs", { guildId: interaction.guild?.id });
        });

        it("should handle viewing when no aliases exist", async () => {            const command = new Aliases();

            const interaction = createMockInteraction({
                optionsData: {
                    _subcommand: "view",
                },
            });

            await command.run({ interaction, language: (interaction as any).language });

            const replies = (interaction as any)._getReplies();
            assert.strictEqual(replies.length, 1, "Expected one reply");
            // With no aliases, it will show ">>> - " (the formatting with an empty array)
            assert.ok(replies[0].content, "Expected content in reply");
        });
    });

    describe("guild-only behavior", () => {
        it("should return error when used outside of a guild", async () => {            const command = new Aliases();

            const interaction = createMockInteraction({
                guild: null,
                optionsData: {
                    _subcommand: "add",
                    unit: "DARTHVADER",
                    alias: "DV",
                },
            });

            await command.run({ interaction, language: (interaction as any).language });

            const replies = (interaction as any)._getReplies();
            assert.strictEqual(replies.length, 1, "Expected one reply");
            const description4 = getReplyDescription(replies[0]);
            assert.ok(
                description4?.includes("only usable in servers"),
                "Expected error about guild-only command"
            );
        });
    });
});
