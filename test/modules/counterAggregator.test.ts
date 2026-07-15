import assert from "node:assert";
import { describe, it } from "node:test";
import { CounterCursorSchema, CounterDocSchema } from "../../schemas/counters.schema.ts";
import { baseId, squadInfo, teamIds, teamKey } from "../../modules/counters/counterAggregator.ts";

describe("counters schema", () => {
    it("accepts a valid counter doc", () => {
        const doc = {
            mode: "5v5",
            battleType: "char",
            leader: "GRIEVOUS",
            instanceId: "O123",
            season: 80,
            overall: { sampleN: 10, counters: [{ attack: ["WAMPA"], atkLeader: "WAMPA", wins: 8, total: 10, draws: 0 }] },
            variants: [],
        };
        assert.strictEqual(CounterDocSchema.safeParse(doc).success, true);
    });

    it("rejects a doc with an unknown mode", () => {
        const bad = { mode: "7v7", battleType: "char", leader: "X", instanceId: "O1", season: 1, overall: { sampleN: 0, counters: [] }, variants: [] };
        assert.strictEqual(CounterDocSchema.safeParse(bad).success, false);
    });

    it("accepts a valid cursor doc", () => {
        const cur = { _id: "meta:5v5", lastInstanceId: "O123", season: 80, status: "ok" };
        assert.strictEqual(CounterCursorSchema.safeParse(cur).success, true);
    });
});

describe("baseId / teamKey", () => {
    it("strips the star suffix", () => {
        assert.strictEqual(baseId("GRIEVOUS:SEVEN_STAR"), "GRIEVOUS");
    });
    it("teamKey is order-independent", () => {
        assert.strictEqual(teamKey(["B", "A", "C"]), teamKey(["C", "A", "B"]));
    });
    it("teamIds maps definitionIds to baseIds", () => {
        assert.deepStrictEqual(teamIds([{ definitionId: "A:SEVEN_STAR" }, { definitionId: "B:SIX_STAR" }]), ["A", "B"]);
    });
});

describe("squadInfo", () => {
    it("finds the character leader by squadUnitType 2", () => {
        const units = [{ definitionId: "MEMBER:X", squadUnitType: 1 }, { definitionId: "LEAD:X", squadUnitType: 2 }];
        assert.deepStrictEqual(squadInfo(units), { kind: "char", leader: "LEAD" });
    });
    it("classifies a fleet by squadUnitType 3/5 and keys on the capital", () => {
        const units = [{ definitionId: "CAP:X", squadUnitType: 3 }, { definitionId: "SHIP:X", squadUnitType: 5 }];
        assert.deepStrictEqual(squadInfo(units), { kind: "fleet", leader: "CAP" });
    });
    it("returns unknown for an empty squad", () => {
        assert.deepStrictEqual(squadInfo([]), { kind: "unknown", leader: null });
    });
});

import { foldDuel, foldPlayer } from "../../modules/counters/counterAggregator.ts";
import type { Accumulator } from "../../modules/counters/counterAggregator.ts";

const charDuel = (outcome: number) => ({
    defenderUnit: [{ definitionId: "GRIEVOUS:X", squadUnitType: 2 }, { definitionId: "STAP:X", squadUnitType: 1 }],
    attackerUnit: [{ definitionId: "WAMPA:X", squadUnitType: 2 }],
    battleOutcome: outcome,
});

describe("foldDuel", () => {
    it("tallies wins/losses/draws under the defense leader", () => {
        const acc: Accumulator = new Map();
        foldDuel(acc, charDuel(1)); // attacker win
        foldDuel(acc, charDuel(2)); // defense held (loss)
        foldDuel(acc, charDuel(3)); // draw
        const lead = acc.get("char:GRIEVOUS");
        assert.ok(lead);
        assert.strictEqual(lead.sampleN, 3);
        const row = lead.overallByAttack.get(teamKey(["WAMPA"]));
        assert.deepStrictEqual([row?.wins, row?.total, row?.draws], [1, 3, 1]);
    });

    it("routes fleet duels to a separate fleet leader bucket", () => {
        const acc: Accumulator = new Map();
        foldDuel(acc, {
            defenderUnit: [{ definitionId: "CAPITALEXECUTOR:X", squadUnitType: 3 }],
            attackerUnit: [{ definitionId: "CAPITALPROFUNDITY:X", squadUnitType: 3 }],
            battleOutcome: 1,
        });
        assert.ok(acc.get("fleet:CAPITALEXECUTOR"));
        assert.strictEqual(acc.get("char:CAPITALEXECUTOR"), undefined);
    });

    it("ignores duels with missing units or outcome", () => {
        const acc: Accumulator = new Map();
        foldDuel(acc, { attackerUnit: [], defenderUnit: [], battleOutcome: undefined });
        assert.strictEqual(acc.size, 0);
    });
});

describe("foldPlayer", () => {
    it("folds only attackResult duels (not defenseResult)", () => {
        const acc: Accumulator = new Map();
        foldPlayer(acc, {
            matchResult: [{
                attackResult: [{ duelResult: [charDuel(1)] }],
                // defenseResult intentionally present but must be ignored:
                // @ts-expect-error extra field for the test
                defenseResult: [{ duelResult: [charDuel(1)] }],
            }],
        });
        assert.strictEqual(acc.get("char:GRIEVOUS")?.sampleN, 1);
    });
});

import { buildCounterDocs, DEFAULT_BUILD_OPTIONS, wilsonLowerBound } from "../../modules/counters/counterAggregator.ts";

describe("wilsonLowerBound", () => {
    it("discounts a tiny perfect record far below a huge strong one", () => {
        assert.ok(wilsonLowerBound(5, 5) < wilsonLowerBound(2400, 3000), "5/5 must score below 2400/3000");
    });

    it("rewards sample size at equal win rate", () => {
        assert.ok(wilsonLowerBound(209, 209) > wilsonLowerBound(11, 11));
        assert.ok(wilsonLowerBound(800, 1000) > wilsonLowerBound(8, 10));
    });

    it("never exceeds the observed rate, and stays within [0,1]", () => {
        for (const [w, n] of [
            [5, 5],
            [11, 11],
            [800, 1000],
            [1, 5],
            [0, 7],
        ]) {
            const lb = wilsonLowerBound(w, n);
            assert.ok(lb >= 0 && lb <= 1, `${w}/${n} -> ${lb} out of range`);
            assert.ok(lb <= w / n + 1e-9, `${w}/${n} lower bound ${lb} exceeded observed rate`);
        }
    });

    it("returns 0 for a zero-battle tally rather than dividing by zero", () => {
        assert.strictEqual(wilsonLowerBound(0, 0), 0);
    });
});

function accWith(nWins: number, nLoss: number): Accumulator {
    const acc: Accumulator = new Map();
    for (let i = 0; i < nWins; i++) foldDuel(acc, charDuel(1));
    for (let i = 0; i < nLoss; i++) foldDuel(acc, charDuel(2));
    return acc;
}

describe("buildCounterDocs", () => {
    const meta = { mode: "5v5", instanceId: "O1", season: 80 } as const;

    it("emits a doc with the correct win tally and passes the schema", () => {
        const docs = buildCounterDocs(accWith(8, 2), meta, { ...DEFAULT_BUILD_OPTIONS, minBattles: 1 });
        const doc = docs.find((d) => d.leader === "GRIEVOUS");
        assert.ok(doc);
        assert.strictEqual(doc.mode, "5v5");
        assert.strictEqual(doc.battleType, "char");
        assert.deepStrictEqual([doc.overall.counters[0].wins, doc.overall.counters[0].total], [8, 10]);
        assert.strictEqual(CounterDocSchema.safeParse(doc).success, true);
    });

    it("drops counter rows below minBattles", () => {
        const docs = buildCounterDocs(accWith(3, 0), meta, { ...DEFAULT_BUILD_OPTIONS, minBattles: 5 });
        assert.strictEqual(docs.length, 0);
    });

    // A tiny perfect record is luck, not a counter. Ranking on raw win% let a 5/5 outrank a
    // thousands-of-battles staple, so every stored slot filled with flukes and the real meta
    // teams were discarded at ingestion. Rank on the Wilson lower bound instead.
    it("ranks a high-volume strong team above a tiny perfect record", () => {
        const acc: Accumulator = new Map();
        const duel = (atk: string, outcome: number) => ({
            defenderUnit: [{ definitionId: "GRIEVOUS:X", squadUnitType: 2 }],
            attackerUnit: [{ definitionId: `${atk}:X`, squadUnitType: 2 }],
            battleOutcome: outcome,
        });
        // META: 2400/3000 = 80% over a huge sample. FLUKE: 5/5 = 100% over nothing.
        for (let i = 0; i < 2400; i++) foldDuel(acc, duel("META", 1));
        for (let i = 0; i < 600; i++) foldDuel(acc, duel("META", 2));
        for (let i = 0; i < 5; i++) foldDuel(acc, duel("FLUKE", 1));

        const docs = buildCounterDocs(acc, meta, { ...DEFAULT_BUILD_OPTIONS, minBattles: 5 });
        const order = docs[0].overall.counters.map((c) => c.atkLeader);
        assert.deepStrictEqual(order, ["META", "FLUKE"], "the 3000-battle 80% team must outrank the 5/5");
    });

    it("still ranks a big perfect record above a small one", () => {
        const acc: Accumulator = new Map();
        const duel = (atk: string) => ({
            defenderUnit: [{ definitionId: "GRIEVOUS:X", squadUnitType: 2 }],
            attackerUnit: [{ definitionId: `${atk}:X`, squadUnitType: 2 }],
            battleOutcome: 1,
        });
        for (let i = 0; i < 209; i++) foldDuel(acc, duel("BIG"));
        for (let i = 0; i < 11; i++) foldDuel(acc, duel("SMALL"));

        const docs = buildCounterDocs(acc, meta, { ...DEFAULT_BUILD_OPTIONS, minBattles: 5 });
        assert.deepStrictEqual(
            docs[0].overall.counters.map((c) => c.atkLeader),
            ["BIG", "SMALL"],
        );
    });

    it("caps counters per bucket", () => {
        const acc: Accumulator = new Map();
        // 3 distinct attack teams vs the same leader, each won 5 times
        for (const atk of ["A", "B", "C"]) {
            for (let i = 0; i < 5; i++) {
                foldDuel(acc, { defenderUnit: [{ definitionId: "GRIEVOUS:X", squadUnitType: 2 }], attackerUnit: [{ definitionId: `${atk}:X`, squadUnitType: 2 }], battleOutcome: 1 });
            }
        }
        const docs = buildCounterDocs(acc, meta, { ...DEFAULT_BUILD_OPTIONS, minBattles: 1, countersPerBucket: 2 });
        assert.strictEqual(docs[0].overall.counters.length, 2);
    });
});

/** Build a duel against a distinct GRIEVOUS defense variant (leader + given member baseIds). */
function variantDuel(defMembers: string[], atkId: string, outcome: number) {
    return {
        defenderUnit: [{ definitionId: "GRIEVOUS:X", squadUnitType: 2 }, ...defMembers.map((m) => ({ definitionId: `${m}:X`, squadUnitType: 1 }))],
        attackerUnit: [{ definitionId: `${atkId}:X`, squadUnitType: 2 }],
        battleOutcome: outcome,
    };
}

describe("selectVariants (via buildCounterDocs)", () => {
    const meta = { mode: "5v5", instanceId: "O1", season: 80 } as const;

    it("keeps only the highest-sampleN variants up to variantCoverage", () => {
        const acc: Accumulator = new Map();
        // Variant 1: defense GRIEVOUS+M1+M2, sampleN 50, single qualifying attack team.
        for (let i = 0; i < 50; i++) foldDuel(acc, variantDuel(["M1", "M2"], "ATK1", 1));
        // Variant 2: defense GRIEVOUS+M3+M4, sampleN 30.
        for (let i = 0; i < 30; i++) foldDuel(acc, variantDuel(["M3", "M4"], "ATK2", 1));
        // Variant 3: defense GRIEVOUS+M5+M6, sampleN 20 -- should be cut off by coverage.
        for (let i = 0; i < 20; i++) foldDuel(acc, variantDuel(["M5", "M6"], "ATK3", 1));

        // lead.sampleN = 100, target = 100 * 0.7 = 70. Variant1 (50) + Variant2 (30) reach 80 >= 70, Variant3 never processed.
        const docs = buildCounterDocs(acc, meta, { ...DEFAULT_BUILD_OPTIONS, minBattles: 1, variantCoverage: 0.7 });
        const doc = docs.find((d) => d.leader === "GRIEVOUS");
        assert.ok(doc);
        assert.strictEqual(doc.variants.length, 2);
        assert.deepStrictEqual(doc.variants.map((v) => v.sampleN), [50, 30]);
        assert.ok(doc.variants[0].defense.includes("M1") && doc.variants[0].defense.includes("M2"));
        assert.ok(doc.variants[1].defense.includes("M3") && doc.variants[1].defense.includes("M4"));
    });

    it("caps kept variants at variantsPerLeader even when coverage isn't met", () => {
        const acc: Accumulator = new Map();
        for (let i = 0; i < 30; i++) foldDuel(acc, variantDuel(["M1", "M2"], "ATK1", 1));
        for (let i = 0; i < 20; i++) foldDuel(acc, variantDuel(["M3", "M4"], "ATK2", 1));
        for (let i = 0; i < 10; i++) foldDuel(acc, variantDuel(["M5", "M6"], "ATK3", 1));

        const docs = buildCounterDocs(acc, meta, { ...DEFAULT_BUILD_OPTIONS, minBattles: 1, variantCoverage: 1, variantsPerLeader: 1 });
        const doc = docs.find((d) => d.leader === "GRIEVOUS");
        assert.ok(doc);
        assert.strictEqual(doc.variants.length, 1);
        assert.strictEqual(doc.variants[0].sampleN, 30);
    });

    it("does not let a skipped (all-below-minBattles) dominant variant starve the coverage budget for a smaller qualifying variant", () => {
        const acc: Accumulator = new Map();
        // Dominant variant: sampleN 50, but split across 25 distinct attack teams (2 duels each) --
        // every attack row is below minBattles(5), so rankCounters returns [] and it is SKIPPED.
        for (let i = 0; i < 25; i++) {
            foldDuel(acc, variantDuel(["M1", "M2"], `BIGATK${i}`, 1));
            foldDuel(acc, variantDuel(["M1", "M2"], `BIGATK${i}`, 1));
        }
        // Smaller variant: sampleN 10, single attack team, all wins -- qualifies (total 10 >= minBattles 5).
        for (let i = 0; i < 10; i++) foldDuel(acc, variantDuel(["M3", "M4"], "SMALLATK", 1));

        // lead.sampleN = 60, target = 60 * 0.5 = 30. Under the old (buggy) unconditional-increment
        // behavior, the skipped 50-sample variant alone would push cumulative to 50 >= 30 and the
        // loop would break before ever reaching the smaller variant.
        const docs = buildCounterDocs(acc, meta, { ...DEFAULT_BUILD_OPTIONS, minBattles: 5, variantCoverage: 0.5 });
        const doc = docs.find((d) => d.leader === "GRIEVOUS");
        assert.ok(doc);
        assert.strictEqual(doc.variants.length, 1);
        assert.strictEqual(doc.variants[0].sampleN, 10);
        assert.ok(doc.variants[0].defense.includes("M3") && doc.variants[0].defense.includes("M4"));
        assert.strictEqual(doc.variants[0].counters[0].total, 10);
    });
});
