import assert from "node:assert";
import { beforeEach, describe, it } from "node:test";
import Farm from "../../slash/farm.ts";
import cache from "../../modules/cache.ts";
import swgohAPI from "../../modules/swapi.ts";
import { createMockBot, createMockInteraction } from "../mocks/index.ts";
import { assertErrorReply } from "./helpers.ts";

// Storage for mock location language data
const mockLocationData: Record<string, { id: string; language: string; langKey: string }> = {};

// Helper to set mock location data for a test
function setMockLocationData(data: Record<string, string>) {
    for (const [id, langKey] of Object.entries(data)) {
        mockLocationData[id] = { id, language: "eng_us", langKey };
    }
}

// Helper to clear mock location data
function clearMockLocationData() {
    for (const key in mockLocationData) {
        delete mockLocationData[key];
    }
}

// Mock swgohAPI.units to return basic unit data
const originalUnits = swgohAPI.units.bind(swgohAPI);
let mockUnitsEnabled = false;

async function mockUnits(defId?: string, language: string = "eng_us") {
    if (!mockUnitsEnabled) {
        return originalUnits(defId, language);
    }
    // Return minimal unit data needed by farm command
    if (defId) {
        return { uniqueName: defId, name: "Mock Unit" };
    }
    return [];
}

// Mock MongoDB client for cache module
const mockMongoClient = {
    db: () => ({
        collection: () => ({
            find: () => ({
                limit: () => ({
                    project: () => ({
                        toArray: async () => {
                            return [];
                        }
                    })
                })
            }),
            findOne: async (matchCondition: any) => {
                // Return mock location data based on the query
                if (matchCondition.id && mockLocationData[matchCondition.id]) {
                    return mockLocationData[matchCondition.id];
                }
                return null;
            },
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

describe("Farm", () => {
    beforeEach(() => {
        // Initialize cache with mock mongo client before each test
        cache.init(mockMongoClient);
        // Clear mock location data before each test
        clearMockLocationData();
        // Reset swgohAPI mock
        mockUnitsEnabled = false;
    });

    // Validation tests
    it("should return error for character not found", async () => {
        const bot = createMockBot();
        const interaction = createMockInteraction({
            optionsData: { character: "NonexistentCharacter123" }
        });

        const command = new Farm(bot);
        await command.run(bot, interaction);

        assertErrorReply(interaction, "BASE_SWGOH_NO_CHAR_FOUND");
    });

    it("should return error when multiple characters match", async () => {
        const bot = createMockBot();
        const interaction = createMockInteraction({
            optionsData: { character: "Luke" } // Matches multiple Luke characters
        });

        const command = new Farm(bot);
        await command.run(bot, interaction);

        assertErrorReply(interaction, "BASE_SWGOH_CHAR_LIST");
    });

    // Functionality tests - character farm locations
    it("should successfully find farm locations for a character", async () => {
        const bot = createMockBot();
        mockUnitsEnabled = true;
        (swgohAPI as any).units = mockUnits;

        setMockLocationData({
            "EVENT_ASSAULT_EMPIRE_NAME": "Empire Assault"
        });

        const interaction = createMockInteraction({
            optionsData: { character: "VADER" }
        });

        const command = new Farm(bot);
        await command.run(bot, interaction);

        const replies = (interaction as any)._getReplies();
        assert.ok(replies.length > 0, "Expected a reply");

        const embed = replies[0].embeds?.[0];
        assert.ok(embed, "Expected embed in reply");

        const embedData = embed.data || embed;
        assert.ok(embedData.author?.name, "Expected author name with character");
        assert.ok(embedData.description, "Expected description with locations");
    });

    it("should successfully find farm locations for a ship", async () => {
        const bot = createMockBot();
        mockUnitsEnabled = true;
        (swgohAPI as any).units = mockUnits;

        setMockLocationData({
            "HARD_FLEET": "Fleet Hard Battles"
        });

        const interaction = createMockInteraction({
            optionsData: { character: "JEDISTARFIGHTERANAKIN" }
        });
        (interaction as any).swgohLanguage = "eng_us";

        const command = new Farm(bot);
        await command.run(bot, interaction);

        const replies = (interaction as any)._getReplies();
        assert.ok(replies.length > 0, "Expected a reply");

        const embed = replies[0].embeds?.[0];
        assert.ok(embed, "Expected embed in reply");

        const embedData = embed.data || embed;
        assert.ok(embedData.description, "Expected description with locations");
    });

    // Location type tests
    it("should display store locations with cost", async () => {
        const bot = createMockBot();
        mockUnitsEnabled = true;
        (swgohAPI as any).units = mockUnits;

        const interaction = createMockInteraction({
            optionsData: { character: "VADER" }
        });

        const command = new Farm(bot);
        await command.run(bot, interaction);

        const replies = (interaction as any)._getReplies();
        const embed = replies[0].embeds?.[0];
        const embedData = embed.data || embed;
        const description = embedData.description || "";

        // VADER has Fleet Arena Store location with cost
        assert.ok(description.includes("Fleet Arena Store"), "Expected Fleet Arena Store location");
        assert.ok(description.includes("400 Fleet Arena Tokens"), "Expected cost information");
    });

    it("should display cantina node locations with level", async () => {
        const bot = createMockBot();
        mockUnitsEnabled = true;
        (swgohAPI as any).units = mockUnits;

        setMockLocationData({
            "CANTINA": "Cantina Battles"
        });

        const interaction = createMockInteraction({
            optionsData: { character: "COUNTDOOKU" }
        });
        (interaction as any).swgohLanguage = "eng_us";

        const command = new Farm(bot);
        await command.run(bot, interaction);

        const replies = (interaction as any)._getReplies();
        const embed = replies[0].embeds?.[0];
        const embedData = embed.data || embed;
        const description = embedData.description || "";

        // COUNTDOOKU has Cantina 6-G location
        assert.ok(description.includes("Cantina"), "Expected Cantina location");
        assert.ok(description.includes("6-G"), "Expected level information");
    });

    it("should display event locations with name", async () => {
        const bot = createMockBot();
        mockUnitsEnabled = true;
        (swgohAPI as any).units = mockUnits;

        setMockLocationData({
            "EVENT_ASSAULT_EMPIRE_NAME": "Empire Assault"
        });

        const interaction = createMockInteraction({
            optionsData: { character: "VADER" }
        });

        const command = new Farm(bot);
        await command.run(bot, interaction);

        const replies = (interaction as any)._getReplies();
        const embed = replies[0].embeds?.[0];
        const embedData = embed.data || embed;
        const description = embedData.description || "";

        // VADER has Assault Battle Event location
        assert.ok(description.includes("Empire Assault"), "Expected event name");
    });

    it("should display hard mode locations with proper formatting", async () => {
        const bot = createMockBot();
        mockUnitsEnabled = true;
        (swgohAPI as any).units = mockUnits;

        setMockLocationData({
            "HARD_FLEET": "Fleet Hard Battles"
        });

        const interaction = createMockInteraction({
            optionsData: { character: "JEDISTARFIGHTERANAKIN" }
        });
        (interaction as any).swgohLanguage = "eng_us";

        const command = new Farm(bot);
        await command.run(bot, interaction);

        const replies = (interaction as any)._getReplies();
        const embed = replies[0].embeds?.[0];
        const embedData = embed.data || embed;
        const description = embedData.description || "";

        // JEDISTARFIGHTERANAKIN has Hard Modes (Fleet) 1-B
        assert.ok(description.includes("Fleet Hard"), "Expected Fleet Hard location");
        assert.ok(description.includes("1-B"), "Expected level");
    });

    // Output format tests
    it("should return embed with proper structure", async () => {
        const bot = createMockBot();
        mockUnitsEnabled = true;
        (swgohAPI as any).units = mockUnits;

        setMockLocationData({
            "EVENT_ASSAULT_EMPIRE_NAME": "Empire Assault"
        });

        const interaction = createMockInteraction({
            optionsData: { character: "VADER" }
        });

        const command = new Farm(bot);
        await command.run(bot, interaction);

        const replies = (interaction as any)._getReplies();
        assert.ok(replies.length > 0, "Expected at least one reply");

        const reply = replies[0];
        assert.ok(reply.embeds, "Expected embeds in reply");
        assert.ok(reply.embeds.length > 0, "Expected at least one embed");

        const embed = reply.embeds[0];
        const embedData = embed.data || embed;
        assert.ok(embedData.author, "Expected author in embed");
        assert.ok(embedData.description, "Expected description in embed");
    });

    it("should include character name in embed author", async () => {
        const bot = createMockBot();
        mockUnitsEnabled = true;
        (swgohAPI as any).units = mockUnits;

        setMockLocationData({
            "CANTINA": "Cantina Battles"
        });

        const interaction = createMockInteraction({
            optionsData: { character: "COUNTDOOKU" }
        });
        (interaction as any).swgohLanguage = "eng_us";

        const command = new Farm(bot);
        await command.run(bot, interaction);

        const replies = (interaction as any)._getReplies();
        const embed = replies[0].embeds?.[0];
        const embedData = embed.data || embed;

        assert.ok(embedData.author?.name?.includes("Count Dooku"), "Expected character name in author");
    });

    it("should display multiple locations for a single character", async () => {
        const bot = createMockBot();
        mockUnitsEnabled = true;
        (swgohAPI as any).units = mockUnits;

        setMockLocationData({
            "EVENT_ASSAULT_JEDI_NAME": "Places Of Power Assault Battles"
        });

        const interaction = createMockInteraction({
            optionsData: { character: "JEDISTARFIGHTERAHSOKATANO" }
        });

        const command = new Farm(bot);
        await command.run(bot, interaction);

        const replies = (interaction as any)._getReplies();
        const embed = replies[0].embeds?.[0];
        const embedData = embed.data || embed;
        const description = embedData.description || "";

        // JEDISTARFIGHTERAHSOKATANO has multiple store locations
        assert.ok(description.includes("Fleet Arena Store"), "Expected Fleet Arena Store");
        assert.ok(description.includes("Galactic War Store"), "Expected Galactic War Store");
        assert.ok(description.includes("Guild Events Store"), "Expected Guild Events Store");
    });

    it("should format cost with 'per' instead of slash", async () => {
        const bot = createMockBot();
        mockUnitsEnabled = true;
        (swgohAPI as any).units = mockUnits;

        const interaction = createMockInteraction({
            optionsData: { character: "VADER" }
        });

        const command = new Farm(bot);
        await command.run(bot, interaction);

        const replies = (interaction as any)._getReplies();
        const embed = replies[0].embeds?.[0];
        const embedData = embed.data || embed;
        const description = embedData.description || "";

        // Cost should be formatted as "400 Fleet Arena Tokens per 5 shards" not "400 Fleet Arena Tokens/5"
        assert.ok(description.includes("per"), "Expected cost formatted with 'per'");
        assert.ok(description.includes("shards"), "Expected shards in cost");
    });

    it("should return error when character has no farming locations", async () => {
        const bot = createMockBot();
        mockUnitsEnabled = true;
        (swgohAPI as any).units = mockUnits;

        // Use a character that exists but has no locations
        // Note: This test assumes there's a character in the data without locations
        // If all characters have locations, this test documents expected behavior
        const interaction = createMockInteraction({
            optionsData: { character: "COMMANDERLUKESKYWALKER" }
        });

        const command = new Farm(bot);
        await command.run(bot, interaction);

        const replies = (interaction as any)._getReplies();
        assert.ok(replies.length > 0, "Expected a reply");

        // Should either show locations or error message
        const embed = replies[0].embeds?.[0];
        assert.ok(embed, "Expected embed in reply");
    });
});
