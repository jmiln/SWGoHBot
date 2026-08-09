import assert from "node:assert";
import { after, describe, it } from "node:test";
import { PRIORITY } from "../../data/constants/swapiServe.ts";
import { Dispatcher } from "../../services/swapiServe/dispatcher.ts";
import type { Forwarder } from "../../services/swapiServe/forwarder.ts";
import { startFakeComlink } from "../helpers/fakeComlink.ts";

// The token bucket defaults to a deliberately slow production rate. Tests that are not
// specifically about pacing set it high so the rate never binds and only the behaviour under
// test is measured.
const CREDENTIALS = { accessKey: "test-access", secretKey: "test-secret", ratePerSecond: 1000 };

function request(priority: 0 | 1 | 2 | 3 | 4, uri = "/player") {
    return { method: "POST", uri, body: Buffer.from("{}"), priority, deadline: Date.now() + 60_000 };
}

const okForwarder: Forwarder = async () => ({ status: 200, headers: {}, body: Buffer.from(JSON.stringify({ ok: true })) });

describe("swapiServe.Dispatcher forwarding", () => {
    it("forwards the request and returns the upstream response untouched", async () => {
        const comlink = await startFakeComlink(() => ({ status: 200, body: JSON.stringify({ name: "test player" }) }));
        const dispatcher = new Dispatcher({ backends: [comlink.url], ...CREDENTIALS });
        after(async () => {
            dispatcher.stop();
            await comlink.close();
        });

        const response = await dispatcher.submit(request(PRIORITY.PUBLIC_COMMAND));

        assert.strictEqual(response.status, 200);
        assert.deepStrictEqual(JSON.parse(response.body.toString()), { name: "test player" });
    });

    it("preserves the request path so the upstream routes it correctly", async () => {
        let seenUri = "";
        const comlink = await startFakeComlink(({ uri }) => {
            seenUri = uri;
            return { status: 200 };
        });
        const dispatcher = new Dispatcher({ backends: [comlink.url], ...CREDENTIALS });
        after(async () => {
            dispatcher.stop();
            await comlink.close();
        });

        await dispatcher.submit(request(PRIORITY.PUBLIC_COMMAND, "/guild"));

        assert.strictEqual(seenUri, "/guild");
    });
});

describe("swapiServe.Dispatcher priority", () => {
    // The behaviour the whole design exists for.
    it("serves an arena tick ahead of bulk work queued before it", async () => {
        const order: string[] = [];
        let release: (() => void) | null = null;
        const gate = new Promise<void>((resolve) => {
            release = resolve;
        });

        let first = true;
        const forwarder: Forwarder = async (_url, req) => {
            order.push(req.uri);
            // Hold the very first request open so everything else has to queue behind it.
            if (first) {
                first = false;
                await gate;
            }
            return { status: 200, headers: {}, body: Buffer.alloc(0) };
        };

        const dispatcher = new Dispatcher({ backends: ["sim://a"], ...CREDENTIALS, forwarder, startLimit: 1 });
        after(() => dispatcher.stop());

        const bulk = Array.from({ length: 20 }, (_, i) => dispatcher.submit(request(PRIORITY.BULK, `/bulk-${i}`)));
        await new Promise((resolve) => setImmediate(resolve));
        const tick = dispatcher.submit(request(PRIORITY.ARENA_TICK, "/arena"));

        release?.();
        await Promise.all([...bulk, tick]);

        const arenaIndex = order.indexOf("/arena");
        assert.ok(arenaIndex >= 0, "arena request should have been sent");
        assert.ok(arenaIndex <= 2, `arena should be served near-immediately, was position ${arenaIndex}`);
    });
});

describe("swapiServe.Dispatcher retry", () => {
    it("retries a server error and returns the eventual success", async () => {
        const comlink = await startFakeComlink(({ count }) =>
            count < 3
                ? { status: 502, body: JSON.stringify({ message: "Bad Gateway" }) }
                : { status: 200, body: JSON.stringify({ ok: true }) },
        );
        const dispatcher = new Dispatcher({ backends: [comlink.url], ...CREDENTIALS, retryDelayMs: 0 });
        after(async () => {
            dispatcher.stop();
            await comlink.close();
        });

        const response = await dispatcher.submit(request(PRIORITY.PUBLIC_COMMAND));

        assert.strictEqual(response.status, 200);
        assert.strictEqual(comlink.requestCount(), 3);
    });

    // The old code refused to retry a 429 because nothing paced us. Now the governor has already
    // halved the backend's rate by the time the retry is queued.
    it("retries a 429 and returns the eventual success", async () => {
        const comlink = await startFakeComlink(({ count }) =>
            count < 2
                ? { status: 429, body: JSON.stringify({ message: "Too Many Requests" }) }
                : { status: 200, body: JSON.stringify({ ok: true }) },
        );
        const dispatcher = new Dispatcher({ backends: [comlink.url], ...CREDENTIALS, retryDelayMs: 0 });
        after(async () => {
            dispatcher.stop();
            await comlink.close();
        });

        const response = await dispatcher.submit(request(PRIORITY.PUBLIC_COMMAND));

        assert.strictEqual(response.status, 200);
        assert.strictEqual(comlink.requestCount(), 2);
    });

    it("does not retry a missing ally code", async () => {
        const comlink = await startFakeComlink(() => ({
            status: 400,
            body: JSON.stringify({ message: "Failed to find ally code 123456789" }),
        }));
        const dispatcher = new Dispatcher({ backends: [comlink.url], ...CREDENTIALS, retryDelayMs: 0 });
        after(async () => {
            dispatcher.stop();
            await comlink.close();
        });

        const response = await dispatcher.submit(request(PRIORITY.PUBLIC_COMMAND));

        assert.strictEqual(response.status, 400);
        assert.strictEqual(comlink.requestCount(), 1);
    });

    it("gives up and returns the last upstream response once attempts are exhausted", async () => {
        const comlink = await startFakeComlink(() => ({ status: 502, body: JSON.stringify({ message: "Bad Gateway" }) }));
        const dispatcher = new Dispatcher({ backends: [comlink.url], ...CREDENTIALS, retryDelayMs: 0 });
        after(async () => {
            dispatcher.stop();
            await comlink.close();
        });

        const response = await dispatcher.submit(request(PRIORITY.PUBLIC_COMMAND));

        assert.strictEqual(response.status, 502, "the caller should see the real upstream failure");
        assert.ok(comlink.requestCount() > 1, "and it should have been retried first");
    });
});

describe("swapiServe.Dispatcher health adaptation", () => {
    it("collapses the limit after a burst of 429s", async () => {
        const comlink = await startFakeComlink(() => ({ status: 429, body: JSON.stringify({ message: "Too Many Requests" }) }));
        const dispatcher = new Dispatcher({ backends: [comlink.url], ...CREDENTIALS, retryDelayMs: 0 });
        after(async () => {
            dispatcher.stop();
            await comlink.close();
        });

        const startingLimit = dispatcher.status().backends[0].limit;
        await Promise.all(Array.from({ length: 8 }, () => dispatcher.submit(request(PRIORITY.BULK))));

        assert.ok(dispatcher.status().backends[0].limit < startingLimit, "limit should shrink under throttling");
    });

    it("does not shrink the limit for missing ally codes", async () => {
        const comlink = await startFakeComlink(() => ({
            status: 400,
            body: JSON.stringify({ message: "Failed to find ally code 1" }),
        }));
        const dispatcher = new Dispatcher({ backends: [comlink.url], ...CREDENTIALS, retryDelayMs: 0 });
        after(async () => {
            dispatcher.stop();
            await comlink.close();
        });

        const startingLimit = dispatcher.status().backends[0].limit;
        await Promise.all(Array.from({ length: 8 }, () => dispatcher.submit(request(PRIORITY.PUBLIC_COMMAND))));

        assert.strictEqual(dispatcher.status().backends[0].limit, startingLimit);
    });
});

describe("swapiServe.Dispatcher rate pacing", () => {
    // A queue held back by the rate rather than by concurrency gets no completion event to wake
    // it. Without the wakeup timer these requests would hang until something else happened to
    // pump the queue, which in a quiet moment is never.
    it("drains a queue that is blocked on tokens rather than on slots", async () => {
        const dispatcher = new Dispatcher({
            backends: ["sim://a"],
            accessKey: "a",
            secretKey: "s",
            forwarder: okForwarder,
            startLimit: 50,
            ratePerSecond: 60,
        });
        after(() => dispatcher.stop());

        const responses = await Promise.all(Array.from({ length: 130 }, () => dispatcher.submit(request(PRIORITY.BULK))));

        assert.strictEqual(responses.filter((response) => response.status === 200).length, 130, "every request should eventually be sent");
        assert.ok(dispatcher.status().blocked.token > 0, "and the rate should have been the binding constraint");
    });
});

describe("swapiServe.Dispatcher shedding", () => {
    it("rejects a request whose deadline has already passed", async () => {
        let called = 0;
        const forwarder: Forwarder = async () => {
            called++;
            return { status: 200, headers: {}, body: Buffer.alloc(0) };
        };
        const dispatcher = new Dispatcher({ backends: ["sim://a"], ...CREDENTIALS, forwarder });
        after(() => dispatcher.stop());

        const response = await dispatcher.submit({ ...request(PRIORITY.PUBLIC_COMMAND), deadline: Date.now() - 1 });

        assert.strictEqual(response.status, 503);
        assert.strictEqual(called, 0, "expired work must never reach the backend");
        assert.strictEqual(dispatcher.status().terminal.deadline, 1);
    });

    it("rejects with 503 when the tier queue is full", async () => {
        let release: (() => void) | null = null;
        const gate = new Promise<void>((resolve) => {
            release = resolve;
        });
        const forwarder: Forwarder = async () => {
            await gate;
            return { status: 200, headers: {}, body: Buffer.alloc(0) };
        };

        const dispatcher = new Dispatcher({
            backends: ["sim://a"],
            ...CREDENTIALS,
            forwarder,
            startLimit: 1,
            depthLimits: [1, 1, 1, 1, 1],
        });
        after(() => dispatcher.stop());

        const responses = Array.from({ length: 6 }, () => dispatcher.submit(request(PRIORITY.BULK)));
        await new Promise((resolve) => setImmediate(resolve));
        release?.();
        const settled = await Promise.all(responses);

        assert.ok(
            settled.some((response) => response.status === 503),
            "at least one request should be shed once the queue is full",
        );
        assert.ok(dispatcher.status().terminal.queue_overflow > 0, "and it should be recorded as an overflow");
    });

    it("withdraws a queued request when the caller aborts", async () => {
        let release: (() => void) | null = null;
        const gate = new Promise<void>((resolve) => {
            release = resolve;
        });
        const seen: string[] = [];
        const forwarder: Forwarder = async (_url, req) => {
            seen.push(req.uri);
            if (seen.length === 1) await gate;
            return { status: 200, headers: {}, body: Buffer.alloc(0) };
        };

        const dispatcher = new Dispatcher({ backends: ["sim://a"], ...CREDENTIALS, forwarder, startLimit: 1 });
        after(() => dispatcher.stop());

        const occupying = dispatcher.submit(request(PRIORITY.BULK, "/first"));
        await new Promise((resolve) => setImmediate(resolve));

        const controller = new AbortController();
        const abandoned = dispatcher.submit(request(PRIORITY.BULK, "/abandoned"), controller.signal);
        controller.abort();

        release?.();
        await Promise.all([occupying, abandoned]);

        assert.ok(!seen.includes("/abandoned"), "an abandoned request must never reach the backend");
        assert.strictEqual(dispatcher.status().terminal.cancelled, 1);
    });
});

describe("swapiServe.Dispatcher dead pool", () => {
    // Without fast-fail, a backlog behind a dead backend drains at the circuit-probe rate: one
    // request every 15 seconds, each failing anyway. A hundred callers would take 25 minutes to
    // learn what was knowable in the first second, well past a Discord interaction token's life.
    it("fails the whole queue at once when no backend is usable", async () => {
        const forwarder: Forwarder = async () => ({ status: undefined, headers: {}, body: Buffer.alloc(0) });
        const dispatcher = new Dispatcher({ backends: ["sim://a"], ...CREDENTIALS, forwarder, retryDelayMs: 0 });
        after(() => dispatcher.stop());

        // Open the breaker
        for (let i = 0; i < 15; i++) await dispatcher.submit(request(PRIORITY.BULK));
        assert.strictEqual(dispatcher.status().backends[0].state, "open", "the breaker should be open by now");

        const startedAt = Date.now();
        const responses = await Promise.all(Array.from({ length: 50 }, () => dispatcher.submit(request(PRIORITY.PUBLIC_COMMAND))));
        const elapsed = Date.now() - startedAt;

        assert.strictEqual(responses.length, 50);
        assert.ok(
            responses.every((response) => response.status === 503),
            "every request should be told the backend is unavailable",
        );
        assert.ok(elapsed < 1000, `should fail fast, took ${elapsed}ms`);
        assert.ok(dispatcher.status().terminal.backend_unavailable > 0, "and the reason should be recorded distinctly");
    });

    it("resumes normally once a probe succeeds", async () => {
        let healthy = false;
        const forwarder: Forwarder = async () =>
            healthy
                ? { status: 200, headers: {}, body: Buffer.from(JSON.stringify({ ok: true })) }
                : { status: undefined, headers: {}, body: Buffer.alloc(0) };
        const dispatcher = new Dispatcher({
            backends: ["sim://a"],
            ...CREDENTIALS,
            forwarder,
            retryDelayMs: 0,
            // Short probe interval so the test does not wait out the production 15s.
            circuitProbeIntervalMs: 20,
        });
        after(() => dispatcher.stop());

        for (let i = 0; i < 15; i++) await dispatcher.submit(request(PRIORITY.BULK));
        assert.strictEqual(dispatcher.status().backends[0].state, "open");

        healthy = true;
        await new Promise((resolve) => setTimeout(resolve, 30));

        const response = await dispatcher.submit(request(PRIORITY.PUBLIC_COMMAND));
        assert.strictEqual(response.status, 200, "a successful probe should re-admit the backend");
        assert.strictEqual(dispatcher.status().backends[0].state, "closed");
    });
});

describe("swapiServe.Dispatcher metrics", () => {
    it("records per-endpoint cost so weighting can be decided from evidence later", async () => {
        const dispatcher = new Dispatcher({ backends: ["sim://a"], ...CREDENTIALS, forwarder: okForwarder });
        after(() => dispatcher.stop());

        await dispatcher.submit(request(PRIORITY.PUBLIC_COMMAND, "/player"));
        await dispatcher.submit(request(PRIORITY.PUBLIC_COMMAND, "/player"));
        await dispatcher.submit(request(PRIORITY.PUBLIC_COMMAND, "/guild"));

        const { endpoints } = dispatcher.status();
        assert.strictEqual(endpoints["/player"].count, 2);
        assert.strictEqual(endpoints["/guild"].count, 1);
        assert.ok(endpoints["/player"].meanBytes > 0, "should record payload size");
    });

    it("records one terminal reason per request", async () => {
        const dispatcher = new Dispatcher({ backends: ["sim://a"], ...CREDENTIALS, forwarder: okForwarder });
        after(() => dispatcher.stop());

        await Promise.all([
            dispatcher.submit(request(PRIORITY.PUBLIC_COMMAND)),
            dispatcher.submit(request(PRIORITY.PUBLIC_COMMAND)),
            dispatcher.submit({ ...request(PRIORITY.PUBLIC_COMMAND), deadline: Date.now() - 1 }),
        ]);

        const { terminal } = dispatcher.status();
        assert.strictEqual(terminal.completed, 2);
        assert.strictEqual(terminal.deadline, 1);
    });
});

describe("swapiServe.Dispatcher control", () => {
    it("stops using a drained backend and resumes when it is enabled", async () => {
        const used: string[] = [];
        const forwarder: Forwarder = async (url) => {
            used.push(url);
            return { status: 200, headers: {}, body: Buffer.alloc(0) };
        };
        const dispatcher = new Dispatcher({ backends: ["sim://a", "sim://b"], ...CREDENTIALS, forwarder });
        after(() => dispatcher.stop());

        assert.strictEqual(dispatcher.control("sim://a", "drain", null).ok, true);
        for (let i = 0; i < 5; i++) await dispatcher.submit(request(PRIORITY.BULK));

        assert.ok(!used.includes("sim://a"), "a drained backend must receive nothing");

        assert.strictEqual(dispatcher.control("sim://a", "enable", null).ok, true);
        assert.strictEqual(dispatcher.status().backends[0].drained, false);
    });

    it("rejects an unknown backend or action", () => {
        const dispatcher = new Dispatcher({ backends: ["sim://a"], ...CREDENTIALS, forwarder: okForwarder });
        after(() => dispatcher.stop());

        assert.strictEqual(dispatcher.control("sim://nope", "drain", null).ok, false);
        assert.strictEqual(dispatcher.control("sim://a", "explode", null).ok, false);
    });

    it("applies a limit override and rejects a malformed one", () => {
        const dispatcher = new Dispatcher({ backends: ["sim://a"], ...CREDENTIALS, forwarder: okForwarder });
        after(() => dispatcher.stop());

        assert.strictEqual(dispatcher.control("sim://a", "set-limit", Buffer.from(JSON.stringify({ limit: 12 }))).ok, true);
        assert.strictEqual(dispatcher.status().backends[0].limit, 12);

        assert.strictEqual(dispatcher.control("sim://a", "set-limit", Buffer.from(JSON.stringify({ limit: -1 }))).ok, false);
        assert.strictEqual(dispatcher.control("sim://a", "set-limit", null).ok, false);
    });
});
