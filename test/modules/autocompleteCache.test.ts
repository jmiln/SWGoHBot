import assert from "node:assert";
import { after, before, beforeEach, describe, it } from "node:test";
import { MongoClient } from "mongodb";
import { env } from "../../config/config.ts";
import arenaPlayerRegistry from "../../modules/arenaPlayerRegistry.ts";
import {
    AUTOCOMPLETE_CACHE_TTL_MS,
    getCachedAllyCodeChoices,
    getCachedGuildAliases,
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

    describe("getCachedGuildAliases()", () => {
        const AC_GUILD_ID = "ac_cache_test_guild";
        const aliasDoc = (alias: string) => [{ alias, name: "Darth Vader", defId: "VADER" }];

        beforeEach(async () => {
            await client.db(db).collection("guildConfigs").deleteMany({ guildId: AC_GUILD_ID });
            await client.db(db).collection("guildConfigs").insertOne({ guildId: AC_GUILD_ID, aliases: aliasDoc("dv") });
        });

        after(async () => {
            await client.db(db).collection("guildConfigs").deleteMany({ guildId: AC_GUILD_ID });
        });

        it("returns an empty array without querying when no guildId is given", async () => {
            assert.deepStrictEqual(await getCachedGuildAliases(undefined), []);
        });

        it("fetches the guild's aliases and serves repeats from the cache", async (t) => {
            const start = Date.now();
            t.mock.timers.enable({ apis: ["Date"], now: start });

            const first = await getCachedGuildAliases(AC_GUILD_ID);
            assert.deepStrictEqual(first, aliasDoc("dv"));

            // Change the DB inside the TTL window — the cached copy must still be served
            await client
                .db(db)
                .collection("guildConfigs")
                .updateOne({ guildId: AC_GUILD_ID }, { $set: { aliases: aliasDoc("vader") } });
            const cached = await getCachedGuildAliases(AC_GUILD_ID);
            assert.deepStrictEqual(cached, aliasDoc("dv"), "within the TTL the cached aliases must be returned");

            // Past the TTL the fresh data shows up
            t.mock.timers.setTime(start + AUTOCOMPLETE_CACHE_TTL_MS + 1);
            const fresh = await getCachedGuildAliases(AC_GUILD_ID);
            assert.deepStrictEqual(fresh, aliasDoc("vader"), "after the TTL the new aliases must be fetched");
        });
    });

    it("refetches once the TTL has elapsed", async (t) => {
        const start = Date.now();
        t.mock.timers.enable({ apis: ["Date"], now: start });

        await getCachedAllyCodeChoices(AC_USER_ID, "");
        assert.strictEqual(batchGetCalls, 1);

        // Still inside the TTL window — cached
        t.mock.timers.setTime(start + AUTOCOMPLETE_CACHE_TTL_MS - 1);
        await getCachedAllyCodeChoices(AC_USER_ID, "");
        assert.strictEqual(batchGetCalls, 1);

        // Past the TTL — must refetch
        t.mock.timers.setTime(start + AUTOCOMPLETE_CACHE_TTL_MS + 1);
        await getCachedAllyCodeChoices(AC_USER_ID, "");
        assert.strictEqual(batchGetCalls, 2);
    });
});
