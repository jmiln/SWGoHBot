import assert from "node:assert";
import { describe, it } from "node:test";
import { envBoolean } from "../../config/config.ts";

const schema = envBoolean();

describe("envBoolean", () => {
    // z.coerce.boolean() is Boolean(value), so every non-empty string was true, including "false".
    it("reads the false-ish strings a .env actually contains", () => {
        for (const raw of ["false", "0", "no", "off", ""]) {
            assert.strictEqual(schema.parse(raw), false, `${JSON.stringify(raw)} should be false`);
        }
    });

    it("reads the true-ish strings a .env actually contains", () => {
        for (const raw of ["true", "1", "yes", "on"]) {
            assert.strictEqual(schema.parse(raw), true, `${JSON.stringify(raw)} should be true`);
        }
    });

    it("is case and whitespace insensitive", () => {
        assert.strictEqual(schema.parse("FALSE"), false);
        assert.strictEqual(schema.parse(" True "), true);
    });

    it("leaves an absent variable undefined, which is distinct from false", () => {
        assert.strictEqual(schema.parse(undefined), undefined);
    });

    it("rejects a value it cannot interpret rather than guessing", () => {
        assert.throws(() => schema.parse("maybe"), /maybe/);
    });

    it("applies a default only when the variable is absent, not when it is empty", () => {
        const defaulted = envBoolean().default(false);
        assert.strictEqual(defaulted.parse(undefined), false);
        assert.strictEqual(defaulted.parse(""), false);
        assert.strictEqual(defaulted.parse("true"), true);
    });

    // LOG_PRETTY is three-state: only an absent variable falls back to TTY detection, so a bare
    // `LOG_PRETTY=` in a .env is false. .env.example keeps the line commented out for this reason.
    it("distinguishes absent from empty, which is what LOG_PRETTY's TTY fallback depends on", () => {
        assert.strictEqual(schema.parse(undefined), undefined);
        assert.strictEqual(schema.parse(""), false);
    });
});
