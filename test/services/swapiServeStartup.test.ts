import assert from "node:assert";
import { describe, it } from "node:test";
import { buildStartupFields } from "../../services/swapiServe/index.ts";

const BACKENDS = ["http://comlink-a.internal:3360", "http://comlink-b.internal:3360"];

describe("swapiServe startup fields", () => {
    it("reports the listen port and the backend count", () => {
        const fields = buildStartupFields({ port: 3800, backends: BACKENDS, ratePerSecond: 4, startLimit: 6 });
        assert.strictEqual(fields.port, 3800);
        assert.strictEqual(fields.backendCount, 2);
        assert.strictEqual(fields.ratePerSecond, 4);
        assert.strictEqual(fields.startLimit, 6);
    });

    it("includes the package version", () => {
        const fields = buildStartupFields({ port: 3800, backends: BACKENDS });
        assert.match(String(fields.version), /^\d+\.\d+\.\d+/);
    });

    // Backend URLs are SWAPI_CLIENT_URL values identifying upstream infrastructure.
    it("never leaks a backend URL", () => {
        const serialized = JSON.stringify(buildStartupFields({ port: 3800, backends: BACKENDS }));
        assert.doesNotMatch(serialized, /comlink/);
        assert.doesNotMatch(serialized, /3360/);
    });
});
