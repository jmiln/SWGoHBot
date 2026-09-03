import assert from "node:assert";
import { after, before, beforeEach, describe, it } from "node:test";
import { MongoClient } from "mongodb";
import { env } from "../../config/config.ts";
import arenaPlayerRegistry from "../../modules/arenaPlayerRegistry.ts";
import {
    AUTOCOMPLETE_CACHE_TTL_MS,
    getCachedAllyCodeChoices,
    getCachedGuildAliases,
    getCachedUserLang,
    invalidateAllyCodeCache,
} from "../../modules/autocompleteCache.ts";
import { defaultGuildSettings } from "../../schemas/guildConfigs.schema.ts";
import cache from "../../modules/cache.ts";
import { reloadLanguages } from "../../modules/functions.ts";
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

        // getCachedUserLang builds a Language, which throws unless the files are registered.
        await reloadLanguages();

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

            // Change the DB inside the TTL window - the cached copy must still be served
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

    describe("getCachedUserLang() precedence", () => {
        // File-unique ids per the shared-Mongo rule. Do not reuse the mock defaults.
        const LANG_USER_BARE = "ac_lang_user_bare";
        const LANG_USER_OWN = "ac_lang_user_own";
        const LANG_USER_TWO = "ac_lang_user_two";
        const LANG_GUILD_DE = "ac_lang_guild_de";
        const LANG_GUILD_FR = "ac_lang_guild_fr";
        const LANG_GUILD_UNSET = "ac_lang_guild_unset";
        const LANG_USERS = [LANG_USER_BARE, LANG_USER_OWN, LANG_USER_TWO];
        const LANG_GUILDS = [LANG_GUILD_DE, LANG_GUILD_FR, LANG_GUILD_UNSET];

        beforeEach(async () => {
            await client.db(db).collection("users").deleteMany({ id: { $in: LANG_USERS } });
            await client.db(db).collection("guildConfigs").deleteMany({ guildId: { $in: LANG_GUILDS } });

            // Settings live under a `settings` subdocument, which is what getGuildSettings reads.
            await client
                .db(db)
                .collection("guildConfigs")
                .insertMany([
                    { guildId: LANG_GUILD_DE, settings: { swgohLanguage: "GER_DE" } },
                    { guildId: LANG_GUILD_FR, settings: { swgohLanguage: "FRE_FR" } },
                ]);
            await client.db(db).collection("users").insertOne({ id: LANG_USER_OWN, lang: { swgohLanguage: "KOR_KR" } });
        });

        after(async () => {
            await client.db(db).collection("users").deleteMany({ id: { $in: LANG_USERS } });
            await client.db(db).collection("guildConfigs").deleteMany({ guildId: { $in: LANG_GUILDS } });
        });

        it("uses the guild's swgohLanguage when the user has not set one", async () => {
            const res = await getCachedUserLang(LANG_USER_BARE, LANG_GUILD_DE);
            assert.strictEqual(res.swgohLanguage, "GER_DE");
        });

        it("lets the user's own setting win over the guild's", async () => {
            const res = await getCachedUserLang(LANG_USER_OWN, LANG_GUILD_DE);
            assert.strictEqual(res.swgohLanguage, "KOR_KR");
        });

        it("falls back to the default when neither is set", async () => {
            const res = await getCachedUserLang(LANG_USER_BARE, LANG_GUILD_UNSET);
            assert.strictEqual(res.swgohLanguage, defaultGuildSettings.swgohLanguage);
        });

        it("keys the cache by guild so one user in two servers gets two answers", async () => {
            const de = await getCachedUserLang(LANG_USER_TWO, LANG_GUILD_DE);
            const fr = await getCachedUserLang(LANG_USER_TWO, LANG_GUILD_FR);
            assert.strictEqual(de.swgohLanguage, "GER_DE");
            assert.strictEqual(fr.swgohLanguage, "FRE_FR");
        });
    });

    it("refetches once the TTL has elapsed", async (t) => {
        const start = Date.now();
        t.mock.timers.enable({ apis: ["Date"], now: start });

        await getCachedAllyCodeChoices(AC_USER_ID, "");
        assert.strictEqual(batchGetCalls, 1);

        // Still inside the TTL window - cached
        t.mock.timers.setTime(start + AUTOCOMPLETE_CACHE_TTL_MS - 1);
        await getCachedAllyCodeChoices(AC_USER_ID, "");
        assert.strictEqual(batchGetCalls, 1);

        // Past the TTL - must refetch
        t.mock.timers.setTime(start + AUTOCOMPLETE_CACHE_TTL_MS + 1);
        await getCachedAllyCodeChoices(AC_USER_ID, "");
        assert.strictEqual(batchGetCalls, 2);
    });
});
