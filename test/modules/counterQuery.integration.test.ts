import assert from "node:assert";
import { after, before, describe, it } from "node:test";
import cache from "../../modules/cache.ts";
import type { CounterDoc } from "../../schemas/counters.schema.ts";
import { getCounterView } from "../../modules/counters/counterQuery.ts";
import { closeMongoClient, getMongoClient } from "../helpers/mongodb.ts";

// File-unique isolation: dedicated db + unique leader/instanceId, filtered cleanup only.
const TEST_DB = "counterQuery_test_db";
const LEADER = "TESTLEADER_CQ";
const INSTANCE = "TEST_CQ_O1";

const seed: CounterDoc = {
    mode: "5v5",
    battleType: "char",
    leader: LEADER,
    instanceId: INSTANCE,
    season: 80,
    overall: { sampleN: 50, counters: [{ attack: ["CQ_ATK_A"], atkLeader: "CQ_ATK_A", wins: 7, total: 10, draws: 0 }] },
    variants: [
        { defense: [LEADER, "CQ_DEF_2"], sampleN: 30, counters: [{ attack: ["CQ_ATK_B"], atkLeader: "CQ_ATK_B", wins: 9, total: 10, draws: 0 }] },
    ],
};

describe("getCounterView (integration)", () => {
    before(async () => {
        const client = await getMongoClient();
        cache.init(client);
        await cache.put(TEST_DB, "counterData", { mode: seed.mode, battleType: seed.battleType, leader: LEADER }, seed);
    });

    after(async () => {
        await cache.delete(TEST_DB, "counterData", { leader: LEADER });
        await closeMongoClient();
    });

    it("returns overall bucket when no members specified", async () => {
        const view = await getCounterView(TEST_DB, { mode: "5v5", battleType: "char", leader: LEADER }, new Set());
        assert.ok(view);
        assert.strictEqual(view.kind, "overall");
        assert.strictEqual(view.rows[0].atkLeader, "CQ_ATK_A");
        assert.strictEqual(view.rows[0].winPct, 70);
        assert.strictEqual(view.totalCounters, 1);
    });

    it("returns the variant bucket when a member matches", async () => {
        const view = await getCounterView(TEST_DB, { mode: "5v5", battleType: "char", leader: LEADER }, new Set(["CQ_DEF_2"]));
        assert.ok(view);
        assert.strictEqual(view.kind, "variant");
        assert.deepStrictEqual(view.defense, [LEADER, "CQ_DEF_2"]);
        assert.strictEqual(view.rows[0].atkLeader, "CQ_ATK_B");
    });

    it("returns null when no doc matches the leader/mode", async () => {
        const view = await getCounterView(TEST_DB, { mode: "3v3", battleType: "char", leader: LEADER }, new Set());
        assert.strictEqual(view, null);
    });
});
