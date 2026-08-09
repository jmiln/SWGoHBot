import assert from "node:assert";
import { after, describe, it } from "node:test";
import { parsePriorityPath, startSwapiServe } from "../../services/swapiServe/index.ts";
import { startFakeComlink } from "../helpers/fakeComlink.ts";

const CREDS = { accessKey: "a", secretKey: "s", ratePerSecond: 1000 };

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
});
