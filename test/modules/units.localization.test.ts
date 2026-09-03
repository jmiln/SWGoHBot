import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { characterNameList, localeTagFor, localizedUnitName } from "../../data/constants/units.ts";

describe("localeTagFor", () => {
    it("maps SWGoH codes to BCP-47 tags", () => {
        assert.strictEqual(localeTagFor("GER_DE"), "de-DE");
        assert.strictEqual(localeTagFor("KOR_KR"), "ko-KR");
        assert.strictEqual(localeTagFor("ENG_US"), "en-US");
    });

    it("accepts either case, matching SWAPILang", () => {
        assert.strictEqual(localeTagFor("ger_de"), "de-DE");
        assert.strictEqual(localeTagFor("GER_DE"), "de-DE");
    });

    it("returns undefined for an unknown code so localeCompare falls back to default collation", () => {
        assert.strictEqual(localeTagFor("XXX_XX" as never), undefined);
    });

    it("sorts German umlauts correctly when handed to localeCompare", () => {
        // Under default (English) collation "Z" sorts before "Ä". Under de-DE it does not.
        const names = ["Zam Wesell", "Ähsoka"];
        const sorted = [...names].sort((a, b) => a.localeCompare(b, localeTagFor("GER_DE")));
        assert.deepStrictEqual(sorted, ["Ähsoka", "Zam Wesell"]);
    });
});

describe("localizedUnitName", () => {
    const map = {
        JEDIKNIGHTLUKE: { eng_us: "Jedi Knight Luke Skywalker", ger_de: "Jedi-Ritter Luke Skywalker" },
        VADER: { eng_us: "Darth Vader" },
    };

    it("returns the translation for the requested language", () => {
        assert.strictEqual(localizedUnitName("JEDIKNIGHTLUKE", "Jedi Knight Luke", "GER_DE", map), "Jedi-Ritter Luke Skywalker");
    });

    it("falls back to the supplied English name when the language is missing", () => {
        assert.strictEqual(localizedUnitName("VADER", "Darth Vader (GL)", "GER_DE", map), "Darth Vader (GL)");
    });

    it("falls back to the supplied English name for an unknown defId, never the defId", () => {
        assert.strictEqual(localizedUnitName("NOSUCHUNIT", "Some Unit", "GER_DE", map), "Some Unit");
    });

    it("falls back to the supplied English name when the map is empty", () => {
        // unitNames.json does not exist until the first dataUpdater run and loads as {}.
        assert.strictEqual(localizedUnitName("JEDIKNIGHTLUKE", "Jedi Knight Luke", "GER_DE", {}), "Jedi Knight Luke");
    });

    it("accepts either case for the language", () => {
        assert.strictEqual(localizedUnitName("JEDIKNIGHTLUKE", "x", "ger_de", map), "Jedi-Ritter Luke Skywalker");
    });
});

describe("mapUnitNames GL flag", () => {
    it("flags Galactic Legends and leaves the baked (GL) suffix on name", () => {
        const gl = characterNameList.find((unit) => unit.name.endsWith("(GL)"));
        assert.ok(gl, "expected at least one Galactic Legend in characterNameList");
        assert.strictEqual(gl.isGL, true);
    });

    it("does not flag ordinary characters", () => {
        const plain = characterNameList.find((unit) => !unit.name.endsWith("(GL)"));
        assert.ok(plain);
        assert.strictEqual(plain.isGL, false);
    });
});
