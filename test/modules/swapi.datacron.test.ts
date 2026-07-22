import assert from "node:assert";
import { describe, it } from "node:test";
import { mapPlayerDatacrons } from "../../modules/swapi.ts";

// Field shapes verified 2026-07-21 against a live comlink payload:
//  - statValue arrives as a STRING of scaled integers ("26807422"), not a number
//  - stat-only affixes carry targetRule: "" (empty string), not undefined
//  - reroll fields are retained deliberately; the follow-on analysis work (Spec B) needs them
describe("mapPlayerDatacrons", () => {
    it("maps comlink datacrons, keeping reroll fields for later analysis", () => {
        const out = mapPlayerDatacrons([
            {
                id: "abc",
                setId: 31,
                templateId: "datacron_set_31_base",
                tag: ["tag1"],
                locked: false,
                focused: true,
                rerollIndex: 2,
                rerollCount: 1,
                affix: [{ targetRule: "target_datacron_darkside", statType: 5, statValue: "1200", abilityId: "" }],
            },
        ]);

        assert.strictEqual(out.length, 1);
        assert.strictEqual(out[0].setId, 31);
        assert.strictEqual(out[0].focused, true);
        assert.strictEqual(out[0].rerollCount, 1);
        assert.strictEqual(out[0].affix[0].targetRule, "target_datacron_darkside");
    });

    it("returns an empty array when the payload omits datacrons entirely", () => {
        assert.deepStrictEqual(mapPlayerDatacrons(undefined), []);
    });

    it("normalizes the empty-string targetRule and abilityId the game sends for stat-only affixes", () => {
        const out = mapPlayerDatacrons([
            { id: "x", setId: 31, templateId: "t", affix: [{ statType: 5, statValue: "100", targetRule: "", abilityId: "" }] },
        ]);
        assert.strictEqual(out[0].affix[0].targetRule, undefined, "empty string should normalize to undefined");
        assert.strictEqual(out[0].affix[0].abilityId, undefined, "empty string should normalize to undefined");
    });

    it("converts the string statValue the game sends into a number", () => {
        const out = mapPlayerDatacrons([
            { id: "y", setId: 30, templateId: "t", affix: [{ statType: 49, statValue: "26807422" }] },
        ]);
        assert.strictEqual(out[0].affix[0].statValue, 26807422);
        assert.strictEqual(typeof out[0].affix[0].statValue, "number");
    });
});
