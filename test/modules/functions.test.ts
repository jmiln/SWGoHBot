import assert from "node:assert";
import { describe, it } from "node:test";
import {
    charListFromSearch,
    chunkArray,
    convertMS,
    expandSpaces,
    findCharOrShip,
    getAbilityType,
    getDivider,
    getGearStr,
    getUserID,
    isAllyCode,
    isChannelId,
    isUserID,
    isValidZone,
    msgArray,
    msgArrayToFields,
    shortenNum,
    toProperCase,
    trimFloat,
} from "../../modules/functions.ts";
import type { BotUnit } from "../../types/types.ts";

const ZWS = "\u200b";

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

describe("isAllyCode", () => {
    it("returns true for a 9-digit string", () => {
        assert.strictEqual(isAllyCode("123456789"), true);
    });

    it("returns true for a dashed ally code", () => {
        assert.strictEqual(isAllyCode("123-456-789"), true);
    });

    it("returns true for a numeric input", () => {
        assert.strictEqual(isAllyCode(123456789), true);
    });

    it("returns false for an 8-digit string", () => {
        assert.strictEqual(isAllyCode("12345678"), false);
    });

    it("returns false for a 10-digit string", () => {
        assert.strictEqual(isAllyCode("1234567890"), false);
    });

    it("returns false for an empty string", () => {
        assert.strictEqual(isAllyCode(""), false);
    });

    it("returns false for null", () => {
        assert.strictEqual(isAllyCode(null as any), false);
    });
});

describe("toProperCase", () => {
    it("capitalizes first letter of each word", () => {
        assert.strictEqual(toProperCase("hello world"), "Hello World");
    });

    it("lowercases the rest of each word", () => {
        assert.strictEqual(toProperCase("darth vader"), "Darth Vader");
    });

    it("preserves Roman numerals in uppercase", () => {
        assert.strictEqual(toProperCase("jedi knight II"), "Jedi Knight II");
    });

    it("returns falsy input unchanged", () => {
        assert.strictEqual(toProperCase(""), "");
        assert.strictEqual(toProperCase(null as any), null);
    });
});

describe("shortenNum", () => {
    it("returns the number as a string when under 1K", () => {
        assert.strictEqual(shortenNum(500), "500");
    });

    it("returns 1K for exactly 1000", () => {
        assert.strictEqual(shortenNum(1000), "1K");
    });

    it("returns formatted K value for fractional thousands", () => {
        assert.strictEqual(shortenNum(1500), "1.50K");
    });

    it("returns 1M for exactly 1,000,000", () => {
        assert.strictEqual(shortenNum(1000000), "1M");
    });

    it("returns formatted M value for fractional millions", () => {
        assert.strictEqual(shortenNum(5250000), "5.25M");
    });
});

describe("trimFloat", () => {
    it("returns the decimal with specified places", () => {
        assert.strictEqual(trimFloat(1.5, 1), "1.5");
    });

    it("returns integer string for whole numbers (no trailing zero)", () => {
        assert.strictEqual(trimFloat(1.0, 1), "1");
    });

    it("rounds to the specified decimal places", () => {
        assert.strictEqual(trimFloat(1.567, 2), "1.57");
    });
});

describe("expandSpaces", () => {
    it("leaves a single space unchanged", () => {
        assert.strictEqual(expandSpaces("a b"), "a b");
    });

    it("injects ZWS between characters of a double space", () => {
        const result = expandSpaces("a  b");
        assert.ok(result.includes(ZWS), "Expected ZWS in expanded string");
    });

    it("leaves a string with no spaces unchanged", () => {
        assert.strictEqual(expandSpaces("abc"), "abc");
    });
});

describe("msgArray", () => {
    it("returns a single chunk when content fits within maxLen", () => {
        const result = msgArray(["hello", "world"], "\n", 1900);
        assert.strictEqual(result.length, 1);
        assert.strictEqual(result[0], "hello\nworld");
    });

    it("splits into multiple chunks when content exceeds maxLen", () => {
        const a = "a".repeat(100);
        const b = "b".repeat(100);
        const result = msgArray([a, b], "\n", 150);
        assert.ok(result.length >= 2, "Expected at least 2 chunks");
        assert.ok(result[0].includes(a));
        assert.ok(result[1].includes(b));
    });

    it("throws when a single element exceeds maxLen", () => {
        const bigElem = "x".repeat(200);
        assert.throws(() => msgArray([bigElem], "\n", 100), /Element too big/);
    });
});

describe("chunkArray", () => {
    it("splits into chunks of the given size", () => {
        assert.deepStrictEqual(chunkArray([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);
    });

    it("handles evenly divisible arrays", () => {
        assert.deepStrictEqual(chunkArray([1, 2, 3, 4], 2), [[1, 2], [3, 4]]);
    });

    it("returns empty array for empty input", () => {
        assert.deepStrictEqual(chunkArray([], 2), []);
    });

    it("throws for non-array input", () => {
        assert.throws(() => chunkArray("not an array" as any, 2), /must be an array/);
    });
});

describe("convertMS", () => {
    it("converts 1 hour correctly", () => {
        assert.deepStrictEqual(convertMS(3600000), { hour: 1, minute: 0, totalMin: 60, seconds: 0 });
    });

    it("converts 1 minute 30 seconds correctly", () => {
        assert.deepStrictEqual(convertMS(90000), { hour: 0, minute: 1, totalMin: 1, seconds: 30 });
    });

    it("returns all zeros for 0ms", () => {
        assert.deepStrictEqual(convertMS(0), { hour: 0, minute: 0, totalMin: 0, seconds: 0 });
    });
});

describe("getDivider", () => {
    it("returns a string of equals signs by default", () => {
        assert.strictEqual(getDivider(5), "=====");
    });

    it("uses the custom divChar when provided", () => {
        assert.strictEqual(getDivider(3, "-"), "---");
    });

    it("throws for count <= 0", () => {
        assert.throws(() => getDivider(0), /Invalid count/);
        assert.throws(() => getDivider(-1), /Invalid count/);
    });

    it("throws for non-string divChar", () => {
        assert.throws(() => getDivider(5, 42 as any), /divChar must be a string/);
    });
});

describe("isValidZone", () => {
    it("returns true for a valid IANA timezone", () => {
        assert.strictEqual(isValidZone("America/Los_Angeles"), true);
    });

    it("returns true for UTC", () => {
        assert.strictEqual(isValidZone("UTC"), true);
    });

    it("returns false for an invalid timezone string", () => {
        assert.strictEqual(isValidZone("NotAZone"), false);
    });

    it("returns false for an empty string", () => {
        assert.strictEqual(isValidZone(""), false);
    });
});

describe("isUserID", () => {
    it("returns true for a mention format", () => {
        assert.strictEqual(isUserID("<@123456789012345678>"), true);
    });

    it("returns true for a raw 18-digit ID", () => {
        assert.strictEqual(isUserID("123456789012345678"), true);
    });

    it("returns false for a too-short string", () => {
        assert.strictEqual(isUserID("12345"), false);
    });

    it("returns false for an empty string", () => {
        assert.strictEqual(isUserID(""), false);
    });
});

describe("getUserID", () => {
    it("extracts ID from a mention", () => {
        assert.strictEqual(getUserID("<@123456789012345678>"), "123456789012345678");
    });

    it("returns the raw ID when given a bare ID", () => {
        assert.strictEqual(getUserID("123456789012345678"), "123456789012345678");
    });

    it("returns null for a too-short string", () => {
        assert.strictEqual(getUserID("12345"), null);
    });

    it("returns null for an empty string", () => {
        assert.strictEqual(getUserID(""), null);
    });
});

describe("isChannelId", () => {
    it("returns true for a valid 18-digit channel ID", () => {
        assert.strictEqual(isChannelId("123456789012345678"), true);
    });

    it("returns false for a too-short string", () => {
        assert.strictEqual(isChannelId("12345"), false);
    });
});

describe("getGearStr", () => {
    it("returns N/A when gear is 0 (not unlocked)", () => {
        assert.strictEqual(getGearStr({ gear: 0 } as any), "N/A");
    });

    it("appends +N for equipped gear pieces", () => {
        assert.strictEqual(getGearStr({ gear: 9, equipped: [1, 2, 3, 4] } as any), "9+4");
    });

    it("appends relic tier when no equipped pieces", () => {
        assert.strictEqual(getGearStr({ gear: 13, relic: { currentTier: 7 } } as any), "13r5");
    });

    it("returns just gear number when equipped is empty and relic tier <= 2", () => {
        assert.strictEqual(getGearStr({ gear: 13, equipped: [] } as any), "13");
    });
});
