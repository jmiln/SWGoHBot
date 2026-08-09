import ComlinkStub from "@swgoh-utils/comlink";
import { env } from "../config/config.ts";
import { FALLBACK_MAX_CONCURRENT, PRIORITY, PRIORITY_COUNT, type Priority, SERVICE_RECHECK_MS } from "../data/constants/swapiServe.ts";
import logger from "./Logger.ts";

// Connection-level failures mean swapiServe is not there. Anything else is a real answer from
// upstream and must be surfaced, not worked around.
const CONNECTION_ERROR_CODES = new Set(["ECONNREFUSED", "ECONNRESET", "EHOSTUNREACH", "ENOTFOUND", "ETIMEDOUT"]);

let serveUrl = env.SWAPI_SERVE_URL;
let directUrl = env.SWAPI_CLIENT_URL;
let tierStubs: ComlinkStub[] | null = null;
let directStub: ComlinkStub | null = null;
let serviceDownUntil = 0;
let directInFlight = 0;
const directWaiters: (() => void)[] = [];

function buildStubs(): { tiers: ComlinkStub[]; direct: ComlinkStub } {
    tierStubs = Array.from(
        { length: PRIORITY_COUNT },
        (_, priority) =>
            new ComlinkStub({
                url: `${serveUrl}/p${priority}`,
                accessKey: env.SWAPI_ACCESS_KEY,
                secretKey: env.SWAPI_SECRET_KEY,
            }),
    );
    directStub = new ComlinkStub({
        url: directUrl,
        accessKey: env.SWAPI_ACCESS_KEY,
        secretKey: env.SWAPI_SECRET_KEY,
    });
    return { tiers: tierStubs, direct: directStub };
}

function stubs(): { tiers: ComlinkStub[]; direct: ComlinkStub } {
    if (!tierStubs || !directStub) return buildStubs();
    return { tiers: tierStubs, direct: directStub };
}

function isConnectionFailure(err: unknown): boolean {
    if (typeof err !== "object" || err === null) return false;
    if ("code" in err && typeof err.code === "string" && CONNECTION_ERROR_CODES.has(err.code)) return true;
    // got wraps the cause for some transport failures
    if ("cause" in err) return isConnectionFailure(err.cause);
    return false;
}

/** Local semaphore used only on the fallback path, where nothing else is capping concurrency. */
async function acquireDirectSlot(): Promise<void> {
    if (directInFlight < FALLBACK_MAX_CONCURRENT) {
        directInFlight++;
        return;
    }
    await new Promise<void>((resolve) => directWaiters.push(resolve));
    directInFlight++;
}

function releaseDirectSlot(): void {
    directInFlight--;
    directWaiters.shift()?.();
}

async function callDirect<T>(fn: (stub: ComlinkStub) => Promise<T>): Promise<T> {
    await acquireDirectSlot();
    try {
        return await fn(stubs().direct);
    } finally {
        releaseDirectSlot();
    }
}

/**
 * Runs a comlink call at the given priority.
 *
 * Normally the call goes through swapiServe, which owns the global concurrency budget, the
 * priority ordering, and retry. If swapiServe is unreachable the call falls back to comlink
 * directly under a small local cap, and the service is not retried again until the recheck
 * interval has passed. Losing the governor should degrade throughput, not availability.
 */
export async function withStub<T>(priority: Priority, fn: (stub: ComlinkStub) => Promise<T>): Promise<T> {
    if (Date.now() < serviceDownUntil) {
        return await callDirect(fn);
    }

    try {
        return await fn(stubs().tiers[priority]);
    } catch (err) {
        if (!isConnectionFailure(err)) throw err;

        serviceDownUntil = Date.now() + SERVICE_RECHECK_MS;
        logger.error("[swapiQueue] swapiServe unreachable, falling back to direct comlink calls at a reduced cap");
        return await callDirect(fn);
    }
}

/** Fetches the service's health snapshot, for diagnostics. */
export async function getStatus(): Promise<unknown> {
    const response = await fetch(`${serveUrl}/status`);
    return await response.json();
}

/**
 * Resolves a single bulk-tier stub for the batch services, checking once whether swapiServe is up.
 *
 * dataUpdater and the mod worker cannot use withStub: they build one stub and thread it through a
 * dozen functions, one of which reaches for the library's private _postRequestPromiseAPI because
 * there is no wrapper for /getGuildLeaderboard. Pointing the base URL at the bulk prefix routes
 * every call through the queue regardless of which method is used.
 *
 * The health check happens once because these are single-cycle processes, not long-lived ones.
 * Falling back keeps a nightly cycle running when the governor is down, which matches the bot's
 * behaviour rather than failing the whole run.
 */
export async function resolveBulkStub(): Promise<ComlinkStub> {
    const credentials = { accessKey: env.SWAPI_ACCESS_KEY, secretKey: env.SWAPI_SECRET_KEY };

    try {
        const response = await fetch(`${serveUrl}/status`);
        if (!response.ok) throw new Error(`status endpoint returned ${response.status}`);
        return new ComlinkStub({ url: `${serveUrl}/p${PRIORITY.BULK}`, ...credentials });
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logger.error(`[swapiQueue] swapiServe unreachable (${message}); this run will call comlink directly and uncoordinated`);
        return new ComlinkStub({ url: directUrl, ...credentials });
    }
}

export function __setUrlsForTesting({ serveUrl: serve, directUrl: direct }: { serveUrl: string; directUrl: string }): void {
    serveUrl = serve;
    directUrl = direct;
    buildStubs();
}

export function __serviceDownForTesting(): boolean {
    return Date.now() < serviceDownUntil;
}

export function __resetForTesting(): void {
    serveUrl = env.SWAPI_SERVE_URL;
    directUrl = env.SWAPI_CLIENT_URL;
    tierStubs = null;
    directStub = null;
    serviceDownUntil = 0;
    directInFlight = 0;
    directWaiters.length = 0;
}
