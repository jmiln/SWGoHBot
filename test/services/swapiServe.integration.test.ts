import assert from "node:assert";
import { connect } from "node:net";
import { after, describe, it } from "node:test";
import { GOVERNOR, PRIORITY, SHED_REASON_HEADER, SHED_SHUTTING_DOWN } from "../../data/constants/swapiServe.ts";
import logger from "../../modules/Logger.ts";
import { parsePriorityPath, resolveDeadlineMs, startSwapiServe } from "../../services/swapiServe/index.ts";

// The interval arenaTick runs on, mirrored from events/clientReady.ts where it is a local const.
const ARENA_TICK_INTERVAL_MS = 60_000;
import { startFakeComlink } from "../helpers/fakeComlink.ts";

/**
 * Sends a request that promises more body than it delivers, then destroys the socket, which is
 * what a shard dying mid-request looks like from the service's side.
 */
function sendTruncatedRequest(url: string): Promise<void> {
    const { hostname, port } = new URL(url);
    return new Promise((resolve, reject) => {
        const socket = connect({ host: hostname, port: Number(port) }, () => {
            socket.write("POST /p2/player HTTP/1.1\r\nHost: localhost\r\nContent-Length: 200\r\n\r\n");
            socket.write('{"payload":');
            setTimeout(() => {
                socket.destroy();
                resolve();
            }, 20);
        });
        socket.on("error", reject);
    });
}

const CREDS = { accessKey: "a", secretKey: "s", ratePerSecond: 1000 };
const SERVICE_UNAVAILABLE = 503;

describe("swapiServe.parsePriorityPath", () => {
    it("reads the priority from the path prefix and strips it", () => {
        assert.deepStrictEqual(parsePriorityPath("/p0/player"), { priority: 0, uri: "/player" });
        assert.deepStrictEqual(parsePriorityPath("/p4/guild"), { priority: 4, uri: "/guild" });
    });

    it("rejects a path with no priority prefix", () => {
        assert.strictEqual(parsePriorityPath("/player"), null);
    });

    it("rejects a priority outside the defined tiers", () => {
        assert.strictEqual(parsePriorityPath("/p5/player"), null);
        assert.strictEqual(parsePriorityPath("/p9/player"), null);
    });

    it("rejects a prefix with no path after it", () => {
        assert.strictEqual(parsePriorityPath("/p0"), null);
        assert.strictEqual(parsePriorityPath("/p0/"), null);
    });
});

describe("swapiServe.resolveDeadlineMs", () => {
    // The whole reason arenaTick outranks everything: a tick still waiting when the next one fires
    // is dropped by the arenaTickRunning guard, and the payout cycle and poll interval being exact
    // multiples means the same minute is lost every day after that.
    it("expires arena tick work inside the minute it has to land in", () => {
        assert.ok(
            resolveDeadlineMs(PRIORITY.ARENA_TICK, undefined) < ARENA_TICK_INTERVAL_MS,
            "an arena request must not outlive the tick that issued it",
        );
    });

    it("gives each tier a deadline matching what being late costs it", () => {
        const arena = resolveDeadlineMs(PRIORITY.ARENA_TICK, undefined);
        const command = resolveDeadlineMs(PRIORITY.PUBLIC_COMMAND, undefined);
        const bulk = resolveDeadlineMs(PRIORITY.BULK, undefined);

        // A user command gives up soonest of all, ahead of even the tick. Priority orders who is
        // served first; the deadline orders who is worth still serving, and a human watching a
        // spinner runs out of patience long before an automated tick with a minute to fill does.
        assert.ok(command < arena, "a user command gives up before a tick nobody is watching");
        assert.ok(arena < bulk, "bulk work nobody is watching can wait longest");
    });

    // Dispatcher.shedDoomed sheds whatever expires within one probe interval, since no probe can
    // land in time to serve it. Holding the user-facing tiers at or below that interval is what
    // makes a dead pool fail them on the first pump instead of walking them through failed probe
    // after failed probe until their deadline runs out.
    it("fails user-facing work at once when the pool is down, rather than waiting out probes", () => {
        for (const tier of [PRIORITY.SUPPORTER_COMMAND, PRIORITY.PUBLIC_COMMAND] as const) {
            assert.ok(
                resolveDeadlineMs(tier, undefined) <= GOVERNOR.CIRCUIT_PROBE_INTERVAL_MS,
                `tier ${tier} must not outlive a probe interval, or an outage leaves its user waiting`,
            );
        }
    });

    it("prefers a caller's own deadline over the tier default", () => {
        assert.strictEqual(resolveDeadlineMs(PRIORITY.BULK, "5000"), 5000);
    });

    it("falls back to the tier default for a missing or nonsense header", () => {
        const bulk = resolveDeadlineMs(PRIORITY.BULK, undefined);
        assert.strictEqual(resolveDeadlineMs(PRIORITY.BULK, "soon"), bulk);
        assert.strictEqual(resolveDeadlineMs(PRIORITY.BULK, "-1"), bulk);
        assert.strictEqual(resolveDeadlineMs(PRIORITY.BULK, "0"), bulk);
    });
});

describe("swapiServe end to end", () => {
    it("proxies a request through to the backend and returns its response", async () => {
        const comlink = await startFakeComlink(() => ({ status: 200, body: JSON.stringify({ player: "found" }) }));
        const service = await startSwapiServe({ port: 0, backends: [comlink.url], ...CREDS });
        after(async () => {
            await service.close();
            await comlink.close();
        });

        const response = await fetch(`${service.url}/p2/player`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ payload: { allyCode: "123456789" } }),
        });

        assert.strictEqual(response.status, 200);
        assert.deepStrictEqual(await response.json(), { player: "found" });
    });

    // The forwarder requests gzip, so whether the backend compresses is the backend's choice, not
    // ours. Every real client (got, with decompress on) will try to decode whatever encoding the
    // response claims, so a proxied response must never claim one it no longer carries.
    it("delivers a compressed upstream response intact", async () => {
        const payload = JSON.stringify({ player: "found", padding: "x".repeat(2000) });
        const comlink = await startFakeComlink(() => ({ status: 200, body: payload, gzip: true }));
        const service = await startSwapiServe({ port: 0, backends: [comlink.url], ...CREDS });
        after(async () => {
            await service.close();
            await comlink.close();
        });

        const response = await fetch(`${service.url}/p2/player`, { method: "POST", body: "{}" });

        assert.strictEqual(response.status, 200);
        assert.deepStrictEqual(await response.json(), JSON.parse(payload));
    });

    it("forwards the exact body bytes it received, so the re-signed md5 stays valid", async () => {
        const comlink = await startFakeComlink(() => ({ status: 200 }));
        const service = await startSwapiServe({ port: 0, backends: [comlink.url], ...CREDS });
        after(async () => {
            await service.close();
            await comlink.close();
        });

        const sentBody = JSON.stringify({ payload: { allyCode: "123456789" }, spacing: "  preserved  " });
        await fetch(`${service.url}/p2/player`, { method: "POST", headers: { "content-type": "application/json" }, body: sentBody });

        assert.strictEqual(comlink.lastBody(), sentBody, "body must pass through byte for byte");
    });

    it("strips the priority prefix before forwarding", async () => {
        let seenUri = "";
        const comlink = await startFakeComlink(({ uri }) => {
            seenUri = uri;
            return { status: 200 };
        });
        const service = await startSwapiServe({ port: 0, backends: [comlink.url], ...CREDS });
        after(async () => {
            await service.close();
            await comlink.close();
        });

        await fetch(`${service.url}/p1/guild`, { method: "POST", body: "{}" });

        assert.strictEqual(seenUri, "/guild");
    });

    // Every shard and both updaters depend on this one process, so a request that fails while
    // being read must not be able to take it down. Reading the body rejects when the client
    // vanishes mid-request, and an unhandled rejection in the request handler ends the process.
    it("survives a client that disconnects while its body is still being read", async () => {
        const comlink = await startFakeComlink(() => ({ status: 200, body: JSON.stringify({ ok: true }) }));
        const service = await startSwapiServe({ port: 0, backends: [comlink.url], ...CREDS });
        after(async () => {
            await service.close();
            await comlink.close();
        });

        await sendTruncatedRequest(service.url);
        await new Promise((resolve) => setTimeout(resolve, 50));

        const response = await fetch(`${service.url}/p2/player`, { method: "POST", body: "{}" });
        assert.strictEqual(response.status, 200, "the service should still be serving afterwards");
        assert.deepStrictEqual(await response.json(), { ok: true });
    });

    // pm2 restarts this service; if close() cannot finish, the restart only completes on SIGKILL.
    it("shuts down promptly with work still queued", { timeout: 5000 }, async () => {
        const comlink = await startFakeComlink(() => ({ status: 200, delayMs: 200 }));
        const service = await startSwapiServe({ port: 0, backends: [comlink.url], ...CREDS, startLimit: 1 });
        after(async () => await comlink.close());

        const inFlight = Array.from({ length: 6 }, (_, i) =>
            fetch(`${service.url}/p4/queued-${i}`, { method: "POST", body: "{}" }).catch(() => undefined),
        );
        await new Promise((resolve) => setTimeout(resolve, 30));

        const startedAt = Date.now();
        await service.close();
        const took = Date.now() - startedAt;
        await Promise.all(inFlight);

        // Should be bounded by the one request actually in flight (200ms), not by the keep-alive
        // idle timeout of the five clients whose requests were shed.
        assert.ok(took < 1000, `close() should not wait on idle keep-alive connections, took ${took}ms`);
    });

    // The reason a client needs to tell a shutdown shed from any other 503: with it, a pm2 restart
    // costs each client a fallback to direct comlink calls, and without it every queued call across
    // every shard and both updaters simply fails.
    it("labels the work it sheds on shutdown, so clients can fall back rather than fail", { timeout: 5000 }, async () => {
        const comlink = await startFakeComlink(() => ({ status: 200, delayMs: 200 }));
        const service = await startSwapiServe({ port: 0, backends: [comlink.url], ...CREDS, startLimit: 1 });
        after(async () => await comlink.close());

        const queued = Array.from({ length: 6 }, (_, i) =>
            fetch(`${service.url}/p4/queued-${i}`, { method: "POST", body: "{}" }).catch(() => undefined),
        );
        await new Promise((resolve) => setTimeout(resolve, 30));

        await service.close();
        const responses = await Promise.all(queued);

        const shed = responses.filter((response) => response?.status === SERVICE_UNAVAILABLE);
        assert.ok(shed.length > 0, "the queued work should have been shed, not abandoned");
        for (const response of shed) {
            assert.strictEqual(
                response?.headers.get(SHED_REASON_HEADER),
                SHED_SHUTTING_DOWN,
                "a shed on the way down has to be distinguishable from an upstream 503",
            );
        }
    });

    it("rejects a request with no priority prefix", async () => {
        const comlink = await startFakeComlink(() => ({ status: 200 }));
        const service = await startSwapiServe({ port: 0, backends: [comlink.url], ...CREDS });
        after(async () => {
            await service.close();
            await comlink.close();
        });

        const response = await fetch(`${service.url}/player`, { method: "POST", body: "{}" });

        assert.strictEqual(response.status, 400);
        assert.strictEqual(comlink.requestCount(), 0);
    });

    // Every tunable in this design is a starting guess, and none can be corrected from logs.
    // The status endpoint is the only way they get tuned, so its shape is asserted.
    it("reports the full metric set on the status endpoint", async () => {
        const comlink = await startFakeComlink(() => ({ status: 200 }));
        const service = await startSwapiServe({ port: 0, backends: [comlink.url], ...CREDS });
        after(async () => {
            await service.close();
            await comlink.close();
        });

        await fetch(`${service.url}/p2/player`, { method: "POST", body: "{}" });

        const response = await fetch(`${service.url}/status`);
        const status = (await response.json()) as {
            backends: { url: string; limit: number; ratePerSecond: number; state: string; drained: boolean; outcomes: Record<string, number> }[];
            queue: { depths: number[]; oldestAgeMs: number[]; meanWaitMs: number[]; maxWaitMs: number[] };
            blocked: Record<string, number>;
            terminal: Record<string, number>;
            dispatches: number;
            retries: number;
            retryBudget: { granted: number[]; denied: number[] };
            endpoints: Record<string, { count: number }>;
        };

        assert.strictEqual(response.status, 200);

        assert.strictEqual(status.backends.length, 1);
        assert.strictEqual(status.backends[0].url, comlink.url);
        assert.ok(status.backends[0].limit > 0, "should report the concurrency limit");
        assert.ok(status.backends[0].ratePerSecond > 0, "should report the token bucket rate");
        assert.strictEqual(status.backends[0].state, "closed");
        assert.strictEqual(status.backends[0].outcomes.ok, 1);

        for (const series of [status.queue.depths, status.queue.oldestAgeMs, status.queue.meanWaitMs, status.queue.maxWaitMs]) {
            assert.strictEqual(series.length, 5, "queue metrics are reported per priority tier");
        }
        assert.strictEqual(status.dispatches, 1);
        assert.strictEqual(status.terminal.completed, 1);
        assert.strictEqual(status.endpoints["/player"].count, 1);
        assert.ok("token" in status.blocked, "blocked reasons should be reported");
        for (const series of [status.retryBudget.granted, status.retryBudget.denied]) {
            // Per tier, because the allowance is per tier: a shared number could not show bulk
            // spending what the arena tick needed, which is the thing worth watching here.
            assert.strictEqual(series.length, 5, "retry budget is reported per priority tier");
        }
    });

    it("drains traffic to a healthy backend when another is failing", async () => {
        const sick = await startFakeComlink(() => ({ status: 500, body: JSON.stringify({ message: "boom" }) }));
        const healthy = await startFakeComlink(() => ({ status: 200, body: JSON.stringify({ ok: true }) }));
        const service = await startSwapiServe({ port: 0, backends: [sick.url, healthy.url], ...CREDS });
        after(async () => {
            await service.close();
            await sick.close();
            await healthy.close();
        });

        for (let i = 0; i < 30; i++) {
            await fetch(`${service.url}/p4/player`, { method: "POST", body: "{}" });
        }

        const healthyCount = healthy.requestCount();
        const sickCount = sick.requestCount();
        assert.ok(healthyCount > sickCount, `healthy backend should absorb more traffic (healthy ${healthyCount}, sick ${sickCount})`);
    });

    it("withdraws a queued request when the client disconnects", async () => {
        // One slot, slow responses: the first request occupies the backend while the rest queue.
        const comlink = await startFakeComlink(() => ({ status: 200, delayMs: 150 }));
        const service = await startSwapiServe({ port: 0, backends: [comlink.url], ...CREDS, startLimit: 1 });
        after(async () => {
            await service.close();
            await comlink.close();
        });

        const occupying = fetch(`${service.url}/p4/first`, { method: "POST", body: "{}" });
        await new Promise((resolve) => setTimeout(resolve, 20));

        const abandoned = new AbortController();
        const queued = fetch(`${service.url}/p4/abandoned`, { method: "POST", body: "{}", signal: abandoned.signal });
        await new Promise((resolve) => setTimeout(resolve, 20));
        abandoned.abort();
        await queued.catch(() => undefined);

        await occupying;
        await new Promise((resolve) => setTimeout(resolve, 100));

        assert.strictEqual(comlink.requestCount(), 1, "the abandoned request must never reach the backend");
    });
});

describe("swapiServe control API", () => {
    it("drains and re-enables a backend without a restart", async () => {
        const drained = await startFakeComlink(() => ({ status: 200 }));
        const other = await startFakeComlink(() => ({ status: 200 }));
        const service = await startSwapiServe({ port: 0, backends: [drained.url, other.url], ...CREDS });
        after(async () => {
            await service.close();
            await drained.close();
            await other.close();
        });

        const drainRes = await fetch(`${service.url}/backend/${encodeURIComponent(drained.url)}/drain`, { method: "POST" });
        assert.strictEqual(drainRes.status, 200);

        for (let i = 0; i < 6; i++) await fetch(`${service.url}/p4/player`, { method: "POST", body: "{}" });
        assert.strictEqual(drained.requestCount(), 0, "a drained backend must receive nothing");

        const enableRes = await fetch(`${service.url}/backend/${encodeURIComponent(drained.url)}/enable`, { method: "POST" });
        assert.strictEqual(enableRes.status, 200);

        const status = (await (await fetch(`${service.url}/status`)).json()) as { backends: { drained: boolean }[] };
        assert.strictEqual(status.backends[0].drained, false);
    });

    it("sets a backend limit and rejects a malformed body", async () => {
        const comlink = await startFakeComlink(() => ({ status: 200 }));
        const service = await startSwapiServe({ port: 0, backends: [comlink.url], ...CREDS });
        after(async () => {
            await service.close();
            await comlink.close();
        });

        const ok = await fetch(`${service.url}/backend/${encodeURIComponent(comlink.url)}/set-limit`, {
            method: "POST",
            body: JSON.stringify({ limit: 9 }),
        });
        assert.strictEqual(ok.status, 200);

        const status = (await (await fetch(`${service.url}/status`)).json()) as { backends: { limit: number }[] };
        assert.strictEqual(status.backends[0].limit, 9);

        const bad = await fetch(`${service.url}/backend/${encodeURIComponent(comlink.url)}/set-limit`, {
            method: "POST",
            body: JSON.stringify({ limit: "lots" }),
        });
        assert.strictEqual(bad.status, 400);
    });

    it("rejects an unknown backend", async () => {
        const comlink = await startFakeComlink(() => ({ status: 200 }));
        const service = await startSwapiServe({ port: 0, backends: [comlink.url], ...CREDS });
        after(async () => {
            await service.close();
            await comlink.close();
        });

        const response = await fetch(`${service.url}/backend/${encodeURIComponent("http://nope.test")}/drain`, { method: "POST" });
        assert.strictEqual(response.status, 400);
    });

    it("rejects control calls with no or wrong bearer when a control secret is set", async () => {
        const comlink = await startFakeComlink(() => ({ status: 200 }));
        const service = await startSwapiServe({ port: 0, backends: [comlink.url], ...CREDS, controlSecret: "s3cret" });
        after(async () => {
            await service.close();
            await comlink.close();
        });
        const target = encodeURIComponent(comlink.url);

        const noHeader = await fetch(`${service.url}/backend/${target}/drain`, { method: "POST" });
        assert.strictEqual(noHeader.status, 401);

        const wrong = await fetch(`${service.url}/backend/${target}/drain`, {
            method: "POST",
            headers: { authorization: "Bearer nope" },
        });
        assert.strictEqual(wrong.status, 401);

        const status = (await (await fetch(`${service.url}/status`)).json()) as { backends: { drained: boolean }[] };
        assert.strictEqual(status.backends[0].drained, false, "a rejected call must not have taken effect");
    });

    it("accepts control calls with the right bearer, and leaves /status open", async () => {
        const comlink = await startFakeComlink(() => ({ status: 200 }));
        const service = await startSwapiServe({ port: 0, backends: [comlink.url], ...CREDS, controlSecret: "s3cret" });
        after(async () => {
            await service.close();
            await comlink.close();
        });

        const ok = await fetch(`${service.url}/backend/${encodeURIComponent(comlink.url)}/drain`, {
            method: "POST",
            headers: { authorization: "Bearer s3cret" },
        });
        assert.strictEqual(ok.status, 200);

        // /status carries no secret and must stay reachable: it is the diagnostic that tells a
        // serving instance from a merely running one.
        const statusRes = await fetch(`${service.url}/status`);
        assert.strictEqual(statusRes.status, 200);
        const status = (await statusRes.json()) as { backends: { drained: boolean }[] };
        assert.strictEqual(status.backends[0].drained, true);
    });

    it("leaves the control routes open when no secret is configured", async () => {
        const comlink = await startFakeComlink(() => ({ status: 200 }));
        const service = await startSwapiServe({ port: 0, backends: [comlink.url], ...CREDS });
        after(async () => {
            await service.close();
            await comlink.close();
        });

        const res = await fetch(`${service.url}/backend/${encodeURIComponent(comlink.url)}/drain`, { method: "POST" });
        assert.strictEqual(res.status, 200, "unset secret must preserve today's behaviour");
    });

    it("warns at startup only when the control API is unauthenticated and not on loopback", async () => {
        const comlink = await startFakeComlink(() => ({ status: 200 }));
        const started: { close: () => Promise<void> }[] = [];
        const warnings: string[] = [];
        const originalWarn = logger.warn;
        logger.warn = (content: unknown) => {
            warnings.push(String(content));
        };
        // Registered before anything binds: a failed assertion below must not leave a listening
        // server behind, or the test runner hangs instead of reporting the failure.
        after(async () => {
            logger.warn = originalWarn;
            for (const service of started) await service.close();
            await comlink.close();
        });

        // 127.0.0.2 stands in for a non-loopback bind: a different address from the default, which
        // is what the warning keys on, without putting a port on the network.
        started.push(await startSwapiServe({ port: 0, backends: [comlink.url], ...CREDS, host: "127.0.0.2" }));
        assert.ok(
            warnings.some((line) => line.includes("SWAPI_SERVE_CONTROL_SECRET")),
            `expected a warning naming the env var, got: ${warnings.join(" | ")}`,
        );

        warnings.length = 0;
        started.push(
            await startSwapiServe({ port: 0, backends: [comlink.url], ...CREDS, host: "127.0.0.2", controlSecret: "s3cret" }),
        );
        assert.deepStrictEqual(warnings, [], "a secret set means no warning");

        warnings.length = 0;
        started.push(await startSwapiServe({ port: 0, backends: [comlink.url], ...CREDS }));
        assert.deepStrictEqual(warnings, [], "loopback with no secret is the status quo, not a warning");
    });
});

describe("swapiServe bind address", () => {
    // 127.0.0.2 rather than a real interface address: all of 127.0.0.0/8 is loopback, so this
    // proves the bind is honoured without ever putting a listening port on the network. Every
    // other test in this file covers the default, which stays loopback.
    it("binds the address it is given, and nothing else", async () => {
        const comlink = await startFakeComlink(() => ({ status: 200 }));
        const service = await startSwapiServe({ port: 0, backends: [comlink.url], ...CREDS, host: "127.0.0.2" });
        after(async () => {
            await service.close();
            await comlink.close();
        });

        assert.strictEqual((await fetch(`${service.url}/status`)).status, 200);

        // The default address must not answer too, or "bound to X" would not mean anything.
        const port = new URL(service.url).port;
        await assert.rejects(fetch(`http://127.0.0.1:${port}/status`), "a bind to 127.0.0.2 must not also answer on 127.0.0.1");
    });
});
