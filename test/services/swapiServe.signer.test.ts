import assert from "node:assert";
import crypto from "node:crypto";
import { describe, it } from "node:test";
import { signRequest } from "../../services/swapiServe/signer.ts";

// Re-signed at dispatch rather than forwarded, since a queued request's X-Date would go stale
// past comlink's clock-skew check. Must reproduce comlink-js signPostRequest exactly.
describe("swapiServe.signRequest", () => {
    it("produces headers matching the comlink algorithm for a known body", () => {
        const accessKey = "test-access";
        const secretKey = "test-secret";
        const body = Buffer.from(JSON.stringify({ payload: { allyCode: "123456789" } }));

        const headers = signRequest({ accessKey, secretKey, method: "POST", uri: "/player", body });

        const reqTime = headers["X-Date"];
        assert.ok(reqTime, "should stamp X-Date");

        const hmac = crypto.createHmac("sha256", secretKey);
        hmac.update(reqTime);
        hmac.update("POST");
        hmac.update("/player");
        const hash = crypto.createHash("md5");
        hash.update(body);
        hmac.update(hash.digest("hex"));

        assert.strictEqual(headers.Authorization, `HMAC-SHA256 Credential=${accessKey},Signature=${hmac.digest("hex")}`);
    });

    it("hashes an empty string when there is no body, matching the library", () => {
        const headers = signRequest({ accessKey: "a", secretKey: "s", method: "GET", uri: "/enums", body: null });

        const reqTime = headers["X-Date"];
        const hmac = crypto.createHmac("sha256", "s");
        hmac.update(reqTime);
        hmac.update("GET");
        hmac.update("/enums");
        const hash = crypto.createHash("md5");
        hash.update("");
        hmac.update(hash.digest("hex"));

        assert.strictEqual(headers.Authorization, `HMAC-SHA256 Credential=a,Signature=${hmac.digest("hex")}`);
    });

    it("returns no headers when credentials are absent, matching the library's opt-out", () => {
        const headers = signRequest({ accessKey: "", secretKey: "", method: "POST", uri: "/player", body: null });
        assert.deepStrictEqual(headers, {});
    });

    it("produces a different signature for a different body", () => {
        const first = signRequest({ accessKey: "a", secretKey: "s", method: "POST", uri: "/player", body: Buffer.from('{"a":1}') });
        const second = signRequest({ accessKey: "a", secretKey: "s", method: "POST", uri: "/player", body: Buffer.from('{"a":2}') });
        assert.notStrictEqual(first.Authorization, second.Authorization);
    });
});
