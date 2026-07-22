import assert from "node:assert";
import { describe, it } from "node:test";
import dataUpdater from "../../services/dataUpdater.ts";

const { processDatacrons, buildDatacronLocRows } = dataUpdater;

// Shapes verified 2026-07-21 against the cached gameData blob:
//  - the TEMPLATE's tiers (1-indexed, no tier 0) carry the affix pools
//  - the SET's tier scopeIdentifier is intentionally ignored: it cannot express the ROLE mechanic,
//    and each affix's label comes from its ability nameKey instead
//  - datacron abilities live in gameData.ability with real nameKey + descKey
// biome-ignore lint/suspicious/noExplicitAny: narrow test fixture, not a full GameData
const gameData: any = {
    datacronSet: [
        { id: 31, displayName: "DATACRON_SET_31_NAME", expirationTimeMs: 1800000000000, tier: [] },
        { id: 32, displayName: "DATACRON_SET_32_NAME", tier: [] },
    ],
    datacronTemplate: [
        {
            id: "datacron_set_31_base",
            setId: 31,
            allowReroll: true,
            maxRerolls: 0,
            tier: [
                { id: 1, affixTemplateSetId: ["affix_stat_1"] },
                { id: 3, affixTemplateSetId: ["affix_faction_1"], requiredRelicTier: 5 },
            ],
        },
    ],
    datacronAffixTemplateSet: [
        { id: "affix_stat_1", affix: [{ statType: 49, statValueMin: 10000000, statValueMax: 26807422 }] },
        {
            id: "affix_faction_1",
            affix: [{ abilityId: "datacron_faction_generic_007", targetRule: "target_datacron_droid", statType: 1 }],
        },
    ],
    ability: [
        { id: "datacron_faction_generic_007", nameKey: "DATACRON_FACTION_MECHANIC_NAME", descKey: "DATACRON_FACTION_GENERIC_007_DESC" },
        { id: "some_other_ability", nameKey: "X", descKey: "Y" },
    ],
    datacronHelpEntry: [{ title: "help", body: "ignore me" }],
};

describe("processDatacrons", () => {
    it("builds one entry per set, carrying expiry and the reroll flag (not the always-0 maxRerolls)", () => {
        const out = processDatacrons(gameData);
        assert.strictEqual(out.sets.length, 2);
        const set31 = out.sets.find((s) => s.setId === 31);
        assert.strictEqual(set31?.expirationTimeMs, 1800000000000);
        assert.strictEqual(set31?.nameKey, "DATACRON_SET_31_NAME");
        assert.strictEqual(set31?.allowReroll, true);
        assert.ok(!("maxRerolls" in (set31 ?? {})), "maxRerolls is always 0 and intentionally not stored");
    });

    it("takes the affix pool and requirements from the TEMPLATE tier", () => {
        const set31 = processDatacrons(gameData).sets.find((s) => s.setId === 31);
        const statTier = set31?.tiers.find((t) => t.tier === 1);
        const abilityTier = set31?.tiers.find((t) => t.tier === 3);

        assert.strictEqual(abilityTier?.requiredRelicTier, 5);
        assert.strictEqual(abilityTier?.affixPool[0].abilityId, "datacron_faction_generic_007");
        assert.ok(!("scope" in (statTier ?? {})), "scope is not stored; labels come from ability nameKey");
    });

    it("keeps the roll ranges, which the affix pool display depends on", () => {
        const set31 = processDatacrons(gameData).sets.find((s) => s.setId === 31);
        const pool = set31?.tiers.find((t) => t.tier === 1)?.affixPool[0];
        assert.strictEqual(pool?.statValueMin, 10000000);
        assert.strictEqual(pool?.statValueMax, 26807422);
    });

    it("builds an abilities map from gameData.ability, datacron abilities only", () => {
        const out = processDatacrons(gameData);
        assert.deepStrictEqual(out.abilities["datacron_faction_generic_007"], {
            nameKey: "DATACRON_FACTION_MECHANIC_NAME",
            descKey: "DATACRON_FACTION_GENERIC_007_DESC",
        });
        assert.strictEqual(out.abilities["some_other_ability"], undefined, "non-datacron abilities excluded");
    });

    it("excludes datacronHelpEntry, which is in-client help text", () => {
        assert.ok(!JSON.stringify(processDatacrons(gameData)).includes("ignore me"));
    });

    it("tolerates a set with no matching template", () => {
        const set32 = processDatacrons(gameData).sets.find((s) => s.setId === 32);
        assert.deepStrictEqual(set32?.tiers, []);
        assert.strictEqual(set32?.allowReroll, false);
    });
});

describe("buildDatacronLocRows", () => {
    it("produces the distinct localization keys the commands render, one row each", () => {
        const rows = buildDatacronLocRows(processDatacrons(gameData));
        const keys = rows.map((r) => r.key).sort();
        // set names + ability name/desc keys, de-duplicated
        assert.deepStrictEqual(keys, [
            "DATACRON_FACTION_GENERIC_007_DESC",
            "DATACRON_FACTION_MECHANIC_NAME",
            "DATACRON_SET_31_NAME",
            "DATACRON_SET_32_NAME",
        ]);
    });

    it("shapes each row for processLocalization (id + resolvable text field both hold the key)", () => {
        const row = buildDatacronLocRows(processDatacrons(gameData))[0];
        assert.strictEqual(row.key, row.text, "text field holds the loc key for processLocalization to resolve");
    });
});
