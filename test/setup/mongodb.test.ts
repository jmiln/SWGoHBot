import assert from "node:assert";
import { describe, it } from "node:test";
import { MongoClient } from "mongodb";

describe("MongoDB Testcontainer Setup", () => {
    it("should set MONGO_URL environment variable", () => {
        assert.ok(process.env.MONGO_URL, "MONGO_URL should be set");
        assert.ok(process.env.MONGO_URL.startsWith("mongodb://"), "MONGO_URL should be a valid MongoDB connection string");
    });

    it("should start a functional MongoDB instance", async () => {
        assert.ok(process.env.MONGO_URL, "MONGO_URL should be set");

        const client = new MongoClient(process.env.MONGO_URL);
        try {
            await client.connect();
            const adminDb = client.db("admin");
            const serverInfo = await adminDb.admin().serverInfo();
            assert.ok(serverInfo.version, "MongoDB should return version info");
            console.log(`Connected to MongoDB ${serverInfo.version}`);
        } finally {
            await client.close();
        }
    });

    it("should use port 27018 on host", () => {
        assert.ok(process.env.MONGO_URL, "MONGO_URL should be set");
        assert.ok(process.env.MONGO_URL.includes(":27018"), "MongoDB should be accessible on port 27018");
    });
});
