import assert from "node:assert";
import { after, describe, it } from "node:test";
import { DEADLINE_MS, PRIORITY, RETRY, SHED_REASON_HEADER, SHED_SHUTTING_DOWN } from "../../data/constants/swapiServe.ts";
import { Dispatcher } from "../../services/swapiServe/dispatcher.ts";
import type { Forwarder } from "../../services/swapiServe/forwarder.ts";
import { FakeClock } from "../helpers/fakeClock.ts";
import { startFakeComlink } from "../helpers/fakeComlink.ts";

// The token bucket defaults to a deliberately slow production rate. Tests that are not
// specifically about pacing set it high so the rate never binds and only the behaviour under
// test is measured.
const CREDENTIALS = { accessKey: "test-access", secretKey: "test-secret", ratePerSecond: 1000 };

function request(priority: 0 | 1 | 2 | 3 | 4, uri = "/player") {
    return { method: "POST", uri, body: Buffer.from("{}"), priority, deadline: Date.now() + 60_000 };
}

const okForwarder: Forwarder = async () => ({ status: 200, headers: {}, body: Buffer.from(JSON.stringify({ ok: true })) });

/** A request whose deadline is expressed against virtual time rather than the wall clock. */
function requestAt(clock: FakeClock, priority: 0 | 1 | 2 | 3 | 4, deadlineMs: number, uri = "/player") {
    return { method: "POST", uri, body: Buffer.from("{}"), priority, deadline: clock.now() + deadlineMs };
}

/**
 * Runs a pending dispatcher call to completion on virtual time.
 *
 * Any test that drives a backend to failure has to be on a fake clock. The governor halves the
 * token rate on every unhealthy outcome, down to RATE.MIN_PER_SEC, which is one token every two
 * seconds; on the real clock a handful of failures then costs the suite most of a minute waiting
 * out refills that prove nothing about the behaviour under test.
 */
async function settle<T>(clock: FakeClock, pending: Promise<T>, maxSteps = 2_000): Promise<T> {
    let done = false;
    const tracked = pending.then((value) => {
        done = true;
        return value;
    });
    for (let step = 0; step < maxSteps && !done; step++) {
        clock.advance(100);
        await clock.flush();
    }
    return tracked;
}

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

    // The retry allowance is the last scarce resource that used to be shared across tiers, which
    // made it the one place a nightly bulk run could still crowd out the payout tick.
    it("retries an arena tick even when a bulk run has spent its own retry allowance", { timeout: 5000 }, async () => {
        const clock = new FakeClock(1_000);
        const attemptsByUri = new Map<string, number>();
        // 408 is the one failure that is retryable without being the backend's fault, so the breaker
        // stays closed and the retry budget is the only thing deciding whether a request is sent
        // again. A 502 flood would collapse the limit and open the circuit, and the tick would then
        // be shed for an unavailable backend rather than for want of budget.
        const forwarder: Forwarder = async (_url, req) => {
            attemptsByUri.set(req.uri, (attemptsByUri.get(req.uri) ?? 0) + 1);
            return { status: 408, headers: {}, body: Buffer.from(JSON.stringify({ message: "Request Timeout" })) };
        };

        const dispatcher = new Dispatcher({
            backends: ["sim://a"],
            ...CREDENTIALS,
            forwarder,
            clock,
            retryDelayMs: 1,
            startLimit: 30,
        });
        after(() => dispatcher.stop());

        // A nightly cycle failing throughout. The tick has to land while this is still running,
        // which is what production does: the cycle runs for hours and the tick fires every minute.
        // Waiting for the flood to finish would prove nothing, because a shared allowance recovers
        // its ceiling as soon as the pressure stops.
        const bulk = Array.from({ length: 400 }, (_, i) =>
            dispatcher.submit(requestAt(clock, PRIORITY.BULK, DEADLINE_MS[PRIORITY.BULK], `/bulk-${i}`)),
        );
        clock.advance(100);
        await clock.flush();
        assert.ok(dispatcher.status().retryBudget.denied[PRIORITY.BULK] > 0, "the bulk run should be over its own allowance by now");

        // The tick's requests for this minute, arriving mid-cycle. Kept to a number whose full
        // retry allowance (requests times RETRY.ATTEMPTS) fits inside the tier's own floor, since
        // the point here is that bulk cannot take the tick's share, not that the share is unbounded.
        const tickUris = Array.from({ length: 4 }, (_, i) => `/arena-${i}`);
        const tick = tickUris.map((uri) => dispatcher.submit(requestAt(clock, PRIORITY.ARENA_TICK, DEADLINE_MS[PRIORITY.ARENA_TICK], uri)));

        const responses = await settle(clock, Promise.all(tick));
        await settle(clock, Promise.all(bulk));

        const status = dispatcher.status();
        assert.strictEqual(
            status.retryBudget.denied[PRIORITY.ARENA_TICK],
            0,
            "the tick must never be refused a retry, however much bulk is failing beside it",
        );
        for (const [i, response] of responses.entries()) {
            assert.strictEqual(response.status, 408, `tick request ${i} should get the real upstream failure back`);
            assert.strictEqual(
                attemptsByUri.get(tickUris[i]),
                RETRY.ATTEMPTS + 1,
                `tick request ${i} should have used its full retry allowance`,
            );
        }
        assert.ok(status.retryBudget.denied[PRIORITY.BULK] > 0, "while bulk stayed capped by its own allowance");
    });
});

describe("swapiServe.Dispatcher health adaptation", () => {
    it("collapses the limit after a burst of 429s", async () => {
        const clock = new FakeClock();
        const throttling: Forwarder = async () => ({
            status: 429,
            headers: {},
            body: Buffer.from(JSON.stringify({ message: "Too Many Requests" })),
        });
        const dispatcher = new Dispatcher({ backends: ["sim://a"], ...CREDENTIALS, forwarder: throttling, clock, retryDelayMs: 0 });
        after(() => dispatcher.stop());

        const startingLimit = dispatcher.status().backends[0].limit;
        // Deadlines inside the probe interval, so the tail of the burst is shed once the breaker
        // opens rather than waiting the outage out. This test is about the limit, not the queue.
        await settle(
            clock,
            Promise.all(Array.from({ length: 8 }, () => dispatcher.submit(requestAt(clock, PRIORITY.BULK, 5_000)))),
        );

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

/**
 * A shed request and a genuine upstream 503 are the same status code, and a client cannot act on
 * "503" alone. Only one shed reason means the queue is not there to be used: shutting_down, where
 * falling back to calling comlink directly is right. Every other reason is the governor doing its
 * job, and bypassing it would defeat the point.
 */
describe("swapiServe.Dispatcher shed reasons", () => {
    it("labels an expired request with the reason it was shed for", async () => {
        const dispatcher = new Dispatcher({ backends: ["sim://a"], ...CREDENTIALS, forwarder: okForwarder });
        after(() => dispatcher.stop());

        const response = await dispatcher.submit({ ...request(PRIORITY.PUBLIC_COMMAND), deadline: Date.now() - 1 });

        assert.strictEqual(response.status, 503);
        assert.strictEqual(response.headers[SHED_REASON_HEADER], "deadline");
    });

    it("labels an overflowing queue distinctly, since that is not a reason to bypass the queue", async () => {
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

        const shed = settled.filter((response) => response.status === 503);
        assert.ok(shed.length > 0, "at least one request should have been shed");
        for (const response of shed) {
            assert.strictEqual(response.headers[SHED_REASON_HEADER], "queue_overflow");
        }
    });

    it("labels shutdown, which is the one reason a client should fall back on", async () => {
        const dispatcher = new Dispatcher({ backends: ["sim://a"], ...CREDENTIALS, forwarder: okForwarder });
        dispatcher.stop();

        const response = await dispatcher.submit(request(PRIORITY.PUBLIC_COMMAND));

        assert.strictEqual(response.status, 503);
        assert.strictEqual(response.headers[SHED_REASON_HEADER], SHED_SHUTTING_DOWN);
    });

    it("does not label a real upstream response, which is not ours to annotate", async () => {
        const comlink = await startFakeComlink(() => ({ status: 503, body: JSON.stringify({ message: "comlink is down" }) }));
        const dispatcher = new Dispatcher({ backends: [comlink.url], ...CREDENTIALS, retryDelayMs: 0 });
        after(async () => {
            dispatcher.stop();
            await comlink.close();
        });

        const response = await dispatcher.submit(request(PRIORITY.PUBLIC_COMMAND));

        assert.strictEqual(response.status, 503, "the upstream status should pass through untouched");
        assert.strictEqual(response.headers[SHED_REASON_HEADER], undefined, "an upstream 503 is not a shed");
    });
});

describe("swapiServe.Dispatcher deadlines under saturation", () => {
    // A backend that hangs rather than fails never trips the breaker, so the dead-pool shed never
    // runs: it holds every slot for the full upstream timeout while the queue behind it goes stale.
    // Expiry rides along with a dispatch, and there is no dispatch to ride, so without a deadline
    // wakeup the caller waits out the hang instead of its own deadline.
    it("answers an expired request at its deadline while a hung backend holds every slot", { timeout: 5000 }, async () => {
        const clock = new FakeClock(1_000);
        // Never resolves, which is what a wedged comlink looks like from here.
        const hungForwarder: Forwarder = () => new Promise(() => {});

        const dispatcher = new Dispatcher({ backends: ["sim://a"], ...CREDENTIALS, forwarder: hungForwarder, clock, startLimit: 1 });
        after(() => dispatcher.stop());

        // Takes the only slot and never gives it back.
        void dispatcher.submit(requestAt(clock, PRIORITY.BULK, DEADLINE_MS[PRIORITY.BULK]));
        await clock.flush();

        const waiting = dispatcher.submit(requestAt(clock, PRIORITY.PUBLIC_COMMAND, DEADLINE_MS[PRIORITY.PUBLIC_COMMAND]));
        const response = await settle(clock, waiting);

        assert.strictEqual(response.status, 503);
        assert.strictEqual(dispatcher.status().terminal.deadline, 1, "the caller should be answered for its own deadline");
    });

    // The wakeup is a single timer, so an armed one must not outlast a deadline that lands sooner:
    // a rate-blocked queue at the collapsed floor waits two seconds per token, which is long enough
    // to bury several interactive deadlines behind it.
    it("brings a wakeup forward when a nearer deadline arrives", { timeout: 5000 }, async () => {
        const clock = new FakeClock(1_000);
        const dispatcher = new Dispatcher({
            backends: ["sim://a"],
            ...CREDENTIALS,
            forwarder: okForwarder,
            clock,
            ratePerSecond: 0.5,
            startLimit: 10,
        });
        after(() => dispatcher.stop());

        // Spend the burst so the queue is rate-blocked, arming a wakeup two seconds out.
        const paced = Array.from({ length: 4 }, () => dispatcher.submit(requestAt(clock, PRIORITY.BULK, DEADLINE_MS[PRIORITY.BULK])));
        await clock.flush();
        assert.ok(dispatcher.status().blocked.token > 0, "the rate should be the binding constraint");

        const shortDeadlineMs = 200;
        const impatient = dispatcher.submit(requestAt(clock, PRIORITY.PUBLIC_COMMAND, shortDeadlineMs));

        let answered = false;
        void impatient.then(() => {
            answered = true;
        });

        clock.advance(shortDeadlineMs + 1);
        await clock.flush();

        assert.ok(answered, "the nearer deadline should have been served by the wakeup, not left to the token wait");
        assert.strictEqual((await impatient).status, 503);

        dispatcher.stop();
        await Promise.all(paced);
    });
});

/**
 * Drives a failing backend until its breaker opens, and stops there.
 *
 * Deliberately not a fixed number of submits: once the breaker is open, a request carrying a
 * deadline past the probe interval keeps its place instead of being shed, so an overshooting loop
 * would wait out that deadline rather than stopping when the breaker trips.
 */
async function openBreaker(dispatcher: Dispatcher, clock: FakeClock): Promise<void> {
    for (let i = 0; i < 30 && dispatcher.status().backends[0].state !== "open"; i++) {
        await settle(clock, dispatcher.submit(requestAt(clock, PRIORITY.BULK, 5_000)));
    }
    assert.strictEqual(dispatcher.status().backends[0].state, "open", "the breaker should be open by now");
}

describe("swapiServe.Dispatcher dead pool", () => {
    const deadForwarder: Forwarder = async () => ({ status: undefined, headers: {}, body: Buffer.alloc(0) });

    // Without a mass shed, a backlog behind a dead backend drains at the circuit-probe rate: one
    // request every 15 seconds, each failing anyway. A hundred callers would take 25 minutes to
    // learn what was knowable in the first second, well past a Discord interaction token's life.
    // Everything doomed goes at once instead, in a single pass, however deep the backlog is.
    it("fails the whole doomed queue at once rather than one request per probe", async () => {
        const clock = new FakeClock();
        const dispatcher = new Dispatcher({ backends: ["sim://a"], ...CREDENTIALS, forwarder: deadForwarder, clock, retryDelayMs: 0 });
        after(() => dispatcher.stop());

        await openBreaker(dispatcher, clock);

        const startedAt = clock.now();
        // Deadlines inside the probe interval, so no probe can land in time to serve any of them.
        const responses = await Promise.all(
            Array.from({ length: 50 }, () => dispatcher.submit(requestAt(clock, PRIORITY.PUBLIC_COMMAND, 5_000))),
        );

        assert.strictEqual(responses.length, 50);
        assert.ok(
            responses.every((response) => response.status === 503),
            "every request should be told the backend is unavailable",
        );
        // The sharp version of "fails fast": the whole backlog is answered without a single probe
        // interval passing, which a one-request-per-probe drain could never do.
        assert.strictEqual(clock.now(), startedAt, "the backlog should be shed in one pass, with no time passing");
        assert.ok(dispatcher.status().terminal.backend_unavailable > 0, "and the reason should be recorded distinctly");
    });

    // Fast-fail is right for a caller that is watching a clock, and wrong for one that is not.
    // Bulk work carries a ten-minute deadline against a fifteen-second probe, so waiting out an
    // outage is exactly what it wants; shedding it turned a blip into a failed nightly cycle.
    it("keeps work that can outlast the outage and sheds only what cannot", async () => {
        const clock = new FakeClock();
        const dispatcher = new Dispatcher({ backends: ["sim://a"], ...CREDENTIALS, forwarder: deadForwarder, clock, retryDelayMs: 0 });
        after(() => dispatcher.stop());

        await openBreaker(dispatcher, clock);

        // Deadline shorter than the 15s probe interval: this one cannot live to see a recovery.
        const doomed = dispatcher.submit(requestAt(clock, PRIORITY.PUBLIC_COMMAND, 5_000));
        // Deadline well past it: several probes will land before this expires.
        let patientSettled = false;
        const patient = dispatcher.submit(requestAt(clock, PRIORITY.BULK, 600_000)).then((response) => {
            patientSettled = true;
            return response;
        });

        assert.strictEqual((await doomed).status, 503, "a caller that cannot outlive the outage is told immediately");

        await clock.flush();
        assert.strictEqual(patientSettled, false, "a caller that can outlive the outage keeps its place");
        assert.strictEqual(dispatcher.status().queue.depths[PRIORITY.BULK], 1, "and stays queued rather than being dropped");

        // Settle it deliberately rather than leaving the test to wait out a ten-minute deadline.
        dispatcher.stop();
        assert.strictEqual((await patient).status, 503, "and is answered on shutdown rather than left hanging");
    });

    it("serves the request that waited, once a probe succeeds", async () => {
        const clock = new FakeClock();
        let healthy = false;
        const forwarder: Forwarder = async () =>
            healthy
                ? { status: 200, headers: {}, body: Buffer.from(JSON.stringify({ ok: true })) }
                : { status: undefined, headers: {}, body: Buffer.alloc(0) };
        const dispatcher = new Dispatcher({ backends: ["sim://a"], ...CREDENTIALS, forwarder, clock, retryDelayMs: 0 });
        after(() => dispatcher.stop());

        await openBreaker(dispatcher, clock);

        healthy = true;
        // Queued while the pool is still dead, and with the headroom to outlast it: recovery needs
        // nothing to arrive at the right moment, since this request becomes the probe itself.
        const response = await settle(clock, dispatcher.submit(requestAt(clock, PRIORITY.PUBLIC_COMMAND, 120_000)));

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

describe("swapiServe.Dispatcher forwarder defects", () => {
    // A slot is taken before the forward and handed back by reporting the outcome. If the forward
    // throws instead of returning one, the slot is never handed back, and nothing in the design
    // ever recovers it: with MIN_LIMIT at 1, a handful of these wedge the backend until a restart.
    it("releases the backend slot when the forwarder throws", { timeout: 5000 }, async () => {
        let shouldThrow = true;
        const forwarder: Forwarder = async () => {
            if (shouldThrow) throw new Error("forwarder defect");
            return { status: 200, headers: {}, body: Buffer.from("{}") };
        };

        const dispatcher = new Dispatcher({ backends: ["sim://a"], ...CREDENTIALS, forwarder, startLimit: 2 });
        after(() => dispatcher.stop());

        for (let i = 0; i < 4; i++) {
            const response = await dispatcher.submit(request(PRIORITY.PUBLIC_COMMAND));
            assert.strictEqual(response.status, 503, "the caller must be answered rather than left hanging");
        }

        assert.strictEqual(dispatcher.status().backends[0].inFlight, 0, "every slot should have been handed back");

        // The real proof: the backend still works afterwards.
        shouldThrow = false;
        const recovered = await dispatcher.submit(request(PRIORITY.PUBLIC_COMMAND));
        assert.strictEqual(recovered.status, 200, "the backend should still be usable");
    });

    // The forwarder throwing is our defect, not the backend misbehaving. Halving its limit would
    // punish a healthy backend for a bug on this side.
    it("does not blame the backend's health for a local defect", { timeout: 5000 }, async () => {
        const forwarder: Forwarder = async () => {
            throw new Error("forwarder defect");
        };

        const dispatcher = new Dispatcher({ backends: ["sim://a"], ...CREDENTIALS, forwarder, startLimit: 8 });
        after(() => dispatcher.stop());

        for (let i = 0; i < 3; i++) await dispatcher.submit(request(PRIORITY.PUBLIC_COMMAND));

        const backend = dispatcher.status().backends[0];
        assert.strictEqual(backend.limit, 8, "a local defect must not shrink the learned limit");
        assert.strictEqual(backend.state, "closed", "nor open the circuit");
    });
});

describe("swapiServe.Dispatcher cancellation", () => {
    // Cancellation exists to stop spending upstream budget on a response nobody can receive, so
    // retrying a cancelled request spends it on precisely the request we just gave up on.
    it("does not retry a request whose caller has gone away", { timeout: 5000 }, async () => {
        let attempts = 0;
        const forwarder: Forwarder = async () => {
            attempts++;
            return { status: 500, headers: {}, body: Buffer.from(JSON.stringify({ message: "boom" })) };
        };

        const dispatcher = new Dispatcher({ backends: ["sim://a"], ...CREDENTIALS, forwarder, retryDelayMs: 80 });
        after(() => dispatcher.stop());

        const abandoned = new AbortController();
        const response = dispatcher.submit(request(PRIORITY.PUBLIC_COMMAND), abandoned.signal);

        // Abort while the first attempt's retry is waiting out its backoff.
        await new Promise((resolve) => setTimeout(resolve, 20));
        abandoned.abort();
        assert.strictEqual((await response).status, 503, "the caller should be answered immediately on abort");

        await new Promise((resolve) => setTimeout(resolve, 300));
        assert.strictEqual(attempts, 1, `a cancelled request must not be sent again, was sent ${attempts} times`);
    });
});

describe("swapiServe.Dispatcher shutdown", () => {
    // A queued request is a caller holding an unresolved promise, and for the HTTP layer that is a
    // response that never ends and a socket that never closes. Leaving them behind means
    // server.close() waits forever and the process only dies to SIGKILL.
    it("settles everything still queued when it stops", { timeout: 5000 }, async () => {
        let release: (() => void) | null = null;
        const gate = new Promise<void>((resolve) => {
            release = resolve;
        });

        let first = true;
        const forwarder: Forwarder = async () => {
            if (first) {
                first = false;
                await gate;
            }
            return { status: 200, headers: {}, body: Buffer.alloc(0) };
        };

        const dispatcher = new Dispatcher({ backends: ["sim://a"], ...CREDENTIALS, forwarder, startLimit: 1 });

        // The first request occupies the only slot, so the rest are still queued when we stop.
        const occupying = dispatcher.submit(request(PRIORITY.BULK, "/occupying"));
        await new Promise((resolve) => setImmediate(resolve));
        const queued = Array.from({ length: 5 }, (_, i) => dispatcher.submit(request(PRIORITY.BULK, `/queued-${i}`)));
        await new Promise((resolve) => setImmediate(resolve));

        assert.strictEqual(dispatcher.status().queue.depths[PRIORITY.BULK], 5, "requests should be queued before stopping");

        dispatcher.stop();

        const responses = await Promise.all(queued);
        for (const response of responses) {
            assert.strictEqual(response.status, 503, "a queued request must be answered, not abandoned");
        }
        assert.strictEqual(dispatcher.status().terminal.shutting_down, 5);

        release?.();
        await occupying;
    });

    it("answers a request submitted after it has stopped", { timeout: 5000 }, async () => {
        const dispatcher = new Dispatcher({ backends: ["sim://a"], ...CREDENTIALS, forwarder: okForwarder });
        dispatcher.stop();

        const response = await dispatcher.submit(request(PRIORITY.PUBLIC_COMMAND));
        assert.strictEqual(response.status, 503);
    });

    // A request waiting out a backoff is held by a timer, not by the queue, so draining the queue
    // cannot reach it. Upstream sets the wait via Retry-After, so it is not ours to bound.
    it("settles a request waiting out a retry backoff", { timeout: 5000 }, async () => {
        const forwarder: Forwarder = async () => ({
            status: 429,
            headers: { "retry-after": "30" },
            body: Buffer.from(JSON.stringify({ message: "slow down" })),
        });

        const dispatcher = new Dispatcher({ backends: ["sim://a"], ...CREDENTIALS, forwarder });

        const inBackoff = dispatcher.submit(request(PRIORITY.PUBLIC_COMMAND));
        await new Promise((resolve) => setImmediate(resolve));
        assert.ok(dispatcher.status().retries > 0, "the request should be waiting on a retry");

        dispatcher.stop();

        const response = await inBackoff;
        assert.strictEqual(response.status, 503, "shutdown must not wait out an upstream Retry-After");
    });

    // A request already at the backend when we stop is left to finish, but its failure must not
    // start a new backoff: the retry timers are drained once, so one scheduled after that drain
    // holds its caller until the timer fires, and shutdown waits on a socket for a request the
    // service has no intention of sending.
    it("does not schedule a retry for a request that fails after it has stopped", { timeout: 5000 }, async () => {
        const clock = new FakeClock(1_000);
        let attempts = 0;
        let release: (() => void) | null = null;
        const gate = new Promise<void>((resolve) => {
            release = resolve;
        });
        const forwarder: Forwarder = async () => {
            attempts++;
            await gate;
            return { status: 502, headers: {}, body: Buffer.from(JSON.stringify({ message: "Bad Gateway" })) };
        };

        const dispatcher = new Dispatcher({ backends: ["sim://a"], ...CREDENTIALS, forwarder, clock });

        const inFlight = dispatcher.submit(requestAt(clock, PRIORITY.PUBLIC_COMMAND, DEADLINE_MS[PRIORITY.PUBLIC_COMMAND]));
        await clock.flush();
        assert.strictEqual(attempts, 1, "the request should be at the backend before we stop");

        dispatcher.stop();
        release?.();

        let answered = false;
        void inFlight.then(() => {
            answered = true;
        });
        // Deliberately without advancing the clock: a scheduled backoff would leave this unanswered.
        for (let i = 0; i < 5; i++) await clock.flush();

        assert.ok(answered, "the caller should be answered as soon as its request comes back");
        assert.strictEqual(clock.pendingTimers(), 0, "no retry timer should be left holding shutdown open");
        assert.strictEqual(attempts, 1, `a stopped service must not send the request again, was sent ${attempts} times`);
    });
});
