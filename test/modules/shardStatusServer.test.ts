import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import { ShardRegistry, STARTUP_DEADLINE_MS } from "../../modules/shardStatus/registry.ts";
import { startShardStatusServer } from "../../modules/shardStatus/server.ts";
import { FakeClock } from "../helpers/fakeClock.ts";

const closers: Array<() => Promise<void>> = [];

after(async () => {
    for (const close of closers) await close();
});

async function serve(registry: ShardRegistry): Promise<string> {
    const server = await startShardStatusServer(registry, { port: 0, host: "127.0.0.1" });
    closers.push(server.close);
    return server.url;
}

function readyRegistry(): ShardRegistry {
    const registry = new ShardRegistry(new FakeClock(0));
    registry.recordHeartbeat({
        shardId: 0,
        status: "ready",
        pingMs: 42,
        guilds: 1103,
        uptimeMs: 930000,
        memoryRssMb: 412,
    });
    return registry;
}

function pastStartupRegistry(): ShardRegistry {
    const clock = new FakeClock(0);
    const registry = new ShardRegistry(clock);
    registry.registerShard(0);
    clock.advance(STARTUP_DEADLINE_MS + 1);
    return registry;
}

describe("shard status server", () => {
    it("returns 200 from /health while the fleet is starting", async () => {
        const url = await serve(new ShardRegistry(new FakeClock(0)));

        const res = await fetch(`${url}/health`);

        assert.equal(res.status, 200);
        assert.equal((await res.json()).state, "starting");
    });

    it("returns 503 from /health once startup has passed its deadline", async () => {
        const url = await serve(pastStartupRegistry());

        const res = await fetch(`${url}/health`);

        assert.equal(res.status, 503);
        assert.equal((await res.json()).ok, false);
    });

    it("returns 200 from /health once a shard has heartbeated", async () => {
        const url = await serve(readyRegistry());

        const res = await fetch(`${url}/health`);
        const body = await res.json();

        assert.equal(res.status, 200);
        assert.equal(body.ok, true);
        assert.equal(body.shardsUp, 1);
        assert.equal(body.shardsTotal, 1);
    });

    it("serves per-shard detail from /status", async () => {
        const url = await serve(readyRegistry());

        const res = await fetch(`${url}/status`);
        const body = await res.json();

        assert.equal(res.status, 200);
        assert.equal(body.shards.length, 1);
        assert.equal(body.shards[0].shardId, 0);
        assert.equal(body.shards[0].guilds, 1103);
        assert.equal(body.shards[0].ipcStale, false);
    });

    it("keeps /status at 200 even when the fleet is down", async () => {
        const url = await serve(pastStartupRegistry());

        const res = await fetch(`${url}/status`);

        // A 503 here would fail every per-shard Uptime Kuma monitor at once and destroy the
        // per-shard resolution the endpoint exists to provide.
        assert.equal(res.status, 200);
        assert.equal((await res.json()).state, "down");
    });

    it("returns 404 for unknown paths", async () => {
        const url = await serve(readyRegistry());

        const res = await fetch(`${url}/nope`);

        assert.equal(res.status, 404);
    });
});
