import assert from "node:assert";
import { after, before, beforeEach, describe, it } from "node:test";
import { env } from "../../config/config.ts";
import cache from "../../modules/cache.ts";
import swgohAPI from "../../modules/swapi.ts";
import Farm from "../../slash/farm.ts";
import { closeMongoClient, getMongoClient } from "../helpers/mongodb.ts";
import { createCommandContext, createMockInteraction } from "../mocks/index.ts";
import { assertErrorReply } from "./helpers.ts";

const testDb = env.MONGODB_SWAPI_DB;

// Mock swgohAPI.units to avoid hitting the real game API
const originalUnits = swgohAPI.units.bind(swgohAPI);
let mockUnitsEnabled = false;

async function mockUnits(defId?: string, language: string = "eng_us") {
    if (!mockUnitsEnabled) {
        return originalUnits(defId, language);
    }
    if (defId) {
        return { uniqueName: defId, name: "Mock Unit" };
    }
    return [];
}

describe("Farm", () => {
    before(async () => {
        const mongoClient = await getMongoClient();
        cache.init(mongoClient);

        // Seed all location strings needed across tests
        const locations = [
            { id: "CANTINA", language: "eng_us", langKey: "Cantina Battles" },
            { id: "HARD_FLEET", language: "eng_us", langKey: "Fleet Battles Hard" },
            { id: "HARD_DARK", language: "eng_us", langKey: "Dark Side Hard" },
            { id: "HARD_LIGHT", language: "eng_us", langKey: "Light Side Hard" },
        ];
        const col = mongoClient.db(testDb).collection("locations");
        await col.insertMany(locations);
    });

    after(async () => {
        try {
            const col = (await getMongoClient()).db(testDb).collection("locations");
            await col.deleteMany({ id: { $in: ["CANTINA", "HARD_FLEET", "HARD_DARK", "HARD_LIGHT"] } });
        } catch (_) {
            // Ignore cleanup errors
        }
        await closeMongoClient();
    });

    beforeEach(() => {
        mockUnitsEnabled = false;
    });

    // Validation tests
    it("should return error for character not found", async () => {
        const interaction = createMockInteraction({
            optionsData: { character: "NonexistentCharacter123" },
        });

        const command = new Farm();
        const ctx = createCommandContext({ interaction });
        await command.run(ctx);

        assertErrorReply(interaction, "BASE_SWGOH_NO_CHAR_FOUND");
    });

    it("should return error when multiple characters match", async () => {
        const interaction = createMockInteraction({
            optionsData: { character: "Luke" }, // Matches multiple Luke characters
        });

        const command = new Farm();
        const ctx = createCommandContext({ interaction });
        await command.run(ctx);

        assertErrorReply(interaction, "BASE_SWGOH_CHAR_LIST");
    });

    // Functionality tests - character farm locations
    it("should successfully find farm locations for a character", async () => {
        mockUnitsEnabled = true;
        (swgohAPI as any).units = mockUnits;

        const interaction = createMockInteraction({
            optionsData: { character: "VADER" },
        });

        const command = new Farm();
        const ctx = createCommandContext({ interaction });
        await command.run(ctx);

        const replies = (interaction as any)._getReplies();
        assert.ok(replies.length > 0, "Expected a reply");

        const embed = replies[0].embeds?.[0];
        assert.ok(embed, "Expected embed in reply");

        const embedData = embed.data || embed;
        assert.ok(embedData.author?.name, "Expected author name with character");
        assert.ok(embedData.description, "Expected description with locations");
    });

    it("should successfully find farm locations for a ship", async () => {
        mockUnitsEnabled = true;
        (swgohAPI as any).units = mockUnits;

        const interaction = createMockInteraction({
            optionsData: { character: "JEDISTARFIGHTERANAKIN" },
        });

        const command = new Farm();
        const ctx = createCommandContext({ interaction });
        await command.run(ctx);

        const replies = (interaction as any)._getReplies();
        assert.ok(replies.length > 0, "Expected a reply");

        const embed = replies[0].embeds?.[0];
        assert.ok(embed, "Expected embed in reply");

        const embedData = embed.data || embed;
        assert.ok(embedData.description, "Expected description with locations");
    });

    // Location type tests
    it("should display store locations with cost", async () => {
        mockUnitsEnabled = true;
        (swgohAPI as any).units = mockUnits;

        const interaction = createMockInteraction({
            optionsData: { character: "VADER" },
        });

        const command = new Farm();
        const ctx = createCommandContext({ interaction });
        await command.run(ctx);

        const replies = (interaction as any)._getReplies();
        const embed = replies[0].embeds?.[0];
        const embedData = embed.data || embed;
        const description = embedData.description || "";

        // VADER has Fleet Arena Store location with cost
        assert.ok(description.includes("Fleet Arena Store"), "Expected Fleet Arena Store location");
        assert.ok(description.includes("400 Fleet Arena Tokens"), "Expected cost information");
    });

    it("should display cantina node locations with level", async () => {
        mockUnitsEnabled = true;
        (swgohAPI as any).units = mockUnits;

        const interaction = createMockInteraction({
            optionsData: { character: "COUNTDOOKU" },
        });

        const command = new Farm();
        const ctx = createCommandContext({ interaction });
        await command.run(ctx);

        const replies = (interaction as any)._getReplies();
        const embed = replies[0].embeds?.[0];
        const embedData = embed.data || embed;
        const description = embedData.description || "";

        // COUNTDOOKU has Cantina 6-G location
        assert.ok(description.includes("Cantina"), "Expected Cantina location");
        assert.ok(description.includes("6-G"), "Expected level information");
    });

    it("should display event locations with name", async () => {
        mockUnitsEnabled = true;
        (swgohAPI as any).units = mockUnits;

        const interaction = createMockInteraction({
            optionsData: { character: "VADER" },
        });

        const command = new Farm();
        const ctx = createCommandContext({ interaction });
        await command.run(ctx);

        const replies = (interaction as any)._getReplies();
        const embed = replies[0].embeds?.[0];
        const embedData = embed.data || embed;
        const description = embedData.description || "";

        // VADER has Assault Battle Event with name (no DB lookup needed)
        assert.ok(description.includes("Empire Assault"), "Expected event name");
    });

    it("should display hard mode ship locations with proper formatting", async () => {
        mockUnitsEnabled = true;
        (swgohAPI as any).units = mockUnits;

        const interaction = createMockInteraction({
            optionsData: { character: "JEDISTARFIGHTERANAKIN" },
        });

        const command = new Farm();
        const ctx = createCommandContext({ interaction });
        await command.run(ctx);

        const replies = (interaction as any)._getReplies();
        const embed = replies[0].embeds?.[0];
        const embedData = embed.data || embed;
        const description = embedData.description || "";

        // JEDISTARFIGHTERANAKIN has Hard Modes (Fleet) 1-B, resolved via DB
        assert.ok(description.includes("Fleet Battles Hard"), "Expected Fleet hard location from DB");
        assert.ok(description.includes("1-B"), "Expected level");
    });

    // Batch DB query test — verifies both locId locations resolve correctly
    it("should display all locations when a character has multiple locId lookups", async () => {
        mockUnitsEnabled = true;
        (swgohAPI as any).units = mockUnits;

        // REY has two DB-lookup locations: HARD_DARK (5-D) and HARD_LIGHT (1-A)
        const interaction = createMockInteraction({
            optionsData: { character: "REY" },
        });

        const command = new Farm();
        const ctx = createCommandContext({ interaction });
        await command.run(ctx);

        const replies = (interaction as any)._getReplies();
        assert.ok(replies.length > 0, "Expected a reply");

        const embed = replies[0].embeds?.[0];
        assert.ok(embed, "Expected embed in reply");

        const embedData = embed.data || embed;
        const description = embedData.description || "";

        assert.ok(description.includes("Dark Side Hard"), "Expected HARD_DARK location resolved from DB");
        assert.ok(description.includes("Light Side Hard"), "Expected HARD_LIGHT location resolved from DB");
        assert.ok(description.includes("5-D"), "Expected HARD_DARK level");
        assert.ok(description.includes("1-A"), "Expected HARD_LIGHT level");
    });

    // Output format tests
    it("should return embed with proper structure", async () => {
        mockUnitsEnabled = true;
        (swgohAPI as any).units = mockUnits;

        const interaction = createMockInteraction({
            optionsData: { character: "VADER" },
        });

        const command = new Farm();
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
        assert.ok(embedData.description, "Expected description in embed");
    });

    it("should include character name in embed author", async () => {
        mockUnitsEnabled = true;
        (swgohAPI as any).units = mockUnits;

        const interaction = createMockInteraction({
            optionsData: { character: "COUNTDOOKU" },
        });

        const command = new Farm();
        const ctx = createCommandContext({ interaction });
        await command.run(ctx);

        const replies = (interaction as any)._getReplies();
        const embed = replies[0].embeds?.[0];
        const embedData = embed.data || embed;

        assert.ok(embedData.author?.name?.includes("Count Dooku"), "Expected character name in author");
    });

    it("should display multiple locations for a single character", async () => {
        mockUnitsEnabled = true;
        (swgohAPI as any).units = mockUnits;

        const interaction = createMockInteraction({
            optionsData: { character: "JEDISTARFIGHTERAHSOKATANO" },
        });

        const command = new Farm();
        const ctx = createCommandContext({ interaction });
        await command.run(ctx);

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
        mockUnitsEnabled = true;
        (swgohAPI as any).units = mockUnits;

        const interaction = createMockInteraction({
            optionsData: { character: "VADER" },
        });

        const command = new Farm();
        const ctx = createCommandContext({ interaction });
        await command.run(ctx);

        const replies = (interaction as any)._getReplies();
        const embed = replies[0].embeds?.[0];
        const embedData = embed.data || embed;
        const description = embedData.description || "";

        // Cost should be formatted as "400 Fleet Arena Tokens per 5 shards" not "400 Fleet Arena Tokens/5"
        assert.ok(description.includes("per"), "Expected cost formatted with 'per'");
        assert.ok(description.includes("shards"), "Expected shards in cost");
    });

    it("should return embed when character has event-only locations", async () => {
        mockUnitsEnabled = true;
        (swgohAPI as any).units = mockUnits;

        // COMMANDERLUKESKYWALKER has a Hero's Journey event location (name-based, no DB lookup)
        const interaction = createMockInteraction({
            optionsData: { character: "COMMANDERLUKESKYWALKER" },
        });

        const command = new Farm();
        const ctx = createCommandContext({ interaction });
        await command.run(ctx);

        const replies = (interaction as any)._getReplies();
        assert.ok(replies.length > 0, "Expected a reply");

        const embed = replies[0].embeds?.[0];
        assert.ok(embed, "Expected embed in reply");
    });
});
