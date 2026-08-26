import type { Clock } from "../../services/swapiServe/clock.ts";

export const HEARTBEAT_INTERVAL_MS = 15_000;

/** Three missed beats. Long enough to ride out one slow tick, short enough to notice a wedge. */
export const IPC_STALE_MS = 3 * HEARTBEAT_INTERVAL_MS;

/** Past staleness, how long the whole fleet must stay silent before the verdict flips to down. */
export const GRACE_MS = 120_000;

/** Bounds the starting state, so a bot that never reaches the gateway does not read as healthy. */
export const STARTUP_DEADLINE_MS = 300_000;

export type ShardStatusName = "ready" | "connecting" | "reconnecting" | "idle" | "unknown";
export type FleetState = "starting" | "ready" | "degraded" | "down";

export interface ShardHeartbeat {
    shardId: number;
    status: ShardStatusName;
    pingMs: number | null;
    guilds: number;
    uptimeMs: number;
    memoryRssMb: number;
}

export interface ShardSnapshot extends ShardHeartbeat {
    lastHeartbeatAt: number | null;
    ipcStale: boolean;
    gatewayStale: boolean;
}

export interface FleetSnapshot {
    state: FleetState;
    shardsTotal: number;
    shardsUp: number;
    shards: ShardSnapshot[];
}

interface Entry {
    registeredAt: number;
    receivedAt: number | null;
    heartbeat: ShardHeartbeat | null;
}

/** Stand-in for a shard that has been spawned but has not reported yet. */
const UNREPORTED = {
    status: "unknown",
    pingMs: null,
    guilds: 0,
    uptimeMs: 0,
    memoryRssMb: 0,
} as const;

/**
 * In-memory view of the shard fleet, fed by the heartbeat each shard sends about itself.
 *
 * Heartbeats are the only source of state because they are level-sampled: a shard that dies, hangs,
 * or loses its gateway simply stops sending, and staleness catches all three. The manager's
 * lifecycle events are edge-triggered and would report the same things one beat sooner, so only
 * `registerShard` is taken from them, since nothing else can reveal a shard that never starts.
 */
export class ShardRegistry {
    private readonly clock: Clock;
    private readonly startedAt: number;
    private readonly entries = new Map<number, Entry>();
    private hasEverReadied = false;

    constructor(clock: Clock) {
        this.clock = clock;
        this.startedAt = clock.now();
    }

    registerShard(id: number): void {
        if (this.entries.has(id)) return;
        this.entries.set(id, { registeredAt: this.clock.now(), receivedAt: null, heartbeat: null });
    }

    recordHeartbeat(hb: ShardHeartbeat): void {
        this.registerShard(hb.shardId);
        const entry = this.entries.get(hb.shardId);
        if (!entry) throw new Error(`ShardRegistry: shard ${hb.shardId} missing immediately after registration`);

        entry.heartbeat = hb;
        entry.receivedAt = this.clock.now();
        if (hb.status === "ready") this.hasEverReadied = true;
    }

    snapshot(): FleetSnapshot {
        const now = this.clock.now();
        const shards: ShardSnapshot[] = [...this.entries.entries()]
            .sort(([a], [b]) => a - b)
            .map(([id, entry]) => ({
                ...(entry.heartbeat ?? UNREPORTED),
                shardId: id,
                lastHeartbeatAt: entry.receivedAt,
                // A shard that has registered but not yet reported is measured from registration, so
                // it gets the same staleness budget as one whose heartbeats stopped.
                ipcStale: now - (entry.receivedAt ?? entry.registeredAt) > IPC_STALE_MS,
                gatewayStale: (entry.heartbeat?.status ?? "unknown") !== "ready",
            }));

        return {
            state: this.deriveState(shards, now),
            shardsTotal: shards.length,
            shardsUp: shards.filter((shard) => !shard.ipcStale).length,
            shards,
        };
    }

    /**
     * Only total fleet loss returns `down`, because a container restart is the sole response to that
     * verdict and restarting to fix one sick shard would kill the healthy ones. Per-shard trouble
     * surfaces as `degraded`, which callers report without acting on.
     */
    private deriveState(shards: ShardSnapshot[], now: number): FleetState {
        if (!this.hasEverReadied) {
            return now - this.startedAt > STARTUP_DEADLINE_MS ? "down" : "starting";
        }

        const live = shards.filter((shard) => !shard.ipcStale);
        if (live.length === 0) {
            // Measured from the most recent beat any shard sent, so a fleet-wide reconnect is not
            // called down while it is still inside the grace window.
            const lastSeen = shards.reduce((latest, shard) => Math.max(latest, shard.lastHeartbeatAt ?? 0), 0);
            const silentFor = now - (lastSeen === 0 ? this.startedAt : lastSeen);
            return silentFor > IPC_STALE_MS + GRACE_MS ? "down" : "degraded";
        }

        if (live.length < shards.length) return "degraded";
        return live.every((shard) => !shard.gatewayStale) ? "ready" : "degraded";
    }
}
