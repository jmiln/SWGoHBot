import assert from "node:assert";
import { after, before, beforeEach, describe, it } from "node:test";
import { MongoClient } from "mongodb";
import { env } from "../../config/config.ts";
import arenaPlayerRegistry from "../../modules/arenaPlayerRegistry.ts";
import {
    ALLYCODE_CACHE_TTL_MS,
    getCachedAllyCodeChoices,
    invalidateAllyCodeCache,
} from "../../modules/autocompleteCache.ts";
import cache from "../../modules/cache.ts";
import userReg from "../../modules/users.ts";
import { closeMongoClient, getMongoClient } from "../helpers/mongodb.ts";

describe("autocompleteCache", () => {
    let client: MongoClient;
    const db = env.MONGODB_SWGOHBOT_DB;

    const AC_USER_ID = "ac_cache_test_user";
    const AC_ALLY_CODES = [565656561, 565656562];

    // Count registry fetches by wrapping the real batchGet
    const realBatchGet = arenaPlayerRegistry.batchGet.bind(arenaPlayerRegistry);
    let batchGetCalls = 0;

    before(async () => {
        client = await getMongoClient();
        cache.init(client);
        userReg.init(cache);
        arenaPlayerRegistry.init(cache);

        arenaPlayerRegistry.batchGet = async (codes: number[]) => {
            batchGetCalls++;
            return realBatchGet(codes);
        };
    });

    after(async () => {
        arenaPlayerRegistry.batchGet = realBatchGet;
        await client.db(db).collection("users").deleteMany({ id: AC_USER_ID });
        await client.db(db).collection("arenaPlayers").deleteMany({ allyCode: { $in: AC_ALLY_CODES } });
        await closeMongoClient();
    });

    beforeEach(async () => {
        batchGetCalls = 0;
        invalidateAllyCodeCache(AC_USER_ID);
        await client.db(db).collection("users").deleteMany({ id: AC_USER_ID });
        await client.db(db).collection("arenaPlayers").deleteMany({ allyCode: { $in: AC_ALLY_CODES } });

        await client.db(db).collection("users").insertOne({ id: AC_USER_ID, accounts: AC_ALLY_CODES });
        await client.db(db).collection("arenaPlayers").insertMany([
            { allyCode: 565656561, name: "Alpha" },
            { allyCode: 565656562, name: "Beta" },
        ]);
    });

    it("fetches and returns the user's account choices", async () => {
        const choices = await getCachedAllyCodeChoices(AC_USER_ID, "");
        assert.deepStrictEqual(choices, [
            { name: "Alpha - 565656561", value: "565656561" },
            { name: "Beta - 565656562", value: "565656562" },
        ]);
        assert.strictEqual(batchGetCalls, 1);
    });

    it("filters subsequent keystrokes in memory without re-querying", async () => {
        await getCachedAllyCodeChoices(AC_USER_ID, "");
        const filtered = await getCachedAllyCodeChoices(AC_USER_ID, "bet");
        assert.deepStrictEqual(filtered, [{ name: "Beta - 565656562", value: "565656562" }]);
        assert.strictEqual(batchGetCalls, 1, "the second keystroke must be served from the cache");
    });

    it("returns an empty array (and caches it) for an unregistered user", async () => {
        const choices = await getCachedAllyCodeChoices("ac_cache_nobody", "");
        assert.deepStrictEqual(choices, []);
        await getCachedAllyCodeChoices("ac_cache_nobody", "x");
        assert.strictEqual(batchGetCalls, 0, "no accounts means no registry query at all");
        invalidateAllyCodeCache("ac_cache_nobody");
    });

    it("refetches after explicit invalidation (test-isolation helper)", async () => {
        await getCachedAllyCodeChoices(AC_USER_ID, "");
        await client.db(db).collection("users").updateOne({ id: AC_USER_ID }, { $set: { accounts: [565656561] } });
        invalidateAllyCodeCache(AC_USER_ID);

        const choices = await getCachedAllyCodeChoices(AC_USER_ID, "");
        assert.deepStrictEqual(choices, [{ name: "Alpha - 565656561", value: "565656561" }]);
        assert.strictEqual(batchGetCalls, 2);
    });

    it("refetches once the TTL has elapsed", async (t) => {
        const start = Date.now();
        t.mock.timers.enable({ apis: ["Date"], now: start });

        await getCachedAllyCodeChoices(AC_USER_ID, "");
        assert.strictEqual(batchGetCalls, 1);

        // Still inside the TTL window — cached
        t.mock.timers.setTime(start + ALLYCODE_CACHE_TTL_MS - 1);
        await getCachedAllyCodeChoices(AC_USER_ID, "");
        assert.strictEqual(batchGetCalls, 1);

        // Past the TTL — must refetch
        t.mock.timers.setTime(start + ALLYCODE_CACHE_TTL_MS + 1);
        await getCachedAllyCodeChoices(AC_USER_ID, "");
        assert.strictEqual(batchGetCalls, 2);
    });
});
