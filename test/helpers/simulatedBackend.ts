import type { Forwarder } from "../../services/swapiServe/forwarder.ts";
import type { FakeClock } from "./fakeClock.ts";

export interface BackendProfile {
    /** Requests per second the backend tolerates before it starts returning 429. */
    throttleAboveRps: number;
    /** Simulated service time, applied on the fake clock rather than really waited on. */
    latencyMs: number;
    /** Return a 500 every N requests. 0 or omitted disables. */
    failEvery?: number;
}

export interface SimStats {
    total: number;
    throttled: number;
    serverErrors: number;
    /** Peak requests in flight at once. */
    peakConcurrent: number;
}

/**
 * A comlink stand-in with no sockets and no real time.
 *
 * It counts requests per virtual second and starts refusing once the profile's tolerance is
 * exceeded, which is what gives the AIMD controller something real to converge against. Latency
 * is scheduled on the fake clock, so a request genuinely holds its concurrency slot until virtual
 * time advances past it, rather than completing instantly and hiding contention.
 */
export function createSimulatedBackend(profile: BackendProfile, clock: FakeClock): { forwarder: Forwarder; stats: () => SimStats } {
    const stats: SimStats = { total: 0, throttled: 0, serverErrors: 0, peakConcurrent: 0 };
    let windowStart = 0;
    let windowCount = 0;
    let inFlight = 0;

    const forwarder: Forwarder = (_backendUrl, _request) => {
        const now = clock.now();
        if (now - windowStart >= 1000) {
            windowStart = now;
            windowCount = 0;
        }
        windowCount++;
        stats.total++;

        inFlight++;
        if (inFlight > stats.peakConcurrent) stats.peakConcurrent = inFlight;

        let status = 200;
        let message = "";
        if (profile.failEvery && stats.total % profile.failEvery === 0) {
            status = 500;
            message = "boom";
            stats.serverErrors++;
        } else if (windowCount > profile.throttleAboveRps) {
            status = 429;
            message = "Too Many Requests";
            stats.throttled++;
        }

        return new Promise((resolve) => {
            clock.setTimeout(() => {
                inFlight--;
                resolve({
                    status,
                    headers: {},
                    body: Buffer.from(JSON.stringify(message ? { message } : { ok: true })),
                });
            }, profile.latencyMs);
        });
    };

    return { forwarder, stats: () => ({ ...stats }) };
}
