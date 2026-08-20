import assert from "node:assert";
import { beforeEach, describe, it } from "node:test";
import cache from "../../modules/cache.ts";
import { factionNames } from "../../data/constants/units.ts";
import Faction from "../../slash/faction.ts";
import { createCommandContext, createMockInteraction } from "../mocks/index.ts";
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
    it("should return error when no faction is selected", async () => {        const interaction = createMockInteraction({
            optionsData: {}
        });

        const command = new Faction();
        const ctx = createCommandContext({ interaction });
        await command.run(ctx);

        assertErrorReply(interaction, "COMMAND_FACTION_NO_FACTION");
    });

    // Functionality tests - faction selection
    it("should successfully process faction selection", async () => {        setMockCacheData([
            { baseId: "VADER", nameKey: "Darth Vader" },
            { baseId: "COUNTDOOKU", nameKey: "Count Dooku" }
        ]);

        const interaction = createMockInteraction({
            optionsData: {
                faction: "profession_sith"
            }
        });

        const command = new Faction();
        const ctx = createCommandContext({ interaction });
        await command.run(ctx);

        const replies = (interaction as any)._getReplies();
        assert.ok(replies.length > 0, "Expected a reply");

        const embed = replies[0].embeds?.[0];
        assert.ok(embed, "Expected embed in reply");

        const embedData = embed.data || embed;
        assert.ok(embedData.author?.name?.includes("Sith"), "Expected Sith in author name");
        assert.ok(embedData.description?.includes("Darth Vader") || embedData.description?.includes("Count Dooku"), "Expected character name in description");
    });

    // The category the hand-maintained factionMap never had. Its absence there is what made the
    // picker unable to offer anything the game added in years.
    it("names a faction the old hardcoded map was missing", async () => {
        setMockCacheData([{ baseId: "CHEWBACCALEGENDARY", nameKey: "Chewbacca" }]);

        const interaction = createMockInteraction({ optionsData: { faction: "species_wookiee" } });
        const command = new Faction();
        await command.run(createCommandContext({ interaction }));

        const embedData = (interaction as any)._getReplies()[0].embeds?.[0];
        assert.ok(embedData.author?.name?.includes("Wookiee"), "Expected the resolved faction name in the author line");
    });

    it("names the faction in the requesting user's language", async () => {
        // Read the expected name from the generated map rather than hardcoding it, so a retranslation
        // upstream does not fail the suite. Asserted against the english name to stay meaningful.
        const localized = factionNames.species_wookiee?.rus_ru;
        assert.ok(localized && localized !== factionNames.species_wookiee?.eng_us, "fixture needs a distinct localized name");

        setMockCacheData([{ baseId: "CHEWBACCALEGENDARY", nameKey: "Chewbacca" }]);

        const interaction = createMockInteraction({ optionsData: { faction: "species_wookiee" } });
        const command = new Faction();
        await command.run(createCommandContext({ interaction, swgohLanguage: "rus_ru" as any }));

        const embedData = (interaction as any)._getReplies()[0].embeds?.[0];
        assert.ok(embedData.author?.name?.includes(localized), "Expected the localized faction name, not the english one");
    });

    it("should successfully process jedi faction selection", async () => {        setMockCacheData([
            { baseId: "COMMANDERLUKESKYWALKER", nameKey: "Commander Luke Skywalker" },
            { baseId: "GRANDMASTERYODA", nameKey: "Grand Master Yoda" }
        ]);

        const interaction = createMockInteraction({
            optionsData: {
                faction: "profession_jedi"
            }
        });

        const command = new Faction();
        const ctx = createCommandContext({ interaction });
        await command.run(ctx);

        const replies = (interaction as any)._getReplies();
        assert.ok(replies.length > 0, "Expected a reply");

        const embed = replies[0].embeds?.[0];
        assert.ok(embed, "Expected embed in reply");

        const embedData = embed.data || embed;
        assert.ok(embedData.description?.includes("Commander Luke Skywalker") || embedData.description?.includes("Grand Master Yoda"), "Expected character in results");
    });

    it("should display character names sorted alphabetically", async () => {        setMockCacheData([
            { baseId: "GRANDMASTERYODA", nameKey: "Grand Master Yoda" },
            { baseId: "VADER", nameKey: "Darth Vader" },
            { baseId: "COMMANDERLUKESKYWALKER", nameKey: "Commander Luke Skywalker" }
        ]);

        const interaction = createMockInteraction({
            optionsData: {
                faction: "profession_jedi"
            }
        });

        const command = new Faction();
        const ctx = createCommandContext({ interaction });
        await command.run(ctx);

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
    it("should parse faction option correctly", async () => {        setMockCacheData([
            { baseId: "VADER", nameKey: "Darth Vader" }
        ]);

        const interaction = createMockInteraction({
            optionsData: {
                faction: "profession_sith"
            }
        });

        const command = new Faction();
        const ctx = createCommandContext({ interaction });
        await command.run(ctx);

        const replies = (interaction as any)._getReplies();
        assert.ok(replies.length > 0, "Expected reply with faction option");
    });


    // Output format tests
    it("should return embed with character list when no allycode provided", async () => {        setMockCacheData([
            { baseId: "VADER", nameKey: "Darth Vader" },
            { baseId: "COUNTDOOKU", nameKey: "Count Dooku" }
        ]);

        const interaction = createMockInteraction({
            optionsData: {
                faction: "profession_sith"
            }
        });

        const command = new Faction();
        const ctx = createCommandContext({ interaction });
        await command.run(ctx);

        const replies = (interaction as any)._getReplies();
        const embed = replies[0].embeds?.[0];
        const embedData = embed.data || embed;

        assert.ok(embedData.author?.name, "Expected author name");
        assert.ok(embedData.description, "Expected description with character list");
        assert.ok(embedData.description.includes("Count Dooku") || embedData.description.includes("Darth Vader"), "Expected character in list");
    });

    it("should filter out ships from character results", async () => {        setMockCacheData([
            { baseId: "VADER", nameKey: "Darth Vader" },
            { baseId: "TIEFIGHTERFOSP", nameKey: "TIE Fighter (FO)" }, // Ship - should be filtered
            { baseId: "COUNTDOOKU", nameKey: "Count Dooku" }
        ]);

        const interaction = createMockInteraction({
            optionsData: {
                faction: "profession_sith"
            }
        });

        const command = new Faction();
        const ctx = createCommandContext({ interaction });
        await command.run(ctx);

        const replies = (interaction as any)._getReplies();
        const embed = replies[0].embeds?.[0];
        const embedData = embed.data || embed;

        // Ships should be filtered out, only characters remain
        assert.ok(embedData.description, "Expected description");
        assert.ok(!embedData.description.includes("TIE Fighter"), "Should not include ships");
    });

    it("should respond with proper embed structure", async () => {        setMockCacheData([
            { baseId: "VADER", nameKey: "Darth Vader" }
        ]);

        const interaction = createMockInteraction({
            optionsData: {
                faction: "profession_sith"
            }
        });

        const command = new Faction();
        const ctx = createCommandContext({ interaction });
        await command.run(ctx);

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
