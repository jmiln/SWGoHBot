import ComlinkStub from "@swgoh-utils/comlink";
import { env } from "../config/config.ts";
import {
    DEADLINE_MS,
    FALLBACK_MAX_CONCURRENT,
    PRIORITY,
    PRIORITY_COUNT,
    type Priority,
    SERVICE_RECHECK_MS,
    SHED_REASON_HEADER,
    SHED_SHUTTING_DOWN,
    UPSTREAM_TIMEOUT_MS,
    WATCHDOG_SLACK_MS,
} from "../data/constants/swapiServe.ts";
import logger from "./Logger.ts";

// Connection-level failures mean swapiServe is not there. Anything else is a real answer from
// upstream and must be surfaced, not worked around.
const CONNECTION_ERROR_CODES = new Set(["ECONNREFUSED", "ECONNRESET", "EHOSTUNREACH", "ENOTFOUND", "ETIMEDOUT"]);

let serveUrl = env.SWAPI_SERVE_URL;
let directUrl = env.SWAPI_CLIENT_URL;
let tierStubs: ComlinkStub[] | null = null;
let directStub: ComlinkStub | null = null;
let serviceDownUntil = 0;
/** Test-only override for the watchdog bound, which is otherwise a minute or more. */
let watchdogOverrideMs: number | null = null;
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

/**
 * Whether this failure is swapiServe telling us it is going away.
 *
 * A shutdown is not a connection failure: the service answers 503 on the way down, deliberately, so
 * that no caller is left holding a socket that never closes. Read as a plain HTTP error that would
 * mean every queued call across every shard and both updaters fails on each restart, which is the
 * outcome the direct-call fallback exists to prevent. Only this one reason qualifies; a full queue or
 * an unavailable backend is the governor working, and bypassing it then would be the bug.
 */
function isServiceShuttingDown(err: unknown): boolean {
    if (typeof err !== "object" || err === null || !("response" in err)) return false;
    const { response } = err as { response?: { headers?: Record<string, string | string[] | undefined> } };
    const reason = response?.headers?.[SHED_REASON_HEADER];
    return (Array.isArray(reason) ? reason[0] : reason) === SHED_SHUTTING_DOWN;
}

/**
 * How long a call at this tier may take before the service is treated as unresponsive.
 *
 * Not simply the tier deadline. swapiServe answers *later* than its own deadline in one legitimate
 * case: a request dispatched just before the deadline passes runs to completion, because the upstream
 * cost is already paid, and that can take the full upstream timeout. So a healthy call is bounded by
 * the deadline plus that timeout, and anything tighter would report a slow comlink as a wedged
 * service. The slack on top covers loopback and queue jitter.
 *
 * Exported so the bound can be checked against the constants it is derived from without waiting one
 * out.
 */
export function watchdogMsForTier(priority: Priority): number {
    return watchdogOverrideMs ?? DEADLINE_MS[priority] + UPSTREAM_TIMEOUT_MS + WATCHDOG_SLACK_MS;
}

/**
 * Latches the service down so new work goes direct until the recheck interval passes.
 *
 * Throttled, because everything that makes this fire makes it fire for every caller at once: a
 * missing service produces one connection failure per call, and a wedged one produces one watchdog
 * per call. One line per minute says as much as thousands.
 */
function markServiceDown(reason: string): void {
    serviceDownUntil = Date.now() + SERVICE_RECHECK_MS;
    logger.throttleError(
        "swapiQueue-service-down",
        `[swapiQueue] swapiServe ${reason}, falling back to direct comlink calls at a reduced cap`,
    );
}

/**
 * Watches a queued call for the service failing to answer at all, without interfering with it.
 *
 * A wedged swapiServe is the one failure mode the fallback cannot otherwise see. An absent service
 * refuses the connection and a shutting-down one says so, but a process that accepts a connection and
 * then stops answering produces no error at all, and ComlinkStub gives no way to set a got timeout,
 * so the caller waits forever. Every shard and both updaters queue through that one process.
 *
 * The watched call is deliberately left running rather than abandoned. Abandoning it would leave a
 * loser still holding a socket, a swapiServe slot and a share of the retry budget, which is the trap
 * documented in getStrippedModsWorker. This only stops NEW work being sent into a service that has
 * stopped answering; calls already waiting still get whatever answer eventually arrives.
 */
async function withWatchdog<T>(priority: Priority, call: Promise<T>): Promise<T> {
    const timer = setTimeout(() => markServiceDown("unresponsive"), watchdogMsForTier(priority));
    timer.unref();
    try {
        return await call;
    } finally {
        clearTimeout(timer);
    }
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
        return await withWatchdog(priority, fn(stubs().tiers[priority]));
    } catch (err) {
        const unavailable = isConnectionFailure(err) ? "unreachable" : isServiceShuttingDown(err) ? "shutting down" : null;
        if (!unavailable) throw err;

        markServiceDown(unavailable);
        return await callDirect(fn);
    }
}

/**
 * Decides once where a batch service's comlink traffic goes, returning both the base URL and a stub
 * pointed at it.
 *
 * dataUpdater cannot use withStub: it builds one stub and threads it through a dozen functions, one
 * of which reaches for the library's private _postRequestPromiseAPI because there is no wrapper for
 * /getGuildLeaderboard. Pointing the base URL at the bulk prefix routes every call through the queue
 * regardless of which method is used.
 *
 * The URL is returned alongside the stub because not every caller wants one: the mod worker signs
 * and sends its own requests so it can attach an AbortSignal, which ComlinkStub gives it no way to
 * pass, and its Piscina threads cannot receive a stub anyway. Both callers need the same decision,
 * so it is made once here rather than read back off the stub afterwards.
 *
 * The health check happens once because these are single-cycle processes, not long-lived ones.
 * Falling back keeps a nightly cycle running when the governor is down, which matches the bot's
 * behaviour rather than failing the whole run.
 */
export async function resolveBulkStub(): Promise<{ stub: ComlinkStub; url: string }> {
    const credentials = { accessKey: env.SWAPI_ACCESS_KEY, secretKey: env.SWAPI_SECRET_KEY };

    try {
        const response = await fetch(`${serveUrl}/status`);
        if (!response.ok) throw new Error(`status endpoint returned ${response.status}`);
        // Deliberately no check for a service that is mid-shutdown: server.close() stops accepting
        // connections at once, so a process starting during a restart cannot reach /status at all and
        // takes the connection-failure path below. There is no window where it answers and is going
        // away, so there is nothing here to test for.
        const url = `${serveUrl}/p${PRIORITY.BULK}`;
        return { stub: new ComlinkStub({ url, ...credentials }), url };
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logger.error(`[swapiQueue] swapiServe unavailable (${message}); this run will call comlink directly and uncoordinated`);
        return { stub: new ComlinkStub({ url: directUrl, ...credentials }), url: directUrl };
    }
}

export function __setUrlsForTesting({ serveUrl: serve, directUrl: direct }: { serveUrl: string; directUrl: string }): void {
    serveUrl = serve;
    directUrl = direct;
    buildStubs();
}

export function __setWatchdogMsForTesting(ms: number | null): void {
    watchdogOverrideMs = ms;
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
