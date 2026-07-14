import assert from "node:assert";
import { after, before, describe, it } from "node:test";
import cache from "../../modules/cache.ts";
import type { GahistoryClient } from "../../modules/counters/gahistoryClient.ts";
import { DEFAULT_BUILD_OPTIONS } from "../../modules/counters/counterAggregator.ts";
import counterUpdater from "../../services/counterUpdater.ts";
import { closeMongoClient, getMongoClient } from "../helpers/mongodb.ts";

const { shouldIngest, runMode } = counterUpdater;

// File-unique isolation: dedicated db name + unique instanceId/leader so we never touch shared data.
const TEST_DB = "counterUpdater_test_db";
const INSTANCE = "TEST_CU_O1";
const LEADER = "TESTLEADER_CU";

const duel = (outcome: number) => ({
    defenderUnit: [{ definitionId: `${LEADER}:X`, squadUnitType: 2 }, { definitionId: "DEF2:X", squadUnitType: 1 }],
    attackerUnit: [{ definitionId: "ATK_CU:X", squadUnitType: 2 }],
    battleOutcome: outcome,
});

const fakeClient: GahistoryClient = {
    getInfo: async () => ({ instanceId: INSTANCE, season: 80, eventInstanceId: `E:${INSTANCE}` }),
    getPlayerIds: async () => ["p1", "p2"],
    getPlayer: async () => ({ matchResult: [{ attackResult: [{ duelResult: [duel(1), duel(1), duel(2)] }] }] }),
};

describe("counterUpdater", () => {
    before(async () => {
        // cache is a process-wide singleton; every service/module test that touches it
        // must connect + init it itself (see test/modules/arenaPlayerRegistry.test.ts).
        const client = await getMongoClient();
        cache.init(client);
    });

    after(async () => {
        await cache.delete(TEST_DB, "counterData", { instanceId: INSTANCE });
        await cache.delete(TEST_DB, "counterData", { instanceId: "STALE_CU_O0" });
        await cache.delete(TEST_DB, "counterData", { _id: "meta:5v5" });
        await cache.delete(TEST_DB, "counterData", { _id: "meta:3v3" });
        await closeMongoClient();
    });

    it("shouldIngest is true when the instanceId advances", () => {
        assert.strictEqual(shouldIngest({ instanceId: "O2", season: 1, eventInstanceId: "" }, { _id: "meta:5v5", lastInstanceId: "O1", season: 1, status: "ok" }), true);
        assert.strictEqual(shouldIngest({ instanceId: "O2", season: 1, eventInstanceId: "" }, { _id: "meta:5v5", lastInstanceId: "O2", season: 1, status: "ok" }), false);
        assert.strictEqual(shouldIngest({ instanceId: "O2", season: 1, eventInstanceId: "" }, null), true);
    });

    it("ingests players into counterData and advances the cursor", async () => {
        const res = await runMode("5v5", { client: fakeClient, db: TEST_DB, concurrency: 2, options: { ...DEFAULT_BUILD_OPTIONS, minBattles: 1 } });
        assert.strictEqual(res.ingested, true);
        assert.ok(res.docCount >= 1);

        const docs = await cache.get(TEST_DB, "counterData", { instanceId: INSTANCE, leader: LEADER });
        assert.strictEqual(docs.length, 1);
        // 2 players x (2 wins + 1 loss) = 6 attacks, 4 wins
        assert.deepStrictEqual([docs[0].overall.counters[0].wins, docs[0].overall.counters[0].total], [4, 6]);

        const cursor = await cache.getOne(TEST_DB, "counterData", { _id: "meta:5v5" });
        assert.strictEqual(cursor?.lastInstanceId, INSTANCE);
    });

    it("skips a mode whose cursor already matches (no re-ingest)", async () => {
        const res = await runMode("5v5", { client: fakeClient, db: TEST_DB, concurrency: 2, options: { ...DEFAULT_BUILD_OPTIONS, minBattles: 1 } });
        assert.strictEqual(res.ingested, false);
    });

    it("does not prune existing docs or advance the cursor when the source has no player data yet", async () => {
        // A new event's info.json is posted, but players.json is still empty (data not fully published).
        const emptyClient: GahistoryClient = {
            getInfo: async () => ({ instanceId: "NEW_CU_O2", season: 81, eventInstanceId: "E:NEW_CU_O2" }),
            getPlayerIds: async () => [],
            getPlayer: async () => null,
        };
        // Seed a counter doc from a prior event; it must survive a data-not-ready run.
        await cache.put(
            TEST_DB,
            "counterData",
            { mode: "3v3", battleType: "char", leader: LEADER },
            { mode: "3v3", battleType: "char", leader: LEADER, instanceId: "STALE_CU_O0", season: 80, overall: { sampleN: 1, counters: [] }, variants: [] },
        );

        const res = await runMode("3v3", { client: emptyClient, db: TEST_DB, concurrency: 2, options: { ...DEFAULT_BUILD_OPTIONS, minBattles: 1 } });
        assert.strictEqual(res.ingested, false);

        // Existing doc untouched (not pruned despite its stale instanceId)...
        const survivors = await cache.get(TEST_DB, "counterData", { instanceId: "STALE_CU_O0", leader: LEADER });
        assert.strictEqual(survivors.length, 1);
        // ...and the cursor was never created, so the next tick retries.
        const cursor = await cache.getOne(TEST_DB, "counterData", { _id: "meta:3v3" });
        assert.strictEqual(cursor, null);
    });
});
