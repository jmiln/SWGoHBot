import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { MongoClient } from "mongodb";
import {env} from "../../config/config.ts";
import cache from "../../modules/cache.ts";
import databaseCleanup from "../../modules/databaseCleanup.ts";
import { closeMongoClient, getMongoClient } from "../helpers/mongodb.ts";

describe("DatabaseCleanup Module", () => {
    let mongoClient: MongoClient;
    const testDbName = "test_database_cleanup";
    let originalSwapiDb: string;

    before(async () => {
        mongoClient = await getMongoClient();

        // Temporarily override the swapidb config to use test database
        originalSwapiDb = env.MONGODB_SWAPI_DB;
        env.MONGODB_SWAPI_DB = testDbName;

        cache.init(mongoClient);
    });

    after(async () => {
        // Restore original config
        env.MONGODB_SWAPI_DB = originalSwapiDb;

        // Clean up test data
        await mongoClient.db(testDbName).collection("playerStats").deleteMany({});
        await mongoClient.db(testDbName).collection("guilds").deleteMany({});

        // Close MongoDB client
        await closeMongoClient();
    });

    describe("cleanOldPlayerStats", () => {
        it("should delete player stats older than threshold", async () => {
            const now = Date.now();
            const oldTime = now - 10 * 24 * 60 * 60 * 1000; // 10 days ago
            const recentTime = now - 3 * 24 * 60 * 60 * 1000; // 3 days ago

            // Insert test data (autoUpdate: false to preserve our custom timestamps)
            await cache.put(testDbName, "playerStats", { allyCode: 111111111 }, {
                allyCode: 111111111,
                name: "Old Player",
                updated: oldTime,
                roster: [],
            }, false);

            await cache.put(testDbName, "playerStats", { allyCode: 222222222 }, {
                allyCode: 222222222,
                name: "Recent Player",
                updated: recentTime,
                roster: [],
            }, false);

            // Run cleanup with 7 day threshold
            const result = await databaseCleanup.cleanOldPlayerStats(7);

            // Should delete the 10-day-old record but keep the 3-day-old one
            assert.match(result, /Deleted 1 player/);

            const remaining = await cache.get(testDbName, "playerStats", {});
            assert.equal(remaining.length, 1);
            assert.equal(remaining[0].allyCode, 222222222);
        });
    });

    describe("cleanOldGuilds", () => {
        it("should delete guild data older than threshold", async () => {
            const now = Date.now();
            const oldTime = now - 10 * 24 * 60 * 60 * 1000;
            const recentTime = now - 3 * 24 * 60 * 60 * 1000;

            // Insert test data (autoUpdate: false to preserve our custom timestamps)
            await cache.put(testDbName, "guilds", { id: "old-guild" }, {
                id: "old-guild",
                name: "Old Guild",
                updated: oldTime,
                members: 50,
                gp: 100000000,
            }, false);

            await cache.put(testDbName, "guilds", { id: "recent-guild" }, {
                id: "recent-guild",
                name: "Recent Guild",
                updated: recentTime,
                members: 50,
                gp: 100000000,
            }, false);

            const result = await databaseCleanup.cleanOldGuilds(7);

            assert.match(result, /Deleted 1 guild/);

            const remaining = await cache.get(testDbName, "guilds", {});
            assert.equal(remaining.length, 1);
            assert.equal(remaining[0].id, "recent-guild");
        });
    });

    describe("cleanEmptyRosters", () => {
        it("should delete player records with empty rosters", async () => {
            // Clean up any leftover data from previous tests
            await mongoClient.db(testDbName).collection("playerStats").deleteMany({});

            const now = Date.now();

            // Insert test data (no autoUpdate needed, roster check doesn't depend on timestamp)
            await cache.put(testDbName, "playerStats", { allyCode: 333333333 }, {
                allyCode: 333333333,
                name: "Empty Roster Player",
                updated: now,
                roster: [],
            });

            await cache.put(testDbName, "playerStats", { allyCode: 444444444 }, {
                allyCode: 444444444,
                name: "Valid Player",
                updated: now,
                roster: [{ defId: "Rey", rarity: 7 }],
            });

            const result = await databaseCleanup.cleanEmptyRosters();

            assert.match(result, /Deleted 1 player/);

            const remaining = await cache.get(testDbName, "playerStats", {});
            assert.equal(remaining.length, 1);
            assert.equal(remaining[0].allyCode, 444444444);
        });
    });

    describe("getCleanupStats", () => {
        it("should return accurate statistics", async () => {
            const now = Date.now();
            const oldTime = now - 10 * 24 * 60 * 60 * 1000;

            // Clean up previous test data
            await mongoClient.db(testDbName).collection("playerStats").deleteMany({});
            await mongoClient.db(testDbName).collection("guilds").deleteMany({});

            // Insert test data (autoUpdate: false to preserve our custom timestamps)
            await cache.put(testDbName, "playerStats", { allyCode: 555555555 }, {
                allyCode: 555555555,
                name: "Old Player",
                updated: oldTime,
                roster: [{ defId: "LUKE", rarity: 7 }],
            }, false);

            await cache.put(testDbName, "playerStats", { allyCode: 666666666 }, {
                allyCode: 666666666,
                name: "Empty Roster",
                updated: now,
                roster: [],
            }, false);

            await cache.put(testDbName, "guilds", { id: "old-guild-2" }, {
                id: "old-guild-2",
                name: "Old Guild 2",
                updated: oldTime,
                members: 50,
                gp: 100000000,
            }, false);

            const stats = await databaseCleanup.getCleanupStats(7);

            assert.equal(stats.oldPlayerStats, 1, "Should find 1 old player");
            assert.equal(stats.emptyRosters, 1, "Should find 1 empty roster");
            assert.equal(stats.oldGuilds, 1, "Should find 1 old guild");
            assert.equal(stats.totalToClean, 3, "Total should be 3");
        });
    });

    describe("start and stop", () => {
        it("should start and stop cleanup scheduler without errors", async () => {
            // Start the scheduler (this triggers immediate cleanup)
            databaseCleanup.start(24);

            // Wait a bit for the immediate cleanup to complete
            await new Promise((resolve) => setTimeout(resolve, 500));

            // Stop should not throw
            databaseCleanup.stop();
        });
    });
});
