import assert from "node:assert";
import { after, before, beforeEach, describe, it } from "node:test";
import { env } from "../../config/config.ts";
import { characters, charLocs, shipLocs, ships } from "../../data/constants/units.ts";
import cache from "../../modules/cache.ts";
import swgohAPI from "../../modules/swapi.ts";
import Farm from "../../slash/farm.ts";
import type { BotUnit, UnitLocation } from "../../types/types.ts";
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

// These tests drive the command against fixtures rather than the live data/*.json files. Those
// files are regenerated from CG's game data, so asserting on real units couples the suite to
// whatever CG renames next (an event rename silently broke this file once already -- see
// BUG_REFERENCE.md). The fixtures below cover every rendering branch in slash/farm.ts.
const mockChar = (uniqueName: string, name: string): BotUnit =>
    ({ uniqueName, name, aliases: [name], side: "dark", avatarName: "", avatarURL: "", factions: [] }) as BotUnit;

const FIXTURE_CHARS: BotUnit[] = [
    mockChar("FARMTEST_STORE", "Farmtest Store Unit"),
    mockChar("FARMTEST_CANTINA", "Farmtest Cantina Unit"),
    mockChar("FARMTEST_EVENT", "Farmtest Event Unit"),
    mockChar("FARMTEST_HARDNODES", "Farmtest Hardnodes Unit"),
    mockChar("FARMTEST_NOLOCS", "Farmtest Nolocs Unit"),
    mockChar("FARMTEST_DUPE_ONE", "Farmtest Dupe One"),
    mockChar("FARMTEST_DUPE_TWO", "Farmtest Dupe Two"),
];
const FIXTURE_SHIPS: BotUnit[] = [mockChar("FARMTEST_SHIP", "Farmtest Ship"), mockChar("FARMTEST_SHIP_STORES", "Farmtest Ship Stores")];

// Location ids seeded into the shared `locations` collection below. Prefixed so parallel test
// files can't collide on them.
const LOC_CANTINA = "FARMTEST_CANTINA_LOC";
const LOC_HARD_DARK = "FARMTEST_HARD_DARK_LOC";
const LOC_HARD_LIGHT = "FARMTEST_HARD_LIGHT_LOC";
const LOC_HARD_FLEET = "FARMTEST_HARD_FLEET_LOC";
const SEEDED_LOC_IDS = [LOC_CANTINA, LOC_HARD_DARK, LOC_HARD_LIGHT, LOC_HARD_FLEET];

const EVENT_NAME = "Farmtest Assault Event";

const FIXTURE_CHAR_LOCS: UnitLocation[] = [
    {
        name: "Farmtest Store Unit",
        defId: "FARMTEST_STORE",
        locations: [{ type: "Fleet Arena Store", cost: "400 Fleet Arena Tokens/5" }],
    },
    {
        name: "Farmtest Cantina Unit",
        defId: "FARMTEST_CANTINA",
        locations: [{ type: "Cantina", level: "6-G", locId: LOC_CANTINA }],
    },
    {
        name: "Farmtest Event Unit",
        defId: "FARMTEST_EVENT",
        locations: [{ type: "Assault Battle Event", locId: "FARMTEST_EVENT_LOC", name: EVENT_NAME }],
    },
    {
        name: "Farmtest Hardnodes Unit",
        defId: "FARMTEST_HARDNODES",
        locations: [
            { type: "Hard Modes (D)", level: "5-D", locId: LOC_HARD_DARK },
            { type: "Hard Modes (L)", level: "1-A", locId: LOC_HARD_LIGHT },
        ],
    },
    { name: "Farmtest Dupe One", defId: "FARMTEST_DUPE_ONE", locations: [{ type: "Fleet Arena Store", cost: "10 Tokens/1" }] },
    { name: "Farmtest Dupe Two", defId: "FARMTEST_DUPE_TWO", locations: [{ type: "Fleet Arena Store", cost: "10 Tokens/1" }] },
] as unknown as UnitLocation[];

const FIXTURE_SHIP_LOCS: UnitLocation[] = [
    {
        name: "Farmtest Ship",
        defId: "FARMTEST_SHIP",
        locations: [{ type: "Hard Modes (Fleet)", level: "1-B", locId: LOC_HARD_FLEET }],
    },
    {
        name: "Farmtest Ship Stores",
        defId: "FARMTEST_SHIP_STORES",
        locations: [
            { type: "Fleet Arena Store", cost: "400 Fleet Arena Tokens/5" },
            { type: "Galactic War Store", cost: "600 Galactic War Tokens/5" },
            { type: "Guild Events Store", cost: "800 Guild Event Tokens/5" },
        ],
    },
] as unknown as UnitLocation[];

// units.ts exports these as module-level arrays that slash/farm.ts closes over, so swap their
// contents in place and restore afterwards. Each test file runs in its own process, so this
// cannot leak into other files.
function replaceArray<T>(target: T[], next: T[]): T[] {
    const original = [...target];
    target.length = 0;
    target.push(...next);
    return original;
}

describe("Farm", () => {
    let originalChars: BotUnit[];
    let originalShips: BotUnit[];
    let originalCharLocs: UnitLocation[];
    let originalShipLocs: UnitLocation[];

    before(async () => {
        const mongoClient = await getMongoClient();
        cache.init(mongoClient);

        originalChars = replaceArray(characters, FIXTURE_CHARS);
        originalShips = replaceArray(ships, FIXTURE_SHIPS);
        originalCharLocs = replaceArray(charLocs, FIXTURE_CHAR_LOCS);
        originalShipLocs = replaceArray(shipLocs, FIXTURE_SHIP_LOCS);

        // Seed the localized strings the locId-based locations resolve against
        const locations = [
            { id: LOC_CANTINA, language: "eng_us", langKey: "Cantina Battles" },
            { id: LOC_HARD_FLEET, language: "eng_us", langKey: "Fleet Battles Hard" },
            { id: LOC_HARD_DARK, language: "eng_us", langKey: "Dark Side Hard" },
            { id: LOC_HARD_LIGHT, language: "eng_us", langKey: "Light Side Hard" },
        ];
        const col = mongoClient.db(testDb).collection("locations");
        await col.insertMany(locations);
    });

    after(async () => {
        replaceArray(characters, originalChars);
        replaceArray(ships, originalShips);
        replaceArray(charLocs, originalCharLocs);
        replaceArray(shipLocs, originalShipLocs);

        try {
            const col = (await getMongoClient()).db(testDb).collection("locations");
            await col.deleteMany({ id: { $in: SEEDED_LOC_IDS } });
        } catch (_) {
            // Ignore cleanup errors
        }
        await closeMongoClient();
    });

    beforeEach(() => {
        mockUnitsEnabled = false;
    });

    const runFarm = async (character: string) => {
        mockUnitsEnabled = true;
        (swgohAPI as any).units = mockUnits;

        const interaction = createMockInteraction({ optionsData: { character } });
        await new Farm().run(createCommandContext({ interaction }));
        return interaction;
    };

    const descriptionOf = (interaction: any) => {
        const replies = interaction._getReplies();
        assert.ok(replies.length > 0, "Expected a reply");
        const embed = replies[0].embeds?.[0];
        assert.ok(embed, "Expected embed in reply");
        const embedData = embed.data || embed;
        return embedData.description || "";
    };

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
            optionsData: { character: "Dupe" }, // Matches both FARMTEST_DUPE_* fixtures
        });

        const command = new Farm();
        const ctx = createCommandContext({ interaction });
        await command.run(ctx);

        assertErrorReply(interaction, "BASE_SWGOH_CHAR_LIST");
    });

    it("should return an error when the unit has no known locations", async () => {
        const interaction = await runFarm("FARMTEST_NOLOCS");
        assertErrorReply(interaction, "COMMAND_FARM_LOCATION_ERROR");
    });

    // Functionality tests - character farm locations
    it("should successfully find farm locations for a character", async () => {
        const interaction = await runFarm("FARMTEST_STORE");

        const replies = (interaction as any)._getReplies();
        const embedData = replies[0].embeds?.[0].data || replies[0].embeds?.[0];
        assert.ok(embedData.author?.name, "Expected author name with character");
        assert.ok(embedData.description, "Expected description with locations");
    });

    it("should successfully find farm locations for a ship", async () => {
        const description = descriptionOf(await runFarm("FARMTEST_SHIP"));
        assert.ok(description.length, "Expected description with locations");
    });

    // Location type tests
    it("should display store locations with cost", async () => {
        const description = descriptionOf(await runFarm("FARMTEST_STORE"));
        assert.ok(description.includes("Fleet Arena Store"), "Expected the store location type");
        assert.ok(description.includes("400 Fleet Arena Tokens"), "Expected cost information");
    });

    it("should display cantina node locations with level", async () => {
        const description = descriptionOf(await runFarm("FARMTEST_CANTINA"));
        // Resolved from the seeded `locations` doc, then suffixed with the node level
        assert.ok(description.includes("Cantina Battles"), "Expected the localized cantina name");
        assert.ok(description.includes("6-G"), "Expected level information");
    });

    it("should display event locations with their name and no db lookup", async () => {
        const description = descriptionOf(await runFarm("FARMTEST_EVENT"));
        assert.ok(description.includes(EVENT_NAME), `Expected event name ${EVENT_NAME} in: ${description}`);
        assert.ok(description.includes("Assault Battle Event"), "Expected the event type label");
    });

    it("should display hard mode ship locations with proper formatting", async () => {
        const description = descriptionOf(await runFarm("FARMTEST_SHIP"));
        assert.ok(description.includes("Fleet Battles Hard"), "Expected Fleet hard location from DB");
        assert.ok(description.includes("1-B"), "Expected level");
    });

    // Batch DB query test — verifies both locId locations resolve correctly
    it("should display all locations when a character has multiple locId lookups", async () => {
        const description = descriptionOf(await runFarm("FARMTEST_HARDNODES"));
        assert.ok(description.includes("Dark Side Hard"), "Expected the dark side location resolved from DB");
        assert.ok(description.includes("Light Side Hard"), "Expected the light side location resolved from DB");
        assert.ok(description.includes("5-D"), "Expected dark side level");
        assert.ok(description.includes("1-A"), "Expected light side level");
    });

    // Output format tests
    it("should return embed with proper structure", async () => {
        const interaction = await runFarm("FARMTEST_STORE");
        const replies = (interaction as any)._getReplies();
        assert.ok(replies[0].embeds?.length, "Expected at least one embed");

        const embedData = replies[0].embeds[0].data || replies[0].embeds[0];
        assert.ok(embedData.author, "Expected author in embed");
        assert.ok(embedData.description, "Expected description in embed");
    });

    it("should include character name in embed author", async () => {
        const interaction = await runFarm("FARMTEST_CANTINA");
        const replies = (interaction as any)._getReplies();
        const embedData = replies[0].embeds[0].data || replies[0].embeds[0];
        assert.ok(embedData.author?.name?.includes("Farmtest Cantina Unit"), "Expected character name in author");
    });

    it("should display multiple locations for a single unit", async () => {
        const description = descriptionOf(await runFarm("FARMTEST_SHIP_STORES"));
        assert.ok(description.includes("Fleet Arena Store"), "Expected Fleet Arena Store");
        assert.ok(description.includes("Galactic War Store"), "Expected Galactic War Store");
        assert.ok(description.includes("Guild Events Store"), "Expected Guild Events Store");
    });

    it("should format cost with 'per' instead of slash", async () => {
        const description = descriptionOf(await runFarm("FARMTEST_STORE"));
        // "400 Fleet Arena Tokens/5" should render as "400 Fleet Arena Tokens per 5 shards"
        assert.ok(description.includes("400 Fleet Arena Tokens per 5 shards"), `Expected cost formatted with 'per', got: ${description}`);
        assert.ok(!description.includes("Tokens/5"), "Expected the raw slash form to be replaced");
    });

    it("should return embed when character has event-only locations", async () => {
        const interaction = await runFarm("FARMTEST_EVENT");
        const replies = (interaction as any)._getReplies();
        assert.ok(replies[0].embeds?.[0], "Expected embed in reply");
    });
});
