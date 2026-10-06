import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import type { MongoClient } from "mongodb";
import { env } from "../../config/config.ts";
import indexConfig from "../../config/indexes.ts";
import cache from "../../modules/cache.ts";
import databaseCleanup from "../../modules/databaseCleanup.ts";
import { closeMongoClient, getMongoClient } from "../helpers/mongodb.ts";

// indexConfig is keyed by the db name at import time, before the hook below swaps it for the test db
const SWAPI_DB = env.MONGODB_SWAPI_DB;
const SEVEN_DAYS_S = 7 * 24 * 60 * 60;
const TTL_COLLECTIONS = ["playerStats", "guilds", "rawPlayers", "rawGuilds"];

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

    describe("TTL expiry", () => {
        for (const collection of TTL_COLLECTIONS) {
            it(`expires ${collection} 7 days after updatedAt, with no index left on the legacy field`, () => {
                const indexes = indexConfig[SWAPI_DB][collection];
                const ttl = indexes.filter((idx) => idx.options?.expireAfterSeconds !== undefined);
                assert.deepStrictEqual(
                    ttl.map((idx) => ({ key: idx.key, expireAfterSeconds: idx.options?.expireAfterSeconds })),
                    [{ key: { updatedAt: 1 }, expireAfterSeconds: SEVEN_DAYS_S }],
                );
                // MongoDB refuses a second index on a key that differs only by options
                assert.strictEqual(indexes.filter((idx) => JSON.stringify(idx.key) === JSON.stringify({ updatedAt: 1 })).length, 1);
                assert.ok(!indexes.some((idx) => "updated" in idx.key), "The { updated: 1 } index must be gone");
            });
        }
    });

    describe("runManualCleanup", () => {
        it("removes empty rosters but leaves age-based expiry to the TTL indexes", async () => {
            const playerStats = mongoClient.db(testDbName).collection("playerStats");
            await playerStats.deleteMany({});
            const tenDaysAgo = Date.now() - 10 * 24 * 60 * 60 * 1000;
            await playerStats.insertMany([
                // A pre-change production doc: both fields, old enough that the age-based cleanup deleted it
                {
                    allyCode: 777777777,
                    name: "Old Player",
                    updated: tenDaysAgo,
                    updatedAt: new Date(tenDaysAgo),
                    roster: [{ defId: "LUKE", rarity: 7 }],
                },
                { allyCode: 888888888, name: "Empty Roster", updatedAt: new Date(), roster: [] },
            ]);

            await databaseCleanup.runManualCleanup();

            const remaining = await playerStats.find({}, { projection: { _id: 0, allyCode: 1 } }).toArray();
            assert.deepStrictEqual(
                remaining.map((doc) => doc.allyCode),
                [777777777],
                "Only the empty roster should go; age is the TTL index's job",
            );
        });
    });

    describe("cleanEmptyRosters", () => {
        it("should delete player records with empty rosters", async () => {
            // Clean up any leftover data from previous tests
            await mongoClient.db(testDbName).collection("playerStats").deleteMany({});

            // Insert test data (no autoUpdate needed, roster check doesn't depend on timestamp)
            await cache.put(
                testDbName,
                "playerStats",
                { allyCode: 333333333 },
                {
                    allyCode: 333333333,
                    name: "Empty Roster Player",
                    roster: [],
                },
            );

            await cache.put(
                testDbName,
                "playerStats",
                { allyCode: 444444444 },
                {
                    allyCode: 444444444,
                    name: "Valid Player",
                    roster: [{ defId: "Rey", rarity: 7 }],
                },
            );

            const result = await databaseCleanup.cleanEmptyRosters();

            assert.match(result, /Deleted 1 player/);

            const remaining = await cache.get(testDbName, "playerStats", {});
            assert.equal(remaining.length, 1);
            assert.equal(remaining[0].allyCode, 444444444);
        });
    });

    describe("start and stop", () => {
        it("should start and stop cleanup scheduler without errors", async () => {
            // Start the scheduler (this triggers immediate cleanup)
            databaseCleanup.start(24);

            // Stop should not throw
            await databaseCleanup.stop();
        });

        it("stop() waits for the in-flight initial cleanup instead of abandoning it", async () => {
            // Callers close the db and process.exit() straight after stop(), so stop() must not
            // resolve while the cleanup start() kicked off is still deleting.
            databaseCleanup.start(24);
            assert.equal(databaseCleanup.isCleanupRunning, true, "start() should kick off an immediate cleanup");

            await databaseCleanup.stop();
            assert.equal(databaseCleanup.isCleanupRunning, false, "stop() should not resolve while a cleanup is still running");
        });

        it("stop() is safe when the scheduler was never started", async () => {
            await databaseCleanup.stop();
            assert.equal(databaseCleanup.isCleanupRunning, false);
        });
    });
});
