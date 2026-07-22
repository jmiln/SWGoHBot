import assert from "node:assert";
import { describe, it } from "node:test";
import { descaleStatValue, formatPlayerAffix, formatPoolAffix, resolveTargetName, statName } from "../../modules/datacrons.ts";
import type { DatacronAbilityRef, DatacronAffix, DatacronAffixOption } from "../../types/datacron_types.ts";

// Text comes from the Mongo `datacrons` collection at runtime; tests inject a fake map so the
// pure formatting logic can be verified without a database.
const abilities: Record<string, DatacronAbilityRef> = {
    datacron_alignment_generic_003: { nameKey: "DATACRON_ALIGNMENT_MECHANIC_NAME", descKey: "DATACRON_ALIGNMENT_GENERIC_003_DESC" },
};
const textMap = new Map<string, string>([
    ["DATACRON_ALIGNMENT_GENERIC_003_DESC", "Dark Side allies gain 15% Potency."],
    ["DATACRON_ALIGNMENT_MECHANIC_NAME", "Alignment"],
    ["DATACRON_TEMPLATE_DESC", "Whenever {0} allies Daze or Stun an enemy, they recover Health."],
]);

describe("resolveTargetName", () => {
    it("resolves an alignment target to a readable name", () => {
        assert.strictEqual(resolveTargetName("target_datacron_darkside"), "Dark Side");
        assert.strictEqual(resolveTargetName("target_datacron_lightside"), "Light Side");
    });

    it("resolves a character target via its unit name", () => {
        // GRIEVOUS exists in unitMap; the alias maps generalgrievous -> GRIEVOUS.
        const name = resolveTargetName("target_datacron_generalgrievous");
        assert.ok(name && name.toLowerCase().includes("grievous"), `expected Grievous, got: ${name}`);
    });

    it("never returns the raw internal id, even for an unknown target", () => {
        const name = resolveTargetName("target_datacron_somethingunknown");
        assert.ok(name && !name.includes("target_datacron"), `internal id leaked: ${name}`);
    });

    it("returns null for no target", () => {
        assert.strictEqual(resolveTargetName(undefined), null);
    });
});

describe("descaleStatValue", () => {
    // Scaling rule reused from modules/swapi.ts:690 - flat stats use 1e8, everything else 1e6.
    // Every datacron stat type is a percentage type, so all divide by 1e6.
    it("de-scales a percentage stat by 1e6", () => {
        assert.strictEqual(descaleStatValue(26807422, 49), 26.807422);
    });

    it("returns null when there is no value to scale", () => {
        assert.strictEqual(descaleStatValue(undefined, 49), null);
        assert.strictEqual(descaleStatValue(0, 49), null);
    });
});

describe("statName", () => {
    it("names the datacron stat types", () => {
        assert.strictEqual(statName(49), "Defense");
        assert.strictEqual(statName(55), "Health");
        assert.strictEqual(statName(16), "Critical Damage");
    });

    it("returns null for an unknown stat type rather than a raw number", () => {
        assert.strictEqual(statName(999), null);
        assert.strictEqual(statName(undefined), null);
    });
});

describe("formatPlayerAffix", () => {
    it("renders a stat affix as a de-scaled percentage with its name", () => {
        const affix: DatacronAffix = { statType: 49, statValue: 26807422 };
        const line = formatPlayerAffix(affix, abilities, textMap);
        assert.ok(line.includes("26.81"), `expected de-scaled value in: ${line}`);
        assert.ok(line.includes("Defense"), `expected stat name in: ${line}`);
        assert.ok(!line.includes("26807422"), `raw scaled value leaked into: ${line}`);
    });

    it("renders an ability affix as its localized description, not a raw key or id", () => {
        const affix: DatacronAffix = { abilityId: "datacron_alignment_generic_003", statType: 1, statValue: 0 };
        const line = formatPlayerAffix(affix, abilities, textMap);
        assert.ok(line.includes("Dark Side allies gain"), `expected localized desc in: ${line}`);
        assert.ok(!line.includes("datacron_alignment"), `internal ability id leaked into: ${line}`);
        assert.ok(!line.includes("DATACRON_"), `raw loc key leaked into: ${line}`);
        assert.ok(!line.includes("+0"), `zero-value stat should not render for an ability affix: ${line}`);
    });

    it("falls back to the mechanic name when the description text is missing", () => {
        const affix: DatacronAffix = { abilityId: "datacron_alignment_generic_003" };
        const line = formatPlayerAffix(affix, abilities, new Map([["DATACRON_ALIGNMENT_MECHANIC_NAME", "Alignment"]]));
        assert.strictEqual(line, "Alignment");
    });
});

describe("formatPoolAffix", () => {
    it("renders a stat option as a de-scaled range with its name", () => {
        const opt: DatacronAffixOption = { statType: 49, statValueMin: 10000000, statValueMax: 25000000 };
        const line = formatPoolAffix(opt, abilities, textMap);
        assert.ok(line.includes("10") && line.includes("25"), `expected de-scaled range in: ${line}`);
        assert.ok(line.includes("Defense"), `expected stat name in: ${line}`);
        assert.ok(!line.includes("10000000"), `raw scaled value leaked into: ${line}`);
    });

    it("collapses an equal min/max range to a single value", () => {
        const opt: DatacronAffixOption = { statType: 55, statValueMin: 5000000, statValueMax: 5000000 };
        const line = formatPoolAffix(opt, abilities, textMap);
        assert.ok(!line.includes(" to "), `equal bounds should not render a range: ${line}`);
    });

    it("renders an ability option as its localized description", () => {
        const opt: DatacronAffixOption = { abilityId: "datacron_alignment_generic_003" };
        const line = formatPoolAffix(opt, abilities, textMap);
        assert.ok(line.includes("Dark Side allies gain"), `expected localized desc in: ${line}`);
    });
});
