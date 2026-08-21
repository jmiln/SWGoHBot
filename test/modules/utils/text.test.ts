import assert from "node:assert";
import { describe, it } from "node:test";
import { toProperCase } from "../../../modules/utils/text.ts";

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
