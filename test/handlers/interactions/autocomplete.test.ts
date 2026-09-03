import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { characterNameList, journeyNames, localeTagFor, shipNameList } from "../../../data/constants/units.ts";
import { createRealLanguage } from "../../mocks/mockInteraction.ts";
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

describe("filterAutocomplete with a language", () => {
    const nameMap = {
        JEDIKNIGHTLUKE: { eng_us: "Jedi Knight Luke", ger_de: "Jedi-Ritter Luke" },
        VADER: { eng_us: "Darth Vader", ger_de: "Darth Vader" },
    };
    const localized: UnitAutocompleteItem[] = [
        { name: "Jedi Knight Luke", defId: "JEDIKNIGHTLUKE", aliases: ["jkl"] },
        { name: "Darth Vader", defId: "VADER", aliases: ["dv"] },
    ];

    it("matches the localized name", () => {
        const res = filterAutocomplete(localized, "jedi-ri", "GER_DE", nameMap);
        assert.deepStrictEqual(
            res.map((unit) => unit.defId),
            ["JEDIKNIGHTLUKE"],
        );
    });

    it("still matches the English name for the same user", () => {
        const res = filterAutocomplete(localized, "jedi kn", "GER_DE", nameMap);
        assert.deepStrictEqual(
            res.map((unit) => unit.defId),
            ["JEDIKNIGHTLUKE"],
        );
    });

    it("keeps prefix matches ahead of contains matches", () => {
        const items: UnitAutocompleteItem[] = [
            { name: "Commander Luke", defId: "CLS", aliases: [] },
            { name: "Luke Skywalker", defId: "LUKE", aliases: [] },
        ];
        const res = filterAutocomplete(items, "luke", "ENG_US", {});
        // Prefix tier wins outright: the contains-only match is not included at all.
        assert.deepStrictEqual(
            res.map((unit) => unit.defId),
            ["LUKE"],
        );
    });

    it("still matches alias rows on the alias field", () => {
        const items: UnitAutocompleteItem[] = [
            { name: "Jedi Knight Luke", defId: "JEDIKNIGHTLUKE", aliases: [], isAlias: true, alias: "jkl" },
        ];
        const res = filterAutocomplete(items, "jk", "GER_DE", nameMap);
        assert.strictEqual(res.length, 1);
    });

    it("falls back to the English name when the map has no entry", () => {
        const res = filterAutocomplete(localized, "darth", "GER_DE", {});
        assert.deepStrictEqual(
            res.map((unit) => unit.defId),
            ["VADER"],
        );
    });
});

describe("formatUnitResults with a language", () => {
    const language = createRealLanguage();
    const nameMap = {
        JEDIKNIGHTLUKE: { eng_us: "Jedi Knight Luke Skywalker", ger_de: "Jedi-Ritter Luke Skywalker" },
        REY: { eng_us: "Rey", ger_de: "Rey" },
    };

    it("renders the localized name and keeps the defId as the value", () => {
        const res = formatUnitResults(
            [{ name: "Jedi Knight Luke Skywalker", defId: "JEDIKNIGHTLUKE", aliases: [] }],
            "GER_DE",
            language,
            nameMap,
        );
        assert.deepStrictEqual(res, [{ name: "Jedi-Ritter Luke Skywalker", value: "JEDIKNIGHTLUKE" }]);
    });

    it("re-applies the GL suffix from the language file", () => {
        const res = formatUnitResults([{ name: "Rey (GL)", defId: "REY", aliases: [], isGL: true }], "GER_DE", language, nameMap);
        assert.deepStrictEqual(res, [{ name: `Rey ${language.get("BASE_GL_SUFFIX")}`, value: "REY" }]);
    });

    it("renders alias rows as 'localized name (alias)'", () => {
        const res = formatUnitResults(
            [{ name: "Jedi Knight Luke Skywalker", defId: "JEDIKNIGHTLUKE", aliases: [], isAlias: true, alias: "jkl" }],
            "GER_DE",
            language,
            nameMap,
        );
        assert.deepStrictEqual(res, [{ name: "Jedi-Ritter Luke Skywalker (jkl)", value: "JEDIKNIGHTLUKE" }]);
    });

    it("sorts by the displayed name using the language's collation", () => {
        const map = { A: { ger_de: "Ähsoka" }, Z: { ger_de: "Zam Wesell" } };
        const res = formatUnitResults(
            [
                { name: "Zam Wesell", defId: "Z", aliases: [] },
                { name: "Ahsoka", defId: "A", aliases: [] },
            ],
            "GER_DE",
            language,
            map,
        );
        assert.deepStrictEqual(
            res.map((choice) => choice.value),
            ["A", "Z"],
        );
        assert.strictEqual(localeTagFor("GER_DE"), "de-DE");
    });
});

describe("processUnitAutocomplete with a language", () => {
    const language = createRealLanguage();

    it("returns localized names with defId values for a real character", () => {
        const target = characterNameList[0];
        const nameMap = { [target.defId]: { ger_de: "Ein Deutscher Name" } };
        const res = processUnitAutocomplete({ name: "character", value: "ein deutscher" }, [], "GER_DE", language, nameMap);
        assert.deepStrictEqual(res, [{ name: "Ein Deutscher Name", value: target.defId }]);
    });

    it("still returns [] for a non-unit option name", () => {
        assert.deepStrictEqual(processUnitAutocomplete({ name: "allycode", value: "x" }, [], "GER_DE", language), []);
    });
});

describe("/panic journey localization", () => {
    const language = createRealLanguage();

    it("localizes journey names and keeps the defId as the value", () => {
        const target = journeyNames[0];
        const nameMap = { [target.defId]: { ger_de: "Deutscher Reisename" } };
        const filtered = filterAutocomplete(journeyNames as UnitAutocompleteItem[], "deutscher", "GER_DE", nameMap);
        const res = formatUnitResults(filtered, "GER_DE", language, nameMap);
        assert.deepStrictEqual(res, [{ name: "Deutscher Reisename", value: target.defId }]);
    });
});
