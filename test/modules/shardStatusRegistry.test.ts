import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
    GRACE_MS,
    IPC_STALE_MS,
    type ShardHeartbeat,
    ShardRegistry,
    STARTUP_DEADLINE_MS,
} from "../../modules/shardStatus/registry.ts";
import { FakeClock } from "../helpers/fakeClock.ts";

function heartbeat(shardId: number, overrides: Partial<ShardHeartbeat> = {}): ShardHeartbeat {
    return {
        shardId,
        status: "ready",
        pingMs: 42,
        guilds: 1103,
        uptimeMs: 930000,
        memoryRssMb: 412,
        ...overrides,
    };
}

describe("ShardRegistry", () => {
    it("reports a shard that has heartbeated as up and not stale", () => {
        const registry = new ShardRegistry(new FakeClock(0));

        registry.recordHeartbeat(heartbeat(0));

        const snap = registry.snapshot();
        assert.equal(snap.shardsTotal, 1);
        assert.equal(snap.shardsUp, 1);
        assert.equal(snap.shards[0].ipcStale, false);
        assert.equal(snap.shards[0].gatewayStale, false);
        assert.equal(snap.shards[0].guilds, 1103);
    });

    it("counts a registered shard that has never reported", () => {
        const registry = new ShardRegistry(new FakeClock(0));

        registry.registerShard(0);

        const snap = registry.snapshot();
        assert.equal(snap.shardsTotal, 1);
        assert.equal(snap.shards[0].status, "unknown");
        assert.equal(snap.shards[0].lastHeartbeatAt, null);
    });

    it("marks a shard ipcStale once heartbeats stop, with no death event", () => {
        const clock = new FakeClock(0);
        const registry = new ShardRegistry(clock);
        registry.recordHeartbeat(heartbeat(0));

        // The wedge case: process alive, no death event, heartbeats simply stop.
        clock.advance(IPC_STALE_MS + 1);

        const snap = registry.snapshot();
        assert.equal(snap.shards[0].ipcStale, true);
        assert.equal(snap.shardsUp, 0);
    });

    it("marks a shard gatewayStale when it reports a non-ready status", () => {
        const registry = new ShardRegistry(new FakeClock(0));

        registry.recordHeartbeat(heartbeat(0, { status: "reconnecting" }));

        const snap = registry.snapshot();
        assert.equal(snap.shards[0].ipcStale, false);
        assert.equal(snap.shards[0].gatewayStale, true);
    });

    it("reports starting before any shard readies", () => {
        const registry = new ShardRegistry(new FakeClock(0));
        registry.registerShard(0);

        assert.equal(registry.snapshot().state, "starting");
    });

    it("reports down when no shard readies before the startup deadline", () => {
        const clock = new FakeClock(0);
        const registry = new ShardRegistry(clock);
        registry.registerShard(0);

        clock.advance(STARTUP_DEADLINE_MS + 1);

        assert.equal(registry.snapshot().state, "down");
    });

    it("reports degraded when one shard of two is stale", () => {
        const clock = new FakeClock(0);
        const registry = new ShardRegistry(clock);
        registry.recordHeartbeat(heartbeat(0));
        registry.recordHeartbeat(heartbeat(1));

        clock.advance(IPC_STALE_MS + 1);
        registry.recordHeartbeat(heartbeat(0));

        const snap = registry.snapshot();
        assert.equal(snap.state, "degraded");
        assert.equal(snap.shardsUp, 1);
        assert.equal(snap.shardsTotal, 2);
    });

    it("reports degraded, not down, while all shards are stale inside the grace window", () => {
        const clock = new FakeClock(0);
        const registry = new ShardRegistry(clock);
        registry.recordHeartbeat(heartbeat(0));

        clock.advance(IPC_STALE_MS + 1);

        assert.equal(registry.snapshot().state, "degraded");
    });

    it("reports down once all shards have been stale beyond the grace window", () => {
        const clock = new FakeClock(0);
        const registry = new ShardRegistry(clock);
        registry.recordHeartbeat(heartbeat(0));

        clock.advance(IPC_STALE_MS + GRACE_MS + 1);

        assert.equal(registry.snapshot().state, "down");
    });

    it("reports degraded when every shard is live but reconnecting", () => {
        const registry = new ShardRegistry(new FakeClock(0));
        registry.recordHeartbeat(heartbeat(0));
        registry.recordHeartbeat(heartbeat(0, { status: "reconnecting" }));

        assert.equal(registry.snapshot().state, "degraded");
    });
});
