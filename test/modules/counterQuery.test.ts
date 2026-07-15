import assert from "node:assert";
import { describe, it } from "node:test";
import type { CounterDoc } from "../../schemas/counters.schema.ts";
import { displayRows, distinctLeaders, inferBattleType, selectBucket, variantMemberIds } from "../../modules/counters/counterQuery.ts";

const SHIP_IDS = new Set(["CAPITALMALEVOLENCE", "CAPITALCHIMAERA"]);

describe("inferBattleType", () => {
    it("returns fleet for a capital ship baseId", () => {
        assert.strictEqual(inferBattleType("CAPITALMALEVOLENCE", SHIP_IDS), "fleet");
    });
    it("returns char for a non-ship baseId", () => {
        assert.strictEqual(inferBattleType("GRIEVOUS", SHIP_IDS), "char");
    });
});

describe("displayRows", () => {
    const bucket = {
        counters: [
            { attack: ["WAMPA", "JOLEE"], atkLeader: "WAMPA", wins: 5, total: 10, draws: 0 }, // 50%
            { attack: ["GAS", "ARC", "FIVES"], atkLeader: "GAS", wins: 9, total: 10, draws: 1 }, // 90%
            { attack: ["REY"], atkLeader: "REY", wins: 8, total: 10, draws: 0 }, // 80%
        ],
    };

    it("sorts best win% first, marks leader out of others, rounds win%, uses total as n", () => {
        const rows = displayRows(bucket);
        assert.deepStrictEqual(
            rows.map((r) => [r.atkLeader, r.winPct, r.n]),
            [
                ["GAS", 90, 10],
                ["REY", 80, 10],
                ["WAMPA", 50, 10],
            ],
        );
        assert.deepStrictEqual(rows[0].others, ["ARC", "FIVES"]);
    });

    it("caps at the limit", () => {
        assert.strictEqual(displayRows(bucket, 2).length, 2);
    });
});

const doc: CounterDoc = {
    mode: "5v5",
    battleType: "char",
    leader: "BOSSNASS",
    instanceId: "O1",
    season: 80,
    overall: { sampleN: 100, counters: [{ attack: ["GAS"], atkLeader: "GAS", wins: 6, total: 10, draws: 0 }] },
    variants: [
        { defense: ["BOSSNASS", "JARJAR", "BOBBAFETT"], sampleN: 40, counters: [{ attack: ["REY"], atkLeader: "REY", wins: 9, total: 10, draws: 0 }] },
        { defense: ["BOSSNASS", "JARJAR", "QUEENAMIDALA"], sampleN: 25, counters: [{ attack: ["SLKR"], atkLeader: "SLKR", wins: 8, total: 10, draws: 0 }] },
    ],
};

describe("selectBucket", () => {
    it("no members -> overall", () => {
        const sel = selectBucket(doc, new Set());
        assert.strictEqual(sel.kind, "overall");
        assert.strictEqual(sel.bucket.sampleN, 100);
        assert.strictEqual(sel.defense, undefined);
    });

    it("exact match on every specified member, largest sampleN wins", () => {
        const sel = selectBucket(doc, new Set(["JARJAR"])); // both variants contain JARJAR
        assert.strictEqual(sel.kind, "variant");
        assert.strictEqual(sel.bucket.sampleN, 40); // higher sampleN of the two exact matches
        assert.deepStrictEqual(sel.defense, ["BOSSNASS", "JARJAR", "BOBBAFETT"]);
    });

    it("closest: partial overlap when no exact match", () => {
        const sel = selectBucket(doc, new Set(["JARJAR", "GENERALSKYWALKER"])); // GAS not in any defense
        assert.strictEqual(sel.kind, "closest");
        assert.strictEqual(sel.bucket.sampleN, 40); // overlap 1 on both, sampleN tiebreak
        assert.deepStrictEqual(sel.defense, ["BOSSNASS", "JARJAR", "BOBBAFETT"]);
    });

    it("no overlap at all -> overall fallback", () => {
        const sel = selectBucket(doc, new Set(["CHEWBACCALEGENDARY"]));
        assert.strictEqual(sel.kind, "overall");
    });

    it("doc with no variants -> overall even with members", () => {
        const noVariants: CounterDoc = { ...doc, variants: [] };
        assert.strictEqual(selectBucket(noVariants, new Set(["JARJAR"])).kind, "overall");
    });
});

describe("variantMemberIds", () => {
    it("collects distinct defense members across variants, minus excluded", () => {
        const ids = variantMemberIds(doc, new Set(["BOSSNASS"])); // exclude the leader
        assert.deepStrictEqual(new Set(ids), new Set(["JARJAR", "BOBBAFETT", "QUEENAMIDALA"]));
    });
});

describe("distinctLeaders", () => {
    it("splits projected docs into char and fleet buckets, de-duplicated", () => {
        const out = distinctLeaders([
            { leader: "GRIEVOUS", battleType: "char" },
            { leader: "GRIEVOUS", battleType: "char" },
            { leader: "CAPITALMALEVOLENCE", battleType: "fleet" },
        ]);
        assert.deepStrictEqual(out.char, ["GRIEVOUS"]);
        assert.deepStrictEqual(out.fleet, ["CAPITALMALEVOLENCE"]);
    });
});
