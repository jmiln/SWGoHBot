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

    // fetch decodes a gzipped body but leaves content-encoding and content-length describing the
    // compressed bytes. Returning those alongside the decoded body gives whoever writes the
    // response a body that contradicts its own headers: got tries to gunzip plain JSON, and Node
    // refuses the write outright once it runs past the declared content-length.
    it("drops the encoding headers that describe the compressed bytes rather than the body it returns", async () => {
        const payload = JSON.stringify({ player: "found", padding: "x".repeat(500) });
        const comlink = await startFakeComlink(() => ({ status: 200, body: payload, gzip: true }));
        after(async () => await comlink.close());

        const forward = createHttpForwarder(CREDENTIALS);
        const result = await forward(comlink.url, { method: "POST", uri: "/player", body: Buffer.from("{}") });

        assert.strictEqual(result.body.toString(), payload, "the body should arrive decoded");
        assert.strictEqual(result.headers["content-encoding"], undefined, "content-encoding describes bytes we no longer have");
        assert.strictEqual(result.headers["content-length"], undefined, "content-length would be the compressed length");
        assert.strictEqual(result.headers["content-type"], "application/json", "headers that still describe the body are kept");
    });

    it("drops hop-by-hop headers, which belong to the upstream connection and not to the response", async () => {
        const comlink = await startFakeComlink(() => ({ status: 200, headers: { "Transfer-Encoding": "chunked" } }));
        after(async () => await comlink.close());

        const forward = createHttpForwarder(CREDENTIALS);
        const result = await forward(comlink.url, { method: "POST", uri: "/player", body: Buffer.from("{}") });

        for (const header of ["connection", "keep-alive", "transfer-encoding"]) {
            assert.strictEqual(result.headers[header], undefined, `${header} must not be forwarded`);
        }
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
    // /metadata is the only comlink call that sends no payload: ComlinkStub calls
    // _postRequestPromiseAPI with an undefined body, so got sends neither a body nor a
    // content-type. Declaring JSON over an empty body makes comlink's parser materialise {},
    // so it verifies the signature against md5("{}") while signRequest hashed md5("") - a 403
    // on the one endpoint that dataUpdater calls first.
    it("does not declare a JSON content-type on a request with no body", async () => {
        const comlink = await startFakeComlink(() => ({ status: 200 }));
        after(async () => await comlink.close());

        const forward = createHttpForwarder(CREDENTIALS);
        await forward(comlink.url, { method: "POST", uri: "/metadata", body: Buffer.alloc(0) });

        assert.strictEqual(comlink.lastHeaders()["content-type"], undefined, "an empty body must not claim to be JSON");
    });

    it("still declares a JSON content-type when there is a body", async () => {
        const comlink = await startFakeComlink(() => ({ status: 200 }));
        after(async () => await comlink.close());

        const forward = createHttpForwarder(CREDENTIALS);
        await forward(comlink.url, { method: "POST", uri: "/player", body: Buffer.from('{"payload":{}}') });

        assert.strictEqual(comlink.lastHeaders()["content-type"], "application/json");
    });
});
