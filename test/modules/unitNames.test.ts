import assert from "node:assert";
import { describe, it } from "node:test";
import { resolveUnitName } from "../../data/constants/units.ts";

describe("resolveUnitName", () => {
    const map = {
        LUKE: { eng_us: "Luke Skywalker", ger_de: "Luke Himmelsgleiter" },
        HAN: { eng_us: "Han Solo" }, // only English present
    };

    it("returns the requested locale's name when present", () => {
        assert.strictEqual(resolveUnitName(map, "LUKE", "ger_de"), "Luke Himmelsgleiter");
    });

    it("falls back to eng_us when the requested locale is missing for that unit", () => {
        assert.strictEqual(resolveUnitName(map, "HAN", "ger_de"), "Han Solo");
    });

    it("falls back to the raw defId when the unit is absent from the map", () => {
        assert.strictEqual(resolveUnitName(map, "UNKNOWN_UNIT", "eng_us"), "UNKNOWN_UNIT");
    });

    it("lowercases the lang argument so upper-case SWAPILang variants resolve", () => {
        assert.strictEqual(resolveUnitName(map, "LUKE", "GER_DE"), "Luke Himmelsgleiter");
    });

    it("defaults to eng_us when no lang is given", () => {
        assert.strictEqual(resolveUnitName(map, "LUKE"), "Luke Skywalker");
    });
});
