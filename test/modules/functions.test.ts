import assert from "node:assert";
import { describe, it } from "node:test";
import { charListFromSearch, findCharOrShip, getAbilityType, msgArrayToFields } from "../../modules/functions.ts";
import type { BotUnit } from "../../types/types.ts";

const makeUnit = (name: string, uniqueName = name.toLowerCase()): BotUnit =>
    ({ name, uniqueName, side: "light", combatType: 1, aliases: [] }) as unknown as BotUnit;

describe("charListFromSearch", () => {
    it("returns names sorted alphabetically", () => {
        const chars = [makeUnit("Yoda"), makeUnit("Ahsoka"), makeUnit("Mace Windu")];
        const result = charListFromSearch(chars);
        assert.strictEqual(result, "Ahsoka\nMace Windu\nYoda");
    });

    it("is case-insensitive for sort order", () => {
        const chars = [makeUnit("yoda"), makeUnit("Ahsoka")];
        const result = charListFromSearch(chars);
        assert.strictEqual(result, "Ahsoka\nyoda");
    });

    it("returns empty string for empty list", () => {
        assert.strictEqual(charListFromSearch([]), "");
    });

    it("does not mutate the original array", () => {
        const chars = [makeUnit("Yoda"), makeUnit("Ahsoka")];
        charListFromSearch(chars);
        assert.strictEqual(chars[0].name, "Yoda");
    });
});

describe("getAbilityType", () => {
    it("returns proper-cased type for known prefixes", () => {
        assert.strictEqual(getAbilityType("basicskill_yoda01"), "Basic");
        assert.strictEqual(getAbilityType("specialskill_yoda01"), "Special");
        assert.strictEqual(getAbilityType("leaderskill_yoda"), "Leader");
        assert.strictEqual(getAbilityType("uniqueskill_yoda01"), "Unique");
        assert.strictEqual(getAbilityType("contractskill_bounty01"), "Contract");
    });

    it("falls back to 'Basic' for unknown skill IDs", () => {
        assert.strictEqual(getAbilityType("unknown_skill"), "Basic");
        assert.strictEqual(getAbilityType(""), "Basic");
    });
});

describe("msgArrayToFields", () => {
    it("maps first chunk to title and rest to separator", () => {
        const result = msgArrayToFields(["chunk1", "chunk2", "chunk3"], "Abilities");
        assert.deepStrictEqual(result, [
            { name: "Abilities", value: "chunk1" },
            { name: "-", value: "chunk2" },
            { name: "-", value: "chunk3" },
        ]);
    });

    it("uses custom separator when provided", () => {
        const result = msgArrayToFields(["chunk1", "chunk2"], "Title", "...");
        assert.strictEqual(result[1].name, "...");
    });

    it("handles single-chunk array", () => {
        const result = msgArrayToFields(["only"], "Title");
        assert.deepStrictEqual(result, [{ name: "Title", value: "only" }]);
    });

    it("returns empty array for empty input", () => {
        assert.deepStrictEqual(msgArrayToFields([], "Title"), []);
    });
});

describe("findCharOrShip", () => {
    const chars = [makeUnit("Han Solo"), makeUnit("Luke Skywalker")];
    const ships = [makeUnit("Millennium Falcon", "mil_falcon")];

    it("returns characters when found, isShip false", () => {
        const result = findCharOrShip("Han Solo", chars, ships);
        assert.strictEqual(result.isShip, false);
        assert.strictEqual(result.units[0].name, "Han Solo");
    });

    it("falls back to ships when no character matches, isShip true", () => {
        const result = findCharOrShip("Millennium Falcon", chars, ships);
        assert.strictEqual(result.isShip, true);
        assert.strictEqual(result.units[0].name, "Millennium Falcon");
    });

    it("returns empty units with isShip true when nothing matches", () => {
        const result = findCharOrShip("Totally Unknown", chars, ships);
        assert.strictEqual(result.units.length, 0);
        assert.strictEqual(result.isShip, true);
    });
});
