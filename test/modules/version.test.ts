import assert from "node:assert";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { getPackageVersion } from "../../modules/utils/version.ts";

describe("getPackageVersion", () => {
    it("returns the version from package.json", () => {
        const expected = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8")).version;
        assert.strictEqual(getPackageVersion(), expected);
    });

    it("returns a semver string", () => {
        assert.match(getPackageVersion(), /^\d+\.\d+\.\d+/);
    });
});
