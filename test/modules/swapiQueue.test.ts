import assert from "node:assert";
import { after, beforeEach, describe, it } from "node:test";
import { FALLBACK_MAX_CONCURRENT, PRIORITY } from "../../data/constants/swapiServe.ts";
import { __resetForTesting, __serviceDownForTesting, __setUrlsForTesting, resolveBulkStub, withStub } from "../../modules/swapiQueue.ts";
import { startFakeComlink } from "../helpers/fakeComlink.ts";

describe("swapiQueue routing", () => {
    beforeEach(() => __resetForTesting());

    it("sends the request to swapiServe with the tier's path prefix", async () => {
        let seenUri = "";
        const serve = await startFakeComlink(({ uri }) => {
            seenUri = uri;
            return { status: 200, body: JSON.stringify({ ok: true }) };
        });
        after(async () => await serve.close());

        __setUrlsForTesting({ serveUrl: serve.url, directUrl: "http://unused.invalid" });
        await withStub(PRIORITY.SUPPORTER_COMMAND, (stub) => stub.getPlayer("123456789"));

        assert.strictEqual(seenUri, "/p1/player");
    });

    it("uses a different prefix for a different tier", async () => {
        let seenUri = "";
        const serve = await startFakeComlink(({ uri }) => {
            seenUri = uri;
            return { status: 200, body: JSON.stringify({ ok: true }) };
        });
        after(async () => await serve.close());

        __setUrlsForTesting({ serveUrl: serve.url, directUrl: "http://unused.invalid" });
        await withStub(PRIORITY.BULK, (stub) => stub.getPlayer("123456789"));

        assert.strictEqual(seenUri, "/p4/player");
    });
});

describe("swapiQueue fail-open fallback", () => {
    beforeEach(() => __resetForTesting());

    // Losing the governor should cost throughput and coordination, not availability.
    it("falls back to calling comlink directly when swapiServe refuses the connection", async () => {
        const direct = await startFakeComlink(() => ({ status: 200, body: JSON.stringify({ viaDirect: true }) }));
        after(async () => await direct.close());

        // Port 1 on loopback reliably refuses
        __setUrlsForTesting({ serveUrl: "http://127.0.0.1:1", directUrl: direct.url });

        const result = (await withStub(PRIORITY.PUBLIC_COMMAND, (stub) => stub.getPlayer("123456789"))) as { viaDirect: boolean };

        assert.strictEqual(result.viaDirect, true);
        assert.strictEqual(direct.requestCount(), 1);
    });

    it("sends the unprefixed path when talking to comlink directly", async () => {
        let seenUri = "";
        const direct = await startFakeComlink(({ uri }) => {
            seenUri = uri;
            return { status: 200, body: JSON.stringify({ ok: true }) };
        });
        after(async () => await direct.close());

        __setUrlsForTesting({ serveUrl: "http://127.0.0.1:1", directUrl: direct.url });
        await withStub(PRIORITY.PUBLIC_COMMAND, (stub) => stub.getPlayer("123456789"));

        assert.strictEqual(seenUri, "/player");
    });

    it("stops retrying swapiServe for a while after it has failed", async () => {
        const direct = await startFakeComlink(() => ({ status: 200, body: JSON.stringify({ ok: true }) }));
        after(async () => await direct.close());

        __setUrlsForTesting({ serveUrl: "http://127.0.0.1:1", directUrl: direct.url });

        for (let i = 0; i < 3; i++) await withStub(PRIORITY.PUBLIC_COMMAND, (stub) => stub.getPlayer("123456789"));

        assert.strictEqual(direct.requestCount(), 3, "every call should still be served");
        assert.strictEqual(__serviceDownForTesting(), true, "and the service should be marked down rather than retried each time");
    });

    // A 400 is a real answer from upstream. Bypassing the queue on it would mean an invalid ally
    // code silently escaped the global budget.
    it("propagates a genuine upstream error rather than falling back", async () => {
        const serve = await startFakeComlink(() => ({
            status: 400,
            body: JSON.stringify({ message: "Failed to find ally code 1" }),
        }));
        const direct = await startFakeComlink(() => ({ status: 200, body: JSON.stringify({ ok: true }) }));
        after(async () => {
            await serve.close();
            await direct.close();
        });

        __setUrlsForTesting({ serveUrl: serve.url, directUrl: direct.url });

        await assert.rejects(async () => await withStub(PRIORITY.PUBLIC_COMMAND, (stub) => stub.getPlayer("123456789")));
        assert.strictEqual(direct.requestCount(), 0, "a 400 is not a reason to bypass the queue");
    });

    it("caps concurrency on the fallback path, since nothing else is coordinating it", async () => {
        const direct = await startFakeComlink(() => ({ status: 200, body: JSON.stringify({ ok: true }), delayMs: 20 }));
        after(async () => await direct.close());

        __setUrlsForTesting({ serveUrl: "http://127.0.0.1:1", directUrl: direct.url });

        await Promise.all(Array.from({ length: 20 }, () => withStub(PRIORITY.BULK, (stub) => stub.getPlayer("123456789"))));

        assert.strictEqual(direct.requestCount(), 20);
        assert.ok(
            direct.peakConcurrent() <= FALLBACK_MAX_CONCURRENT,
            `fallback concurrency reached ${direct.peakConcurrent()}, above the cap of ${FALLBACK_MAX_CONCURRENT}`,
        );
    });
});

// dataUpdater and the mod worker cannot use withStub: they build one stub and thread it through
// a dozen functions, one of which reaches for a private method the library has no wrapper for.
// So they resolve a stub once at startup instead, and inherit the same fail-open behaviour.
describe("swapiQueue.resolveBulkStub", () => {
    beforeEach(() => __resetForTesting());

    it("returns a bulk-tier stub pointed at swapiServe when it is healthy", async () => {
        let seenUri = "";
        const serve = await startFakeComlink(({ uri }) => {
            seenUri = uri;
            return { status: 200, body: JSON.stringify({ backends: [] }) };
        });
        after(async () => await serve.close());

        __setUrlsForTesting({ serveUrl: serve.url, directUrl: "http://unused.invalid" });
        const { stub } = await resolveBulkStub();
        await stub.getPlayer("123456789");

        assert.strictEqual(seenUri, "/p4/player", "bulk work must be queued at the lowest tier");
    });

    it("falls back to calling comlink directly when swapiServe is unreachable", async () => {
        let seenUri = "";
        const direct = await startFakeComlink(({ uri }) => {
            seenUri = uri;
            return { status: 200, body: JSON.stringify({ ok: true }) };
        });
        after(async () => await direct.close());

        __setUrlsForTesting({ serveUrl: "http://127.0.0.1:1", directUrl: direct.url });
        const { stub } = await resolveBulkStub();
        await stub.getPlayer("123456789");

        assert.strictEqual(seenUri, "/player", "a nightly cycle should still run without the governor");
    });

    // The Piscina threads cannot be handed a stub, and the mod worker signs its own requests so it
    // can attach an AbortSignal. Both need the same base URL the stub was built from, so the two
    // must never be able to disagree about where bulk traffic goes.
    it("returns a url matching the stub it built, on both paths", async () => {
        const serve = await startFakeComlink(({ uri }) => {
            return uri === "/status" ? { status: 200, body: JSON.stringify({ backends: [] }) } : { status: 200, body: "{}" };
        });
        after(async () => await serve.close());

        __setUrlsForTesting({ serveUrl: serve.url, directUrl: "http://unused.invalid" });
        const queued = await resolveBulkStub();
        assert.strictEqual(queued.url, `${serve.url}/p4`, "the queued path points at the bulk tier");
        assert.strictEqual(queued.url, queued.stub.url, "and the stub agrees");

        __resetForTesting();
        __setUrlsForTesting({ serveUrl: "http://127.0.0.1:1", directUrl: "http://direct.invalid" });
        const fallback = await resolveBulkStub();
        assert.strictEqual(fallback.url, "http://direct.invalid", "the fallback points straight at comlink");
        assert.strictEqual(fallback.url, fallback.stub.url, "and the stub agrees");
    });
});
