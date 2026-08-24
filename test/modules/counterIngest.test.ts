import assert from "node:assert";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import cache from "../../modules/cache.ts";
import { DEFAULT_BUILD_OPTIONS } from "../../modules/counters/counterAggregator.ts";
import { runAllModes, runMode, shouldIngest } from "../../modules/counters/counterIngest.ts";
import { readMetadata } from "../../modules/counters/counterMetadata.ts";
import type { GahistoryClient } from "../../modules/counters/gahistoryClient.ts";
import { closeMongoClient, getMongoClient } from "../helpers/mongodb.ts";

// File-unique isolation: dedicated db name + unique instanceId/leader so we never touch shared data.
const TEST_DB = "counterIngest_test_db";
const INSTANCE = "TEST_CI_O1";
const LEADER = "TESTLEADER_CI";
// Must never be the real data/counterMetadata.json - a test run must not move production's bookmark.
const META_FILE = path.join(mkdtempSync(path.join(tmpdir(), "counterIngest-")), "counterMetadata.json");

const duel = (outcome: number) => ({
    defenderUnit: [{ definitionId: `${LEADER}:X`, squadUnitType: 2 }, { definitionId: "DEF2:X", squadUnitType: 1 }],
    attackerUnit: [{ definitionId: "ATK_CI:X", squadUnitType: 2 }],
    battleOutcome: outcome,
});

const fakeClient: GahistoryClient = {
    getInfo: async () => ({ instanceId: INSTANCE, season: 80, eventInstanceId: `E:${INSTANCE}` }),
    getPlayerIds: async () => ["p1", "p2"],
    getPlayer: async () => ({ matchResult: [{ attackResult: [{ duelResult: [duel(1), duel(1), duel(2)] }] }] }),
};

const baseDeps = { db: TEST_DB, concurrency: 2, options: { ...DEFAULT_BUILD_OPTIONS, minBattles: 1 }, metaFile: META_FILE };

describe("counterIngest", () => {
    before(async () => {
        // cache is a process-wide singleton; every service/module test that touches it
        // must connect + init it itself (see test/modules/arenaPlayerRegistry.test.ts).
        const client = await getMongoClient();
        cache.init(client);
    });

    after(async () => {
        await cache.delete(TEST_DB, "counterData", { instanceId: INSTANCE });
        await cache.delete(TEST_DB, "counterData", { instanceId: "STALE_CI_O0" });
        await closeMongoClient();
    });

    it("shouldIngest is true when the instanceId advances", () => {
        const meta = (lastInstanceId: string) => ({ lastInstanceId, season: 1, status: "ok", ingestedAt: "", leaderDocs: 1, players: 1 });
        assert.strictEqual(shouldIngest({ instanceId: "O2", season: 1, eventInstanceId: "" }, meta("O1")), true);
        assert.strictEqual(shouldIngest({ instanceId: "O2", season: 1, eventInstanceId: "" }, meta("O2")), false);
        assert.strictEqual(shouldIngest({ instanceId: "O2", season: 1, eventInstanceId: "" }, null), true);
    });

    it("ingests players into counterData and writes the metadata", async () => {
        const res = await runMode("5v5", { ...baseDeps, client: fakeClient });
        assert.strictEqual(res.ingested, true);
        assert.ok(res.docCount >= 1);

        const docs = await cache.get(TEST_DB, "counterData", { instanceId: INSTANCE, leader: LEADER });
        assert.strictEqual(docs.length, 1);
        // 2 players x (2 wins + 1 loss) = 6 attacks, 4 wins
        assert.deepStrictEqual([docs[0].overall.counters[0].wins, docs[0].overall.counters[0].total], [4, 6]);

        const meta = await readMetadata("5v5", META_FILE);
        assert.strictEqual(meta?.lastInstanceId, INSTANCE);
        assert.strictEqual(meta?.players, 2);
        assert.strictEqual(meta?.leaderDocs, res.docCount);
    });

    it("skips a mode whose metadata already matches (no re-ingest)", async () => {
        const res = await runMode("5v5", { ...baseDeps, client: fakeClient });
        assert.strictEqual(res.ingested, false);
    });

    it("does not prune existing docs or write metadata when the source has no player data yet", async () => {
        // A new event's info.json is posted, but players.json is still empty (data not fully published).
        const emptyClient: GahistoryClient = {
            getInfo: async () => ({ instanceId: "NEW_CI_O2", season: 81, eventInstanceId: "E:NEW_CI_O2" }),
            getPlayerIds: async () => [],
            getPlayer: async () => null,
        };
        // Seed a counter doc from a prior event; it must survive a data-not-ready run.
        await cache.put(
            TEST_DB,
            "counterData",
            { mode: "3v3", battleType: "char", leader: LEADER },
            { mode: "3v3", battleType: "char", leader: LEADER, instanceId: "STALE_CI_O0", season: 80, overall: { sampleN: 1, counters: [] }, variants: [] },
        );

        const res = await runMode("3v3", { ...baseDeps, client: emptyClient });
        assert.strictEqual(res.ingested, false);

        // Existing doc untouched (not pruned despite its stale instanceId)...
        const survivors = await cache.get(TEST_DB, "counterData", { instanceId: "STALE_CI_O0", leader: LEADER });
        assert.strictEqual(survivors.length, 1);
        // ...and the metadata was never written, so the next run retries.
        assert.strictEqual(await readMetadata("3v3", META_FILE), null);
    });

    it("runAllModes reports failure without aborting the remaining modes", async () => {
        const seen: string[] = [];
        const failingClient: GahistoryClient = {
            getInfo: async (mode) => {
                seen.push(mode);
                if (mode === "5v5") throw new Error("gahistory 503");
                return { instanceId: "NEW_CI_O3", season: 82, eventInstanceId: "E:NEW_CI_O3" };
            },
            getPlayerIds: async () => [],
            getPlayer: async () => null,
        };

        const summary = await runAllModes({ ...baseDeps, client: failingClient });

        assert.strictEqual(summary.ok, false, "a throwing mode must mark the run not-ok");
        // The second mode still ran, so one source outage cannot silently halve the ingest.
        assert.deepStrictEqual(seen, ["5v5", "3v3"]);
        assert.deepStrictEqual(
            summary.results.map((r) => [r.mode, r.ingested]),
            [["3v3", false]],
        );
    });

    it("runAllModes is ok when every mode succeeds", async () => {
        const summary = await runAllModes({ ...baseDeps, client: fakeClient });
        assert.strictEqual(summary.ok, true);
        assert.strictEqual(summary.results.length, 2);
    });
});
