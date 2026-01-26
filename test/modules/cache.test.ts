import assert from "node:assert";
import { after, before, describe, it } from "node:test";
import { MongoClient } from "mongodb";
import { Cache } from "../../modules/cache.ts";

describe("Cache Module", () => {
    let client: MongoClient;
    let cache: Cache;
    const testDbName = "test_cache_db";
    const testCollection = "test_collection";

    before(async () => {
        // Connect to MongoDB test instance (Docker container on port 27018)
        const mongoUrl = process.env.MONGO_URL || "mongodb://localhost:27018";
        client = await MongoClient.connect(mongoUrl);

        cache = new Cache();
        cache.init(client);
    });

    after(async () => {
        // Clean up test database
        try {
            await client.db(testDbName).dropDatabase();
        } catch (e) {
            // Ignore errors during cleanup
        }
        await client.close();
    });

    describe("init()", () => {
        it("initializes with MongoDB client", () => {
            const newCache = new Cache();
            newCache.init(client);
            // If no error thrown, initialization successful
            assert.ok(true);
        });
    });

    describe("put()", () => {
        it("creates a new document with autoUpdate", async () => {
            const testData = {
                userId: "123",
                name: "Test User",
                score: 100,
            };

            const result = await cache.put(testDbName, testCollection, { userId: "123" }, testData);

            assert.strictEqual(result.userId, "123");
            assert.strictEqual(result.name, "Test User");
            assert.strictEqual(result.score, 100);
            assert.ok(result.updated);
            assert.ok(result.updatedAt);
        });

        it("updates existing document", async () => {
            await cache.put(testDbName, testCollection, { userId: "456" }, { userId: "456", name: "Original" });

            const result = await cache.put(testDbName, testCollection, { userId: "456" }, { userId: "456", name: "Updated" });

            assert.strictEqual(result.name, "Updated");

            const retrieved = await cache.getOne(testDbName, testCollection, { userId: "456" });
            assert.strictEqual(retrieved?.name, "Updated");
        });

        it("respects autoUpdate=false", async () => {
            const testData = {
                userId: "789",
                name: "No Auto Update",
            };

            const result = await cache.put(testDbName, testCollection, { userId: "789" }, testData, false);

            assert.strictEqual(result.updated, undefined);
            assert.strictEqual(result.updatedAt, undefined);
        });

        it("does not include _id in update payload", async () => {
            const testData = {
                _id: "should-not-update",
                userId: "999",
                name: "Test",
            };

            await cache.put(testDbName, testCollection, { userId: "999" }, testData);

            const retrieved = await cache.getOne(testDbName, testCollection, { userId: "999" });
            // _id should be MongoDB-generated, not "should-not-update"
            assert.notStrictEqual(retrieved?._id?.toString(), "should-not-update");
        });
    });

    describe("putMany()", () => {
        it("inserts multiple documents", async () => {
            const operations = [
                { insertOne: { document: { userId: "bulk1", name: "Bulk User 1" } } },
                { insertOne: { document: { userId: "bulk2", name: "Bulk User 2" } } },
                { insertOne: { document: { userId: "bulk3", name: "Bulk User 3" } } },
            ];

            const result = await cache.putMany(testDbName, "bulk_collection", operations);

            assert.strictEqual(result.insertedCount, 3);
        });

        it("throws error for empty array", async () => {
            await assert.rejects(
                async () => await cache.putMany(testDbName, testCollection, []),
                /Object array is empty or missing/
            );
        });
    });

    describe("get()", () => {
        before(async () => {
            // Seed data for get tests
            await cache.put(testDbName, "get_test", { id: "1" }, { id: "1", type: "A", value: 10 });
            await cache.put(testDbName, "get_test", { id: "2" }, { id: "2", type: "A", value: 20 });
            await cache.put(testDbName, "get_test", { id: "3" }, { id: "3", type: "B", value: 30 });
        });

        it("returns all documents matching filter", async () => {
            const results = await cache.get(testDbName, "get_test", { type: "A" });

            assert.strictEqual(results.length, 2);
            assert.ok(results.every((r) => r.type === "A"));
        });

        it("returns all documents when filter is empty", async () => {
            const results = await cache.get(testDbName, "get_test", {});

            assert.ok(results.length >= 3);
        });

        it("respects limit parameter", async () => {
            const results = await cache.get(testDbName, "get_test", {}, undefined, 2);

            assert.strictEqual(results.length, 2);
        });

        it("applies projection to returned documents", async () => {
            const results = await cache.get(testDbName, "get_test", { type: "A" }, { value: 1, _id: 0 });

            assert.ok(results[0].value);
            assert.strictEqual(results[0].id, undefined);
        });
    });

    describe("getOne()", () => {
        before(async () => {
            await cache.put(testDbName, "getone_test", { userId: "single" }, { userId: "single", name: "Single User" });
        });

        it("returns single document matching filter", async () => {
            const result = await cache.getOne(testDbName, "getone_test", { userId: "single" });

            assert.ok(result);
            assert.strictEqual(result.userId, "single");
            assert.strictEqual(result.name, "Single User");
        });

        it("returns null when no match found", async () => {
            const result = await cache.getOne(testDbName, "getone_test", { userId: "nonexistent" });

            assert.strictEqual(result, null);
        });

        it("applies projection", async () => {
            const result = await cache.getOne(testDbName, "getone_test", { userId: "single" }, { name: 1, _id: 0 });

            assert.ok(result);
            assert.strictEqual(result.name, "Single User");
            assert.strictEqual(result.userId, undefined);
        });
    });

    describe("remove()", () => {
        it("deletes document matching filter", async () => {
            await cache.put(testDbName, "remove_test", { userId: "toDelete" }, { userId: "toDelete", name: "Will Be Deleted" });

            const result = await cache.remove(testDbName, "remove_test", { userId: "toDelete" });

            assert.strictEqual(result.deletedCount, 1);

            const retrieved = await cache.getOne(testDbName, "remove_test", { userId: "toDelete" });
            assert.strictEqual(retrieved, null);
        });

        it("returns 0 when no match found", async () => {
            const result = await cache.remove(testDbName, "remove_test", { userId: "doesNotExist" });

            assert.strictEqual(result.deletedCount, 0);
        });
    });

    describe("exists()", () => {
        before(async () => {
            await cache.put(testDbName, "exists_test", { userId: "exists" }, { userId: "exists", name: "I Exist" });
        });

        it("returns true when document exists", async () => {
            const result = await cache.exists(testDbName, "exists_test", { userId: "exists" });

            assert.strictEqual(result, true);
        });

        it("returns false when document does not exist", async () => {
            const result = await cache.exists(testDbName, "exists_test", { userId: "notFound" });

            assert.strictEqual(result, false);
        });
    });

    describe("getAggregate()", () => {
        before(async () => {
            await cache.put(testDbName, "aggregate_test", { id: "1" }, { id: "1", category: "electronics", price: 100 });
            await cache.put(testDbName, "aggregate_test", { id: "2" }, { id: "2", category: "electronics", price: 200 });
            await cache.put(testDbName, "aggregate_test", { id: "3" }, { id: "3", category: "books", price: 50 });
        });

        it("executes aggregation pipeline", async () => {
            const pipeline = [{ $match: { category: "electronics" } }, { $group: { _id: "$category", total: { $sum: "$price" } } }];

            const results = await cache.getAggregate(testDbName, "aggregate_test", pipeline);

            assert.strictEqual(results.length, 1);
            assert.strictEqual(results[0]._id, "electronics");
            assert.strictEqual(results[0].total, 300);
        });
    });

    describe("checkIndexes()", () => {
        it("returns list of indexes for collection", async () => {
            const indexes = await cache.checkIndexes(testDbName, testCollection);

            assert.ok(Array.isArray(indexes));
            assert.ok(indexes.length > 0);
            // Default _id index should always exist
            assert.ok(indexes.some((idx) => idx.name === "_id_"));
        });
    });

    describe("error handling", () => {
        it("throws error when database name is missing", async () => {
            await assert.rejects(async () => await cache.put("", testCollection, {}, {}), /Database name must be provided/);
        });

        it("throws error when database name is undefined", async () => {
            await assert.rejects(
                async () => await cache.put(undefined as any, testCollection, {}, {}),
                /Database name must be provided/
            );
        });
    });
});
