import assert from "node:assert";
import { after, before, beforeEach, describe, it } from "node:test";
import { MongoClient } from "mongodb";
import { env } from "../../config/config.ts";
import cache from "../../modules/cache.ts";
import { ArenaPlayerRegistry } from "../../modules/arenaPlayerRegistry.ts";
import { closeMongoClient, getMongoClient } from "../helpers/mongodb.ts";

describe("ArenaPlayerRegistry", () => {
    let client: MongoClient;
    let registry: ArenaPlayerRegistry;
    const db = env.MONGODB_SWGOHBOT_DB;

    before(async () => {
        client = await getMongoClient();
        cache.init(client);
        registry = new ArenaPlayerRegistry();
        registry.init(cache);
    });

    // Use a fixed set of ally codes for this test file to avoid wiping documents
    // written by concurrent test files (arenawatch, patreonFuncs, etc.)
    const TEST_ALLY_CODES = [111111111, 222222222, 333333333, 999999999];

    after(async () => {
        await client.db(db).collection("arenaPlayers").deleteMany({ allyCode: { $in: TEST_ALLY_CODES } });
        await closeMongoClient();
    });

    beforeEach(async () => {
        await client.db(db).collection("arenaPlayers").deleteMany({ allyCode: { $in: TEST_ALLY_CODES } });
    });

    describe("getPlayer()", () => {
        it("returns null when player does not exist", async () => {
            const result = await registry.getPlayer(999999999);
            assert.strictEqual(result, null);
        });

        it("returns a player doc when it exists", async () => {
            await client.db(db).collection("arenaPlayers").insertOne({ allyCode: 111111111, name: "Alpha" });
            const result = await registry.getPlayer(111111111);
            assert.ok(result);
            assert.strictEqual(result.allyCode, 111111111);
            assert.strictEqual(result.name, "Alpha");
        });
    });

    describe("batchGet()", () => {
        it("returns an empty Map when no codes provided", async () => {
            const result = await registry.batchGet([]);
            assert.strictEqual(result.size, 0);
        });

        it("returns a Map keyed by allyCode", async () => {
            await client.db(db).collection("arenaPlayers").insertMany([
                { allyCode: 111111111, name: "Alpha" },
                { allyCode: 222222222, name: "Beta" },
            ]);
            const result = await registry.batchGet([111111111, 222222222, 333333333]);
            assert.strictEqual(result.size, 2);
            assert.strictEqual(result.get(111111111)?.name, "Alpha");
            assert.strictEqual(result.get(222222222)?.name, "Beta");
            assert.strictEqual(result.has(333333333), false);
        });
    });

    describe("upsertPlayer()", () => {
        it("inserts a new player", async () => {
            await registry.upsertPlayer({ allyCode: 111111111, name: "Alpha", lastCharRank: 10 });
            const doc = await client.db(db).collection("arenaPlayers").findOne({ allyCode: 111111111 });
            assert.ok(doc);
            assert.strictEqual(doc.name, "Alpha");
            assert.strictEqual(doc.lastCharRank, 10);
        });

        it("updates an existing player", async () => {
            await client.db(db).collection("arenaPlayers").insertOne({ allyCode: 111111111, name: "Old", lastCharRank: 5 });
            await registry.upsertPlayer({ allyCode: 111111111, name: "New", lastCharRank: 20 });
            const doc = await client.db(db).collection("arenaPlayers").findOne({ allyCode: 111111111 });
            assert.strictEqual(doc?.name, "New");
            assert.strictEqual(doc?.lastCharRank, 20);
        });

        it("does not overwrite stored fields with null when a key is explicitly undefined", async () => {
            // The driver serializes `undefined` as null in a $set unless stripped first —
            // re-adding a watched code without one arena type must not clobber the stored rank
            await client
                .db(db)
                .collection("arenaPlayers")
                .insertOne({ allyCode: 111111111, name: "Old", lastCharRank: 5, lastShipRank: 9 });
            await registry.upsertPlayer({ allyCode: 111111111, name: "New", lastCharRank: 7, lastShipRank: undefined });
            const doc = await client.db(db).collection("arenaPlayers").findOne({ allyCode: 111111111 });
            assert.strictEqual(doc?.lastCharRank, 7);
            assert.strictEqual(doc?.lastShipRank, 9, "an undefined key must not null out the stored rank");
        });
    });

    describe("batchUpsert()", () => {
        it("upserts multiple players", async () => {
            await registry.batchUpsert([
                { allyCode: 111111111, name: "Alpha", lastCharRank: 1 },
                { allyCode: 222222222, name: "Beta", lastCharRank: 2 },
            ]);
            const count = await client.db(db).collection("arenaPlayers").countDocuments({ allyCode: { $in: [111111111, 222222222] } });
            assert.strictEqual(count, 2);
        });

        it("is a no-op when given an empty array", async () => {
            await assert.doesNotReject(() => registry.batchUpsert([]));
        });

        it("does not overwrite stored fields with null when a key is explicitly undefined", async () => {
            await client
                .db(db)
                .collection("arenaPlayers")
                .insertOne({ allyCode: 222222222, name: "Old", lastCharRank: 5, lastShipRank: 9 });
            await registry.batchUpsert([{ allyCode: 222222222, name: "New", lastCharRank: 7, lastShipRank: undefined }]);
            const doc = await client.db(db).collection("arenaPlayers").findOne({ allyCode: 222222222 });
            assert.strictEqual(doc?.lastCharRank, 7);
            assert.strictEqual(doc?.lastShipRank, 9, "an undefined key must not null out the stored rank");
        });

        it("round-trips docs fetched via batchGet (arenaTick flush path)", async () => {
            // arenaTick flushes the very docs batchGet returned — those carry Mongo's _id,
            // which must never end up inside the $set payload
            await client.db(db).collection("arenaPlayers").insertOne({ allyCode: 333333333, name: "Cycle", lastCharRank: 4 });

            const fetched = await registry.batchGet([333333333]);
            const doc = fetched.get(333333333);
            assert.ok(doc);
            doc.lastCharRank = 2;
            await registry.batchUpsert([doc]);

            const stored = await client.db(db).collection("arenaPlayers").findOne({ allyCode: 333333333 });
            assert.strictEqual(stored?.lastCharRank, 2);
            assert.ok(!("_id" in (doc as Record<string, unknown>)) || stored?._id, "flush must not corrupt the doc");
        });
    });
});
