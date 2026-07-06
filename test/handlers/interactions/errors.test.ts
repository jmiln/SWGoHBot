import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isIgnoredError } from "../../../handlers/interactions/errors.ts";

describe("isIgnoredError", () => {
    it("matches an ignored substring case-insensitively", () => {
        assert.strictEqual(isIgnoredError("Some Error: unknown interaction happened"), true);
    });

    it("matches regardless of case", () => {
        assert.strictEqual(isIgnoredError("DISCORDAPIERROR: MISSING ACCESS"), true);
    });

    it("returns false for unrelated errors", () => {
        assert.strictEqual(isIgnoredError("TypeError: cannot read properties of undefined"), false);
    });

    it("handles non-string input", () => {
        assert.strictEqual(isIgnoredError(new Error("Unknown message")), true);
        assert.strictEqual(isIgnoredError(undefined), false);
        assert.strictEqual(isIgnoredError(null), false);
    });
});
