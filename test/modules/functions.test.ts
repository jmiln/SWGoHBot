import assert from "node:assert";
import { describe, it } from "node:test";
import {
    charListFromSearch,
    chunkArray,
    convertMS,
    expandSpaces,
    findCharOrShip,
    formatCurrentTime,
    formatDuration,
    getAbilityType,
    getCurrentWeekday,
    getDivider,
    getGearStr,
    getSetTimeForTimezone,
    getStartOfDay,
    getTimezoneOffset,
    getUserID,
    getUTCFromOffset,
    isAllyCode,
    isChannelId,
    isUserID,
    isValidZone,
    msgArray,
    msgArrayToFields,
    shortenNum,
    summarizeCharLevels,
    toProperCase,
    trimFloat,
} from "../../modules/functions.ts";
import type { SWAPIPlayer } from "../../types/swapi_types.ts";
import type { BotUnit } from "../../types/types.ts";
import { createMockLanguage } from "../mocks/index.ts";

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

const minMS = 1000 * 60;
const hrMS = 1000 * 60 * 60;
const dayMS = 1000 * 60 * 60 * 24;

describe("formatDuration", () => {
    const lang = createMockLanguage();

    it("returns '0 min' for zero duration", () => {
        assert.strictEqual(formatDuration(0, lang), "0 min");
    });

    it("formats minutes only when under one hour", () => {
        assert.strictEqual(formatDuration(45 * minMS, lang), "45 min");
    });

    it("formats exactly one hour with singular hr label", () => {
        assert.strictEqual(formatDuration(1 * hrMS, lang), "1 hr, 0 min");
    });

    it("formats hours and minutes together", () => {
        assert.strictEqual(formatDuration(1 * hrMS + 30 * minMS, lang), "1 hr, 30 min");
    });

    it("uses plural hrs label for more than one hour", () => {
        assert.strictEqual(formatDuration(2 * hrMS, lang), "2 hrs, 0 min");
    });

    it("formats multi-hour with minutes", () => {
        assert.strictEqual(formatDuration(3 * hrMS + 15 * minMS, lang), "3 hrs, 15 min");
    });
});

describe("getUTCFromOffset", () => {
    it("returns UTC midnight for offset 0", () => {
        const d = new Date();
        const utcMidnight = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
        assert.strictEqual(getUTCFromOffset(0), utcMidnight);
    });

    it("result for offset 0 is always exactly divisible by a full day", () => {
        assert.strictEqual(getUTCFromOffset(0) % dayMS, 0);
    });

    it("result differs by exactly the offset minutes between two calls", () => {
        const result0 = getUTCFromOffset(0);
        const result60 = getUTCFromOffset(60);
        assert.strictEqual(result0 - result60, 60 * minMS);
    });

    it("negative offset gives a later timestamp than offset 0", () => {
        const result0 = getUTCFromOffset(0);
        const resultNeg60 = getUTCFromOffset(-60);
        assert.strictEqual(resultNeg60 - result0, 60 * minMS);
    });

    it("offset of one full day equals UTC midnight of the previous day", () => {
        const result0 = getUTCFromOffset(0);
        const result1440 = getUTCFromOffset(1440);
        assert.strictEqual(result0 - result1440, dayMS);
    });
});

describe("getTimezoneOffset", () => {
    it("returns 0 for UTC", () => {
        assert.strictEqual(getTimezoneOffset("UTC"), 0);
    });

    it("returns 330 for Asia/Kolkata (UTC+5:30, no DST)", () => {
        assert.strictEqual(getTimezoneOffset("Asia/Kolkata"), 330);
    });

    it("returns -420 for America/Phoenix (MST, no DST)", () => {
        assert.strictEqual(getTimezoneOffset("America/Phoenix"), -420);
    });

    it("returns null for an invalid timezone", () => {
        assert.strictEqual(getTimezoneOffset("Not/AZone"), null);
    });
});

describe("getSetTimeForTimezone", () => {
    it("converts a UTC datetime string to the correct UTC timestamp", () => {
        // offset 0 for UTC, so result equals Date.UTC directly
        const expected = Date.UTC(2025, 0, 15, 12, 0);
        assert.strictEqual(getSetTimeForTimezone("01/15/2025 12:00", "UTC"), expected);
    });

    it("shifts the timestamp by the timezone offset for a positive-offset zone", () => {
        // IST (UTC+5:30) = +330 min; noon IST = 06:30 UTC
        const expected = Date.UTC(2025, 6, 4, 12, 0) - 330 * minMS;
        assert.strictEqual(getSetTimeForTimezone("07/04/2025 12:00", "Asia/Kolkata"), expected);
    });

    it("shifts the timestamp by the timezone offset for a negative-offset zone", () => {
        // America/Phoenix (UTC-7) = -420 min; noon MST = 19:00 UTC
        const expected = Date.UTC(2025, 6, 4, 12, 0) - (-420) * minMS;
        assert.strictEqual(getSetTimeForTimezone("07/04/2025 12:00", "America/Phoenix"), expected);
    });

    it("throws when the year is not 4 digits", () => {
        assert.throws(() => getSetTimeForTimezone("01/15/25 12:00", "UTC"), /Year MUST be 4/);
    });
});

describe("getCurrentWeekday", () => {
    const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

    it("returns a valid day of the week for UTC", () => {
        const result = getCurrentWeekday("UTC");
        assert.ok(DAYS.includes(result), `Expected a weekday name, got: ${result}`);
    });

    it("returns a valid day name when no zone is given", () => {
        const result = getCurrentWeekday();
        assert.ok(DAYS.includes(result), `Expected a weekday name, got: ${result}`);
    });

    it("falls back gracefully for an invalid timezone and still returns a weekday", () => {
        const result = getCurrentWeekday("Not/AZone");
        assert.ok(DAYS.includes(result), `Expected a weekday name, got: ${result}`);
    });
});

describe("formatCurrentTime", () => {
    it("returns a non-empty string for a valid timezone", () => {
        const result = formatCurrentTime("UTC");
        assert.ok(typeof result === "string" && result.length > 0, "Expected a non-empty string");
    });

    it("does not throw for an invalid timezone (falls back to UTC)", () => {
        assert.doesNotThrow(() => formatCurrentTime("Not/AZone"));
    });

    it("returns a non-empty string when no timezone is provided", () => {
        const result = formatCurrentTime();
        assert.ok(result.length > 0, "Expected a non-empty string");
    });
});

describe("getStartOfDay", () => {
    it("returns a Date instance", () => {
        assert.ok(getStartOfDay("UTC") instanceof Date);
    });

    it("has zero UTC hours, minutes, seconds, and milliseconds", () => {
        const result = getStartOfDay("UTC");
        assert.strictEqual(result.getUTCHours(), 0);
        assert.strictEqual(result.getUTCMinutes(), 0);
        assert.strictEqual(result.getUTCSeconds(), 0);
        assert.strictEqual(result.getUTCMilliseconds(), 0);
    });

    it("represents the start of the current UTC day", () => {
        const before = new Date();
        const result = getStartOfDay("UTC");
        // Capture after in case the test runs right at midnight and the date rolls over
        const after = new Date();

        const resultDay = result.toISOString().slice(0, 10);
        assert.ok(
            resultDay === before.toISOString().slice(0, 10) || resultDay === after.toISOString().slice(0, 10),
            `Expected start-of-day ${resultDay} to match current UTC date`,
        );
        assert.strictEqual(result.getUTCHours(), 0);
        assert.strictEqual(result.getUTCMinutes(), 0);
        assert.strictEqual(result.getUTCSeconds(), 0);
        assert.strictEqual(result.getUTCMilliseconds(), 0);
    });
});

describe("summarizeCharLevels", () => {
    function makePlayer(roster: any[]): SWAPIPlayer {
        return { roster } as unknown as SWAPIPlayer;
    }

    const player = makePlayer([
        { combatType: 1, gear: 13, rarity: 7, relic: { currentTier: 7 } }, // char: g13, rarity 7, R5
        { combatType: 1, gear: 12, rarity: 6, relic: { currentTier: 2 } }, // char: g12, rarity 6, not reliced
        { combatType: 2, gear: 13, rarity: 7, relic: { currentTier: 7 } }, // ship: should be ignored
    ]);

    it("throws for an invalid type", () => {
        assert.throws(() => summarizeCharLevels([player], "weight"), /Invalid type/);
    });

    it("throws when input is not an array", () => {
        assert.throws(() => summarizeCharLevels(null as any, "gear"), /must be an array/);
    });

    it("counts gear levels correctly, excluding ships", () => {
        const [levels] = summarizeCharLevels([player], "gear");
        assert.strictEqual(levels[13], 1, "Expected 1 character at G13");
        assert.strictEqual(levels[12], 1, "Expected 1 character at G12");
        assert.strictEqual(levels[11], undefined, "Expected no character at G11");
    });

    it("calculates correct gear average", () => {
        const [, avg] = summarizeCharLevels([player], "gear");
        // (13*1 + 12*1) / 2 = 12.5
        assert.strictEqual(avg, "12.50");
    });

    it("counts relic tiers correctly using the currentTier - 2 offset", () => {
        // currentTier=7 → relic 5; currentTier=2 → not reliced (0, skipped)
        const [levels] = summarizeCharLevels([player], "relic");
        assert.strictEqual(levels[5], 1, "Expected 1 character at R5");
        assert.strictEqual(levels[0], undefined, "Non-reliced characters should not appear");
    });

    it("counts rarity levels correctly", () => {
        const [levels] = summarizeCharLevels([player], "rarity");
        assert.strictEqual(levels[7], 1, "Expected 1 character at 7-star");
        assert.strictEqual(levels[6], 1, "Expected 1 character at 6-star");
    });

    it("handles an empty roster", () => {
        const [levels, avg] = summarizeCharLevels([makePlayer([])], "gear");
        assert.deepStrictEqual(levels, {});
        assert.strictEqual(avg, "NaN");
    });

    it("aggregates across multiple players", () => {
        const p2 = makePlayer([
            { combatType: 1, gear: 13, rarity: 7, relic: { currentTier: 9 } }, // G13, R7
        ]);
        const [levels] = summarizeCharLevels([player, p2], "gear");
        assert.strictEqual(levels[13], 2, "Expected 2 characters at G13 across both players");
        assert.strictEqual(levels[12], 1, "Expected 1 character at G12");
    });
});
