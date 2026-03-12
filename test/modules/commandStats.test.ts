import assert from "node:assert";
import { after, before, describe, it } from "node:test";
import { MongoClient } from "mongodb";
import { env } from "../../config/config.ts";
import { getCommandDetail, STATS_WINDOW_MS } from "../../modules/commandStats.ts";
import database from "../../modules/database.ts";
import { closeMongoClient, getMongoClient } from "../helpers/mongodb.ts";

describe("commandStats module", () => {
    let mongoClient: MongoClient;
    const db = () => mongoClient.db(env.MONGODB_SWGOHBOT_DB);
    const col = () => db().collection("commandStats");

    before(async () => {
        mongoClient = await getMongoClient();
        database.init(mongoClient);

        // Seed test data
        const now = Date.now();
        await col().insertMany([
            { commandName: "mods", subcommand: null, count: 10, success: true,  executionTime: 200, timestamp: now },
            { commandName: "mods", subcommand: null, count: 5,  success: false, executionTime: 400, timestamp: now },
            { commandName: "mods", subcommand: null, count: 3,  success: true,  executionTime: 100, timestamp: now },
            { commandName: "mymods", subcommand: "best",      count: 8, success: true, executionTime: 150, timestamp: now },
            { commandName: "mymods", subcommand: "character", count: 4, success: true, executionTime: 120, timestamp: now },
        ]);
    });

    after(async () => {
        await col().drop().catch(() => {});
        await closeMongoClient();
    });

    describe("getCommandDetail()", () => {
        it("returns total count for a command", async () => {
            const now = Date.now();
            const result = await getCommandDetail("mods", now - STATS_WINDOW_MS, now);
            assert.strictEqual(result.totalCount, 18); // 10 + 5 + 3
            assert.deepStrictEqual(result.subcommandCounts, {});
        });

        it("returns success rate", async () => {
            const now = Date.now();
            const result = await getCommandDetail("mods", now - STATS_WINDOW_MS, now);
            // 13 successes / 18 total = 72.2... → Math.round → 72
            assert.strictEqual(result.successRate, 72);
        });

        it("returns subcommand counts when subcommands exist", async () => {
            const now = Date.now();
            const result = await getCommandDetail("mymods", now - STATS_WINDOW_MS, now);
            assert.strictEqual(result.totalCount, 12); // 8 + 4
            assert.strictEqual(result.subcommandCounts["best"], 8);
            assert.strictEqual(result.subcommandCounts["character"], 4);
        });

        it("returns null avgExecutionTime when no timing data", async () => {
            // Insert a record with no executionTime
            const now = Date.now();
            await col().insertOne({ commandName: "notimed", count: 1, success: true, timestamp: now });
            const result = await getCommandDetail("notimed", now - STATS_WINDOW_MS, now);
            assert.ok(result.totalCount >= 1);
            assert.strictEqual(result.avgExecutionTime, null);
        });

        it("returns zero totalCount for unknown command", async () => {
            const now = Date.now();
            const result = await getCommandDetail("doesnotexist", now - STATS_WINDOW_MS, now);
            assert.strictEqual(result.totalCount, 0);
            assert.strictEqual(result.successRate, 0);
            assert.strictEqual(result.avgExecutionTime, null);
        });
    });
});
