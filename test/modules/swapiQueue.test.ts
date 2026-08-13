import assert from "node:assert";
import { after, beforeEach, describe, it } from "node:test";
import {
    DEADLINE_MS,
    FALLBACK_MAX_CONCURRENT,
    PRIORITY,
    SHED_REASON_HEADER,
    SHED_SHUTTING_DOWN,
    UPSTREAM_TIMEOUT_MS,
} from "../../data/constants/swapiServe.ts";
import {
    __resetForTesting,
    __serviceDownForTesting,
    __setUrlsForTesting,
    __setWatchdogMsForTesting,
    resolveBulkStub,
    watchdogMsForTier,
    withStub,
} from "../../modules/swapiQueue.ts";
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

    // A pm2 restart of swapiServe used to fail every queued call across every shard and both
    // updaters: the service answers 503 on the way down, which is a real HTTP answer rather than a
    // connection error, so the fallback never engaged and the calls were simply dropped. That is the
    // outcome the direct-call fallback exists to prevent.
    it("falls back when swapiServe sheds because it is shutting down", async () => {
        const serve = await startFakeComlink(() => ({
            status: 503,
            headers: { [SHED_REASON_HEADER]: SHED_SHUTTING_DOWN },
            body: JSON.stringify({ message: "swapiServe is shutting down" }),
        }));
        const direct = await startFakeComlink(() => ({ status: 200, body: JSON.stringify({ viaDirect: true }) }));
        after(async () => {
            await serve.close();
            await direct.close();
        });

        __setUrlsForTesting({ serveUrl: serve.url, directUrl: direct.url });

        const result = (await withStub(PRIORITY.PUBLIC_COMMAND, (stub) => stub.getPlayer("123456789"))) as { viaDirect: boolean };

        assert.strictEqual(result.viaDirect, true, "the call should have completed against comlink directly");
        assert.ok(__serviceDownForTesting(), "and the service should be latched down so the next call does not retry it");
    });

    // The other shed reasons are the governor working as designed. Bypassing it would send the
    // request straight at comlink with no coordination, which is the load it exists to prevent.
    it("does not fall back when swapiServe sheds for a reason of its own", async () => {
        const serve = await startFakeComlink(() => ({
            status: 503,
            headers: { [SHED_REASON_HEADER]: "queue_overflow" },
            body: JSON.stringify({ message: "swapiServe queue is full for this priority" }),
        }));
        const direct = await startFakeComlink(() => ({ status: 200, body: JSON.stringify({ viaDirect: true }) }));
        after(async () => {
            await serve.close();
            await direct.close();
        });

        __setUrlsForTesting({ serveUrl: serve.url, directUrl: direct.url });

        await assert.rejects(async () => await withStub(PRIORITY.PUBLIC_COMMAND, (stub) => stub.getPlayer("123456789")));
        assert.strictEqual(direct.requestCount(), 0, "a full queue is not a reason to bypass the queue");
    });

    it("does not fall back on an upstream 503 relayed through swapiServe", async () => {
        const serve = await startFakeComlink(() => ({ status: 503, body: JSON.stringify({ message: "comlink is down" }) }));
        const direct = await startFakeComlink(() => ({ status: 200, body: JSON.stringify({ viaDirect: true }) }));
        after(async () => {
            await serve.close();
            await direct.close();
        });

        __setUrlsForTesting({ serveUrl: serve.url, directUrl: direct.url });

        await assert.rejects(async () => await withStub(PRIORITY.PUBLIC_COMMAND, (stub) => stub.getPlayer("123456789")));
        assert.strictEqual(direct.requestCount(), 0, "comlink being down is not a reason to call comlink directly");
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

/**
 * A wedged swapiServe is the one failure the fallback cannot see for itself.
 *
 * Nothing on this side bounds a comlink call: ComlinkStub hardcodes its got options with no timeout,
 * so a service that accepts a connection and never answers holds every caller forever, and unlike a
 * dead process it never produces a connection error to fall back on. Since every shard and both
 * updaters queue through one process, that is one hang shared by all of them.
 *
 * The watchdog does not abandon the call it is watching. Abandoning would leave a loser still holding
 * a socket, a swapiServe slot and a share of the retry budget, which is the mistake the mod worker's
 * comment documents. It only stops NEW work being sent into a service that has stopped answering.
 */
describe("swapiQueue unresponsive-service watchdog", () => {
    beforeEach(() => {
        __resetForTesting();
        __setWatchdogMsForTesting(40);
    });
    after(() => __setWatchdogMsForTesting(null));

    it("stops sending new work to a service that accepts requests and does not answer", async () => {
        const serve = await startFakeComlink(() => ({ status: 200, body: JSON.stringify({ viaServe: true }), delayMs: 300 }));
        const direct = await startFakeComlink(() => ({ status: 200, body: JSON.stringify({ viaDirect: true }) }));
        after(async () => {
            await serve.close();
            await direct.close();
        });

        __setUrlsForTesting({ serveUrl: serve.url, directUrl: direct.url });

        const slow = withStub(PRIORITY.PUBLIC_COMMAND, (stub) => stub.getPlayer("123456789"));
        await new Promise((resolve) => setTimeout(resolve, 120));

        assert.ok(__serviceDownForTesting(), "the service should be latched down once it has missed its own bound");

        const next = (await withStub(PRIORITY.PUBLIC_COMMAND, (stub) => stub.getPlayer("123456789"))) as { viaDirect: boolean };
        assert.strictEqual(next.viaDirect, true, "new work should go direct rather than queue behind a wedged service");

        // The watched call is left alone, and still returns the service's answer when it arrives.
        const answered = (await slow) as { viaServe: boolean };
        assert.strictEqual(answered.viaServe, true, "the watchdog must not abandon the call it was watching");
    });

    it("leaves the service alone when a call answers inside its bound", async () => {
        const serve = await startFakeComlink(() => ({ status: 200, body: JSON.stringify({ viaServe: true }) }));
        after(async () => await serve.close());

        __setUrlsForTesting({ serveUrl: serve.url, directUrl: "http://unused.invalid" });

        await withStub(PRIORITY.PUBLIC_COMMAND, (stub) => stub.getPlayer("123456789"));
        await new Promise((resolve) => setTimeout(resolve, 80));

        assert.strictEqual(__serviceDownForTesting(), false, "a call that answered must not arm anything");
    });
});

/**
 * The bound the watchdog uses, checked against the constants it is derived from rather than by
 * waiting one out.
 */
describe("swapiQueue.watchdogMsForTier", () => {
    beforeEach(() => __setWatchdogMsForTesting(null));

    // The bound has to allow for swapiServe answering LATER than the deadline it advertises. A
    // request dispatched just before its deadline runs to completion, since the upstream cost is
    // already paid, so a healthy call can legitimately take its tier deadline plus the full upstream
    // timeout. A bound tighter than that would call a slow comlink a wedged service.
    it("allows for a request dispatched just before its deadline running the full upstream timeout", () => {
        for (const tier of [PRIORITY.ARENA_TICK, PRIORITY.PUBLIC_COMMAND, PRIORITY.BULK] as const) {
            assert.ok(
                watchdogMsForTier(tier) > DEADLINE_MS[tier] + UPSTREAM_TIMEOUT_MS,
                `tier ${tier} would flag a legitimately slow call as unresponsive`,
            );
        }
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
