import assert from "node:assert/strict";
import test from "node:test";
import type { AnyBulkWriteOperation, Document, Filter, MongoClient } from "mongodb";
import createCache from "../../modules/cache.ts";

// Mock MongoDB client and database operations
function createMockMongoClient() {
    const operations = {
        updateOne: [] as any[],
        bulkWrite: [] as any[],
        find: [] as any[],
        findOne: [] as any[],
        deleteOne: [] as any[],
        replaceOne: [] as any[],
        listIndexes: [] as any[],
    };

    const mockCollection = {
        updateOne: async (filter: Filter<Document>, update: any, options: any) => {
            operations.updateOne.push({ filter, update, options });
            return { acknowledged: true, modifiedCount: 1, upsertedId: null, upsertedCount: 0, matchedCount: 1 };
        },
        bulkWrite: async (ops: readonly AnyBulkWriteOperation<Document>[]) => {
            operations.bulkWrite.push(ops);
            return { acknowledged: true, insertedCount: ops.length };
        },
        find: (filter: Filter<Document>) => {
            operations.find.push({ filter });
            return {
                limit: function (limit: number) {
                    return {
                        project: function (projection: Document) {
                            return {
                                toArray: async () => [{ _id: "1", name: "test" }],
                            };
                        },
                    };
                },
            };
        },
        findOne: async (filter: Filter<Document>, options?: any) => {
            operations.findOne.push({ filter, options });
            if (filter && (filter as any).exists === "yes") {
                return { _id: "1", name: "exists" };
            }
            return null;
        },
        deleteOne: async (filter: Filter<Document>) => {
            operations.deleteOne.push({ filter });
            return { acknowledged: true, deletedCount: 1 };
        },
        replaceOne: async (filter: Filter<Document>, replacement: Document, options: any) => {
            operations.replaceOne.push({ filter, replacement, options });
            return { acknowledged: true, modifiedCount: 1, upsertedId: null, upsertedCount: 0, matchedCount: 1 };
        },
        listIndexes: () => {
            return {
                toArray: async () => [
                    { v: 2, key: { _id: 1 }, name: "_id_" },
                    { v: 2, key: { name: 1 }, name: "name_1" },
                ],
            };
        },
    };

    const mockDb = {
        collection: (name: string) => mockCollection,
    };

    const client = {
        db: (name: string) => mockDb,
        _operations: operations,
    } as unknown as MongoClient & { _operations: typeof operations };

    return client;
}

test.describe("Cache Module", () => {
    test.describe("put()", () => {
        test("should insert document with auto-update timestamps", async () => {
            const client = createMockMongoClient();
            const cache = createCache(client);

            const saveObject = { name: "test", value: 123 };
            const result = await cache.put("testdb", "testcol", { _id: "1" }, saveObject);

            assert.ok(result.updated);
            assert.ok(result.updatedAt);
            assert.equal(result.name, "test");
            assert.equal(result.value, 123);

            const ops = (client as any)._operations.updateOne;
            assert.equal(ops.length, 1);
            assert.deepEqual(ops[0].filter, { _id: "1" });
            assert.equal(ops[0].options.upsert, true);
        });

        test("should not add timestamps when autoUpdate is false", async () => {
            const client = createMockMongoClient();
            const cache = createCache(client);

            const saveObject = { name: "test" };
            const result = await cache.put("testdb", "testcol", { _id: "1" }, saveObject, false);

            assert.equal(result.updated, undefined);
            assert.equal(result.updatedAt, undefined);
        });

        test("should throw error if database is not specified", async () => {
            const client = createMockMongoClient();
            const cache = createCache(client);

            await assert.rejects(
                async () => await cache.put("", "testcol", { _id: "1" }, { name: "test" }),
                { message: "No database specified to put" }
            );
        });

        test("should throw error if collection is not specified", async () => {
            const client = createMockMongoClient();
            const cache = createCache(client);

            await assert.rejects(
                async () => await cache.put("testdb", "", { _id: "1" }, { name: "test" }),
                { message: "No collection specified to put" }
            );
        });

        test("should throw error if matchCondition is not specified", async () => {
            const client = createMockMongoClient();
            const cache = createCache(client);

            await assert.rejects(
                async () => await cache.put("testdb", "testcol", null as any, { name: "test" }),
                { message: "No match condition specified to put" }
            );
        });

        test("should throw error if saveObject is not provided", async () => {
            const client = createMockMongoClient();
            const cache = createCache(client);

            await assert.rejects(
                async () => await cache.put("testdb", "testcol", { _id: "1" }, null as any),
                { message: "No object provided to put" }
            );
        });
    });

    test.describe("putMany()", () => {
        test("should perform bulk write operations", async () => {
            const client = createMockMongoClient();
            const cache = createCache(client);

            const operations = [
                { insertOne: { document: { name: "doc1" } } },
                { insertOne: { document: { name: "doc2" } } },
            ] as readonly AnyBulkWriteOperation<Document>[];

            const result = await cache.putMany("testdb", "testcol", operations);

            assert.equal(result.acknowledged, true);
            const ops = (client as any)._operations.bulkWrite;
            assert.equal(ops.length, 1);
            assert.equal(ops[0].length, 2);
        });

        test("should throw error if database is not specified", async () => {
            const client = createMockMongoClient();
            const cache = createCache(client);

            await assert.rejects(
                async () => await cache.putMany("", "testcol", []),
                { message: "No database specified to putMany" }
            );
        });

        test("should throw error if collection is not specified", async () => {
            const client = createMockMongoClient();
            const cache = createCache(client);

            await assert.rejects(
                async () => await cache.putMany("testdb", "", []),
                { message: "No collection specified to putMany" }
            );
        });

        test("should throw error if saveObjectArray is empty", async () => {
            const client = createMockMongoClient();
            const cache = createCache(client);

            await assert.rejects(
                async () => await cache.putMany("testdb", "testcol", []),
                { message: "Object array is empty or missing" }
            );
        });
    });

    test.describe("get()", () => {
        test("should retrieve documents with query filter", async () => {
            const client = createMockMongoClient();
            const cache = createCache(client);

            const result = await cache.get("testdb", "testcol", { name: "test" }, {}, 10);

            assert.equal(Array.isArray(result), true);
            assert.equal(result.length, 1);
            assert.equal(result[0].name, "test");
        });

        test("should throw error if database is not specified", async () => {
            const client = createMockMongoClient();
            const cache = createCache(client);

            await assert.rejects(
                async () => await cache.get("", "testcol", { name: "test" }, {}),
                { message: "No database specified to get" }
            );
        });

        test("should throw error if collection is not specified", async () => {
            const client = createMockMongoClient();
            const cache = createCache(client);

            await assert.rejects(
                async () => await cache.get("testdb", "", { name: "test" }, {}),
                { message: "No collection specified to get" }
            );
        });

        test("should throw error if matchCondition is not specified", async () => {
            const client = createMockMongoClient();
            const cache = createCache(client);

            await assert.rejects(
                async () => await cache.get("testdb", "testcol", null as any, {}),
                { message: "No match condition specified to get" }
            );
        });
    });

    test.describe("getOne()", () => {
        test("should retrieve a single document", async () => {
            const client = createMockMongoClient();
            const cache = createCache(client);

            const result = await cache.getOne("testdb", "testcol", { exists: "yes" }, {});

            assert.ok(result);
            assert.equal(result.name, "exists");
        });

        test("should return null if document not found", async () => {
            const client = createMockMongoClient();
            const cache = createCache(client);

            const result = await cache.getOne("testdb", "testcol", { exists: "no" }, {});

            assert.equal(result, null);
        });

        test("should throw error if database is not specified", async () => {
            const client = createMockMongoClient();
            const cache = createCache(client);

            await assert.rejects(
                async () => await cache.getOne("", "testcol", { name: "test" }, {}),
                { message: "No database specified to get" }
            );
        });

        test("should throw error if collection is not specified", async () => {
            const client = createMockMongoClient();
            const cache = createCache(client);

            await assert.rejects(
                async () => await cache.getOne("testdb", "", { name: "test" }, {}),
                { message: "No collection specified to get" }
            );
        });

        test("should throw error if matchCondition is not specified", async () => {
            const client = createMockMongoClient();
            const cache = createCache(client);

            await assert.rejects(
                async () => await cache.getOne("testdb", "testcol", null as any, {}),
                { message: "No match condition specified to get" }
            );
        });
    });

    test.describe("remove()", () => {
        test("should delete a document", async () => {
            const client = createMockMongoClient();
            const cache = createCache(client);

            const result = await cache.remove("testdb", "testcol", { _id: "1" });

            assert.equal(result.acknowledged, true);
            assert.equal(result.deletedCount, 1);

            const ops = (client as any)._operations.deleteOne;
            assert.equal(ops.length, 1);
            assert.deepEqual(ops[0].filter, { _id: "1" });
        });

        test("should throw error if database is not specified", async () => {
            const client = createMockMongoClient();
            const cache = createCache(client);

            await assert.rejects(
                async () => await cache.remove("", "testcol", { _id: "1" }),
                { message: "No database specified to remove" }
            );
        });

        test("should throw error if collection is not specified", async () => {
            const client = createMockMongoClient();
            const cache = createCache(client);

            await assert.rejects(
                async () => await cache.remove("testdb", "", { _id: "1" }),
                { message: "No collection specified to remove" }
            );
        });

        test("should throw error if matchCondition is not specified", async () => {
            const client = createMockMongoClient();
            const cache = createCache(client);

            await assert.rejects(
                async () => await cache.remove("testdb", "testcol", null as any),
                { message: "No match condition specified to remove" }
            );
        });
    });

    test.describe("replace()", () => {
        test("should replace document with auto-update timestamps", async () => {
            const client = createMockMongoClient();
            const cache = createCache(client);

            const saveObject = { name: "replaced", value: 456 };
            const result = await cache.replace("testdb", "testcol", { _id: "1" }, saveObject);

            assert.ok(result.updated);
            assert.ok(result.updatedAt);
            assert.equal(result.name, "replaced");

            const ops = (client as any)._operations.replaceOne;
            assert.equal(ops.length, 1);
            assert.deepEqual(ops[0].filter, { _id: "1" });
            assert.equal(ops[0].options.upsert, true);
        });

        test("should not add timestamps when autoUpdate is false", async () => {
            const client = createMockMongoClient();
            const cache = createCache(client);

            const saveObject = { name: "replaced" };
            const result = await cache.replace("testdb", "testcol", { _id: "1" }, saveObject, false);

            assert.equal(result.updated, undefined);
            assert.equal(result.updatedAt, undefined);
        });

        test("should throw error if database is not specified", async () => {
            const client = createMockMongoClient();
            const cache = createCache(client);

            await assert.rejects(
                async () => await cache.replace("", "testcol", { _id: "1" }, { name: "test" }),
                { message: "No database specified to replace" }
            );
        });

        test("should throw error if collection is not specified", async () => {
            const client = createMockMongoClient();
            const cache = createCache(client);

            await assert.rejects(
                async () => await cache.replace("testdb", "", { _id: "1" }, { name: "test" }),
                { message: "No collection specified to replace" }
            );
        });

        test("should throw error if matchCondition is not specified", async () => {
            const client = createMockMongoClient();
            const cache = createCache(client);

            await assert.rejects(
                async () => await cache.replace("testdb", "testcol", null as any, { name: "test" }),
                { message: "No match condition specified to replace" }
            );
        });

        test("should throw error if saveObject is not provided", async () => {
            const client = createMockMongoClient();
            const cache = createCache(client);

            await assert.rejects(
                async () => await cache.replace("testdb", "testcol", { _id: "1" }, null as any),
                { message: "No object provided to replace" }
            );
        });
    });

    test.describe("exists()", () => {
        test("should return true if document exists", async () => {
            const client = createMockMongoClient();
            const cache = createCache(client);

            const result = await cache.exists("testdb", "testcol", { exists: "yes" });

            assert.equal(result, true);
        });

        test("should return false if document does not exist", async () => {
            const client = createMockMongoClient();
            const cache = createCache(client);

            const result = await cache.exists("testdb", "testcol", { exists: "no" });

            assert.equal(result, false);
        });

        test("should throw error if database is not specified", async () => {
            const client = createMockMongoClient();
            const cache = createCache(client);

            await assert.rejects(
                async () => await cache.exists("", "testcol", { _id: "1" }),
                { message: "No database specified to check the existence of" }
            );
        });

        test("should throw error if collection is not specified", async () => {
            const client = createMockMongoClient();
            const cache = createCache(client);

            await assert.rejects(
                async () => await cache.exists("testdb", "", { _id: "1" }),
                { message: "No collection specified to check the existence of" }
            );
        });

        test("should throw error if matchCondition is not specified", async () => {
            const client = createMockMongoClient();
            const cache = createCache(client);

            await assert.rejects(
                async () => await cache.exists("testdb", "testcol", null as any),
                { message: "No match condition specified to check the existence of" }
            );
        });
    });

    test.describe("checkIndexes()", () => {
        test("should return list of indexes", async () => {
            const client = createMockMongoClient();
            const cache = createCache(client);

            const result = await cache.checkIndexes("testdb", "testcol");

            assert.equal(Array.isArray(result), true);
            assert.equal(result.length, 2);
            assert.equal(result[0].name, "_id_");
            assert.equal(result[1].name, "name_1");
        });
    });
});
