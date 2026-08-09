import assert from "node:assert";
import { after, describe, it } from "node:test";
import { createHttpForwarder } from "../../services/swapiServe/forwarder.ts";
import { startFakeComlink } from "../helpers/fakeComlink.ts";

const CREDENTIALS = { accessKey: "test-access", secretKey: "test-secret" };

describe("swapiServe.createHttpForwarder", () => {
    it("returns the upstream status, headers and body untouched", async () => {
        const comlink = await startFakeComlink(() => ({ status: 200, body: JSON.stringify({ player: "found" }) }));
        after(async () => await comlink.close());

        const forward = createHttpForwarder(CREDENTIALS);
        const result = await forward(comlink.url, { method: "POST", uri: "/player", body: Buffer.from("{}") });

        assert.strictEqual(result.status, 200);
        assert.deepStrictEqual(JSON.parse(result.body.toString()), { player: "found" });
    });

    it("signs the request with a fresh X-Date", async () => {
        const comlink = await startFakeComlink(() => ({ status: 200 }));
        after(async () => await comlink.close());

        const forward = createHttpForwarder(CREDENTIALS);
        await forward(comlink.url, { method: "POST", uri: "/player", body: Buffer.from("{}") });

        const headers = comlink.lastHeaders();
        assert.ok(headers["x-date"], "should stamp X-Date");
        assert.match(String(headers.authorization), /^HMAC-SHA256 Credential=test-access,Signature=/);
    });

    it("forwards the body byte for byte, so the re-signed md5 stays valid", async () => {
        const comlink = await startFakeComlink(() => ({ status: 200 }));
        after(async () => await comlink.close());

        const body = JSON.stringify({ payload: { allyCode: "123456789" }, spacing: "  preserved  " });
        const forward = createHttpForwarder(CREDENTIALS);
        await forward(comlink.url, { method: "POST", uri: "/player", body: Buffer.from(body) });

        assert.strictEqual(comlink.lastBody(), body);
    });

    it("reports an undefined status when the upstream is unreachable", async () => {
        const forward = createHttpForwarder(CREDENTIALS);
        // Port 1 on loopback reliably refuses
        const result = await forward("http://127.0.0.1:1", { method: "POST", uri: "/player", body: Buffer.from("{}") });

        assert.strictEqual(result.status, undefined, "a transport failure has no status");
    });

    it("gives up on a hung backend once the timeout elapses", async () => {
        const comlink = await startFakeComlink(() => ({ status: 200, delayMs: 5000 }));
        after(async () => await comlink.close());

        const forward = createHttpForwarder({ ...CREDENTIALS, timeoutMs: 50 });
        const result = await forward(comlink.url, { method: "POST", uri: "/player", body: Buffer.from("{}") });

        assert.strictEqual(result.status, undefined, "a timeout must not hold the slot indefinitely");
    });
});
