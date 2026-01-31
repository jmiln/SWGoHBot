import assert from "node:assert";
import { beforeEach, describe, it } from "node:test";
import Faction from "../../slash/faction.ts";
import cache from "../../modules/cache.ts";
import { createMockBot, createMockInteraction } from "../mocks/index.ts";
import { assertErrorReply } from "./helpers.ts";

// Storage for mock cache data that can be set per test
let mockCacheData: any[] = [];

// Helper to set mock cache data for a test
function setMockCacheData(data: any[]) {
    mockCacheData = data;
}

// Mock MongoDB client for cache module
const mockMongoClient = {
    db: () => ({
        collection: () => ({
            find: () => ({
                limit: () => ({
                    project: () => ({
                        toArray: async () => {
                            return mockCacheData;
                        }
                    })
                })
            }),
            findOne: async () => null,
            updateOne: async () => ({}),
            bulkWrite: async () => ({}),
            deleteOne: async () => ({}),
            countDocuments: async () => 0,
            listIndexes: () => ({
                toArray: async () => []
            })
        })
    })
} as any;

describe("Faction", () => {
    beforeEach(() => {
        // Initialize cache with mock mongo client before each test
        cache.init(mockMongoClient);
        // Reset mock cache data before each test
        mockCacheData = [];
    });

    // Validation tests
    it("should return error when both faction groups are selected", async () => {
        const bot = createMockBot();
        const interaction = createMockInteraction({
            optionsData: {
                faction_group_1: "profession_sith",
                faction_group_2: "profession_jedi"
            }
        });

        const command = new Faction(bot);
        await command.run(bot, interaction);

        assertErrorReply(interaction, "one faction at a time");
    });

    it("should return error when no faction is selected", async () => {
        const bot = createMockBot();
        const interaction = createMockInteraction({
            optionsData: {}
        });

        const command = new Faction(bot);
        await command.run(bot, interaction);

        assertErrorReply(interaction, "need to select a faction");
    });

    // Functionality tests - faction selection
    it("should successfully process faction_group_1 selection", async () => {
        const bot = createMockBot();
        setMockCacheData([
            { baseId: "VADER", nameKey: "Darth Vader" },
            { baseId: "COUNTDOOKU", nameKey: "Count Dooku" }
        ]);

        const interaction = createMockInteraction({
            optionsData: {
                faction_group_1: "profession_sith"
            }
        });

        const command = new Faction(bot);
        await command.run(bot, interaction);

        const replies = (interaction as any)._getReplies();
        assert.ok(replies.length > 0, "Expected a reply");

        const embed = replies[0].embeds?.[0];
        assert.ok(embed, "Expected embed in reply");

        const embedData = embed.data || embed;
        assert.ok(embedData.author?.name?.includes("Sith"), "Expected Sith in author name");
        assert.ok(embedData.description?.includes("Darth Vader") || embedData.description?.includes("Count Dooku"), "Expected character name in description");
    });

    it("should successfully process faction_group_2 selection", async () => {
        const bot = createMockBot();
        setMockCacheData([
            { baseId: "COMMANDERLUKESKYWALKER", nameKey: "Commander Luke Skywalker" },
            { baseId: "GRANDMASTERYODA", nameKey: "Grand Master Yoda" }
        ]);

        const interaction = createMockInteraction({
            optionsData: {
                faction_group_2: "profession_jedi"
            }
        });

        const command = new Faction(bot);
        await command.run(bot, interaction);

        const replies = (interaction as any)._getReplies();
        assert.ok(replies.length > 0, "Expected a reply");

        const embed = replies[0].embeds?.[0];
        assert.ok(embed, "Expected embed in reply");

        const embedData = embed.data || embed;
        assert.ok(embedData.description?.includes("Commander Luke Skywalker") || embedData.description?.includes("Grand Master Yoda"), "Expected character in results");
    });

    it("should display character names sorted alphabetically", async () => {
        const bot = createMockBot();
        setMockCacheData([
            { baseId: "GRANDMASTERYODA", nameKey: "Grand Master Yoda" },
            { baseId: "VADER", nameKey: "Darth Vader" },
            { baseId: "COMMANDERLUKESKYWALKER", nameKey: "Commander Luke Skywalker" }
        ]);

        const interaction = createMockInteraction({
            optionsData: {
                faction_group_1: "profession_jedi"
            }
        });

        const command = new Faction(bot);
        await command.run(bot, interaction);

        const replies = (interaction as any)._getReplies();
        const embed = replies[0].embeds?.[0];
        const embedData = embed.data || embed;
        const description = embedData.description || "";

        // Check that characters appear in alphabetical order
        const clsIndex = description.indexOf("Commander Luke");
        const yodaIndex = description.indexOf("Grand Master");

        // CLS should come before Yoda alphabetically
        assert.ok(clsIndex >= 0 && yodaIndex >= 0, "Expected both characters in description");
        assert.ok(clsIndex < yodaIndex, "Expected alphabetical order");
    });

    // Note: Leader and zeta filtering tests require API integration to fetch character
    // abilities, which is beyond the scope of unit tests. Those features are better
    // tested with integration tests or end-to-end tests.

    // Option parsing tests
    it("should parse faction_group_1 option correctly", async () => {
        const bot = createMockBot();
        setMockCacheData([
            { baseId: "VADER", nameKey: "Darth Vader" }
        ]);

        const interaction = createMockInteraction({
            optionsData: {
                faction_group_1: "profession_sith"
            }
        });

        const command = new Faction(bot);
        await command.run(bot, interaction);

        const replies = (interaction as any)._getReplies();
        assert.ok(replies.length > 0, "Expected reply with faction_group_1");
    });

    it("should parse faction_group_2 option correctly", async () => {
        const bot = createMockBot();
        setMockCacheData([
            { baseId: "COMMANDERLUKESKYWALKER", nameKey: "Commander Luke Skywalker" }
        ]);

        const interaction = createMockInteraction({
            optionsData: {
                faction_group_2: "profession_jedi"
            }
        });

        const command = new Faction(bot);
        await command.run(bot, interaction);

        const replies = (interaction as any)._getReplies();
        assert.ok(replies.length > 0, "Expected reply with faction_group_2");
    });


    // Output format tests
    it("should return embed with character list when no allycode provided", async () => {
        const bot = createMockBot();
        setMockCacheData([
            { baseId: "VADER", nameKey: "Darth Vader" },
            { baseId: "COUNTDOOKU", nameKey: "Count Dooku" }
        ]);

        const interaction = createMockInteraction({
            optionsData: {
                faction_group_1: "profession_sith"
            }
        });

        const command = new Faction(bot);
        await command.run(bot, interaction);

        const replies = (interaction as any)._getReplies();
        const embed = replies[0].embeds?.[0];
        const embedData = embed.data || embed;

        assert.ok(embedData.author?.name, "Expected author name");
        assert.ok(embedData.description, "Expected description with character list");
        assert.ok(embedData.description.includes("Count Dooku") || embedData.description.includes("Darth Vader"), "Expected character in list");
    });

    it("should filter out ships from character results", async () => {
        const bot = createMockBot();
        setMockCacheData([
            { baseId: "VADER", nameKey: "Darth Vader" },
            { baseId: "TIEFIGHTERFOSP", nameKey: "TIE Fighter (FO)" }, // Ship - should be filtered
            { baseId: "COUNTDOOKU", nameKey: "Count Dooku" }
        ]);

        const interaction = createMockInteraction({
            optionsData: {
                faction_group_1: "profession_sith"
            }
        });

        const command = new Faction(bot);
        await command.run(bot, interaction);

        const replies = (interaction as any)._getReplies();
        const embed = replies[0].embeds?.[0];
        const embedData = embed.data || embed;

        // Ships should be filtered out, only characters remain
        assert.ok(embedData.description, "Expected description");
        assert.ok(!embedData.description.includes("TIE Fighter"), "Should not include ships");
    });

    it("should respond with proper embed structure", async () => {
        const bot = createMockBot();
        setMockCacheData([
            { baseId: "VADER", nameKey: "Darth Vader" }
        ]);

        const interaction = createMockInteraction({
            optionsData: {
                faction_group_1: "profession_sith"
            }
        });

        const command = new Faction(bot);
        await command.run(bot, interaction);

        const replies = (interaction as any)._getReplies();
        assert.ok(replies.length > 0, "Expected at least one reply");

        const reply = replies[0];
        assert.ok(reply.embeds, "Expected embeds in reply");
        assert.ok(reply.embeds.length > 0, "Expected at least one embed");

        const embed = reply.embeds[0];
        const embedData = embed.data || embed;
        assert.ok(embedData.author, "Expected author in embed");
        assert.ok(embedData.description || embedData.fields, "Expected description or fields in embed");
    });
});
