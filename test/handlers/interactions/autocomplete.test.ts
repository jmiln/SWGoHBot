import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { characterNameList, shipNameList } from "../../../data/constants/units.ts";
import {
    buildUnitList,
    filterAutocomplete,
    formatUnitResults,
    processUnitAutocomplete,
    type UnitAutocompleteItem,
} from "../../../handlers/interactions/autocomplete.ts";
import type { GuildAlias } from "../../../types/types.ts";

const items: UnitAutocompleteItem[] = [
    { name: "Jedi Knight Luke", defId: "JEDIKNIGHTLUKE", aliases: ["jkl"] },
    { name: "Darth Vader", defId: "VADER", aliases: ["dv"] },
    { name: "Grand Master Yoda", defId: "GRANDMASTERYODA", aliases: ["gmy"] },
];

describe("filterAutocomplete", () => {
    it("prefers prefix matches on name", () => {
        const res = filterAutocomplete(items, "darth");
        assert.deepStrictEqual(
            res.map((u) => u.defId),
            ["VADER"],
        );
    });

    it("falls back to a contains match when nothing matches by prefix", () => {
        const res = filterAutocomplete(items, "master");
        assert.deepStrictEqual(
            res.map((u) => u.defId),
            ["GRANDMASTERYODA"],
        );
    });

    it("falls back to the aliases array when name has no prefix/contains hit", () => {
        const res = filterAutocomplete(items, "jkl");
        assert.deepStrictEqual(
            res.map((u) => u.defId),
            ["JEDIKNIGHTLUKE"],
        );
    });

    it("uses the alias field for prefix matching on alias items", () => {
        const aliasItems: UnitAutocompleteItem[] = [{ name: "Jedi Knight Luke", defId: "JEDIKNIGHTLUKE", aliases: [], isAlias: true, alias: "jkl" }];
        const res = filterAutocomplete(aliasItems, "jk");
        assert.deepStrictEqual(
            res.map((u) => u.defId),
            ["JEDIKNIGHTLUKE"],
        );
    });
});

describe("formatUnitResults", () => {
    it("sorts by name and formats alias entries as 'name (alias)'", () => {
        const res = formatUnitResults([
            { name: "Darth Vader", defId: "VADER", aliases: [] },
            { name: "Ahsoka Tano", defId: "AHSOKA", aliases: [], isAlias: true, alias: "ahsoka" },
        ]);
        assert.deepStrictEqual(res, [
            { name: "Ahsoka Tano (ahsoka)", value: "AHSOKA" },
            { name: "Darth Vader", value: "VADER" },
        ]);
    });
});

describe("buildUnitList", () => {
    it("returns the character and ship lists (plus aliases) for 'unit'", () => {
        const res = buildUnitList("unit", []);
        assert.strictEqual(res.length, characterNameList.length + shipNameList.length);
    });

    it("drops aliases whose defId is not a known character for 'character'", () => {
        const bogus: GuildAlias = { alias: "bogus", defId: "NOT_A_REAL_DEFID_XYZ", name: "bogus" };
        const res = buildUnitList("character", [bogus]);
        assert.strictEqual(res.length, characterNameList.length);
    });
});

describe("processUnitAutocomplete", () => {
    it("returns [] for a non-unit option name", () => {
        assert.deepStrictEqual(processUnitAutocomplete({ name: "allycode", value: "123" }, []), []);
    });

    it("returns formatted results for a unit option", () => {
        const prefix = characterNameList[0].name.slice(0, 3);
        const res = processUnitAutocomplete({ name: "character", value: prefix }, []);
        assert.ok(Array.isArray(res));
        assert.ok(res.length > 0);
        assert.ok(typeof res[0].name === "string" && typeof res[0].value === "string");
    });
});
