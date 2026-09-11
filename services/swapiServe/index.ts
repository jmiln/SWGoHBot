import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { env } from "../../config/config.ts";
import { DEADLINE_MS, PRIORITY_COUNT, type Priority, SHED_REASON_HEADER, SHED_SHUTTING_DOWN } from "../../data/constants/swapiServe.ts";
import logger, { shouldUsePretty } from "../../modules/Logger.ts";
import { getPackageVersion } from "../../modules/utils/version.ts";
import { Dispatcher } from "./dispatcher.ts";

const BAD_REQUEST = 400;
const UNAUTHORIZED = 401;
const INTERNAL_SERVER_ERROR = 500;
const SERVICE_UNAVAILABLE = 503;
const LOOPBACK = "127.0.0.1";
const JSON_HEADERS = { "Content-Type": "application/json" };

// Clients express how long the request is still worth sending via this header. ComlinkStub has no
// per-request header hook, so in practice everything falls through to the per-tier default.
const DEADLINE_HEADER = "x-swapi-deadline-ms";

const CONTROL_PATH = /^\/backend\/([^/]+)\/(drain|enable|set-limit)$/;

// How often shutdown re-checks for keep-alive connections that have gone idle since the last look.
const SHUTDOWN_SWEEP_MS = 20;

// A request already at the backend has up to UPSTREAM_TIMEOUT_MS, longer than the supervisor's
// grace period, so shutdown gives up here. compose sets stop_grace_period comfortably past it.
const SHUTDOWN_GRACE_MS = 5_000;

/**
 * Reads the priority tier off the path prefix and returns the real comlink path.
 *
 * ComlinkStub exposes no per-request header hook, but it builds its URL as `${this.url}${uri}`
 * and signs only `uri`. So each priority gets its own stub whose base URL carries a prefix, and
 * the tier rides in the path without touching the signature.
 */
export function parsePriorityPath(url: string): { priority: Priority; uri: string } | null {
    const match = /^\/p(\d+)(\/.+)$/.exec(url);
    if (!match) return null;

    const priority = Number(match[1]);
    if (!Number.isInteger(priority) || priority < 0 || priority >= PRIORITY_COUNT) return null;

    return { priority: priority as Priority, uri: match[2] };
}

function readBody(req: IncomingMessage): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        const chunks: Buffer[] = [];
        req.on("data", (chunk: Buffer) => chunks.push(chunk));
        req.on("end", () => resolve(Buffer.concat(chunks)));
        req.on("error", reject);
    });
}

/**
 * How long this request is worth sending: the caller's header if it gave a usable one, otherwise
 * the tier's default. Exported so the per-tier defaults are testable without waiting one out.
 */
export function resolveDeadlineMs(priority: Priority, header: string | string[] | undefined): number {
    const value = Number(Array.isArray(header) ? header[0] : header);
    return Number.isFinite(value) && value > 0 ? value : DEADLINE_MS[priority];
}

export interface RunningService {
    url: string;
    close: () => Promise<void>;
}

/**
 * Starts the queueing reverse proxy.
 *
 * Binds to loopback by default; `host` overrides that for containers, where the bot reaches this
 * service across a bridge network rather than from this host.
 *
 * The queue path carries no bearer secret: ComlinkStub puts its HMAC signature in the Authorization
 * header, so a token would collide with it. The control routes are never ComlinkStub calls, so they
 * can and do use that header - `controlSecret` guards them, and matters as soon as the bind is not
 * loopback, since the bind is otherwise their only protection.
 */
export function buildStartupFields({
    port,
    backends,
    ratePerSecond,
    startLimit,
}: {
    port: number;
    backends: string[];
    ratePerSecond?: number;
    startLimit?: number;
}): Record<string, unknown> {
    return {
        version: getPackageVersion(),
        logLevel: env.LOG_LEVEL,
        pretty: shouldUsePretty(env.LOG_PRETTY, Boolean(process.stdout.isTTY)),
        port,
        // Count only: these are SWAPI_CLIENT_URL values naming upstream infrastructure.
        backendCount: backends.length,
        ratePerSecond,
        startLimit,
    };
}

export async function startSwapiServe({
    port,
    backends,
    accessKey,
    secretKey,
    ratePerSecond,
    startLimit,
    maxLimit,
    maxPerSecond,
    host,
    controlSecret,
}: {
    port: number;
    backends: string[];
    accessKey: string;
    secretKey: string;
    /** Overrides the starting refill rate. Tests set this high so pacing does not slow them down. */
    ratePerSecond?: number;
    /** Overrides the starting concurrency limit. Tests use it to force deterministic queueing. */
    startLimit?: number;
    /** Overrides the AIMD ceilings. Production passes the SWAPI_SERVE_MAX_* env values. */
    maxLimit?: number;
    maxPerSecond?: number;
    /** Bind address. Defaults to loopback; containers set 0.0.0.0. */
    host?: string;
    /** Guards the control routes. Unset leaves them open, which is safe only on loopback. */
    controlSecret?: string;
}): Promise<RunningService> {
    // Backends are reported by index: their URLs are SWAPI_CLIENT_URL values.
    const backendIndexes = new Map(backends.map((url, index) => [url, index]));
    const backendIndexOf = (url: string): number => backendIndexes.get(url) ?? -1;

    const dispatcher = new Dispatcher({
        backends,
        accessKey,
        secretKey,
        ratePerSecond,
        startLimit,
        maxLimit,
        maxPerSecond,
        onGovernorTransition: (transition) => {
            const fields = {
                backendIndex: backendIndexOf(transition.url),
                event: transition.event,
                limit: transition.limit,
                previousLimit: transition.previousLimit,
                ratePerSecond: transition.ratePerSecond,
                previousRatePerSecond: transition.previousRatePerSecond,
                consecutiveFailures: transition.consecutiveFailures,
            };
            if (transition.event === "backoff" || transition.event === "open") {
                logger.warn(`Backend ${transition.event}`, fields);
            } else {
                logger.log(`Backend ${transition.event}`, "log", fields);
            }
        },
    });
    let isShuttingDown = false;

    /**
     * Answers one request. Every failure path is caught by the wrapper below rather than here, so
     * that routing stays readable and no future edit can add an unguarded await.
     */
    const handleRequest = async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
        const url = req.url ?? "";

        if (url === "/status") {
            res.writeHead(200, JSON_HEADERS);
            res.end(JSON.stringify(dispatcher.status()));
            return;
        }

        // Control API. Not for everyday use: it exists so a misbehaving backend can be taken out
        // of rotation, or its limit pinned, without restarting the service and losing every
        // learned budget along with it.
        const control = CONTROL_PATH.exec(url);
        if (control) {
            // Checked before the target is parsed, so an unauthorised caller learns nothing about
            // which backends exist.
            if (controlSecret && req.headers.authorization !== `Bearer ${controlSecret}`) {
                res.writeHead(UNAUTHORIZED, JSON_HEADERS);
                res.end(JSON.stringify({ message: "Unauthorized" }));
                return;
            }

            const target = decodeURIComponent(control[1]);
            const payload = req.method === "GET" ? null : await readBody(req);
            const applied = dispatcher.control(target, control[2], payload);
            logger.log("Operator control action", "log", {
                action: control[2],
                backendIndex: backendIndexOf(target),
                ok: applied.ok,
            });

            res.writeHead(applied.ok ? 200 : BAD_REQUEST, JSON_HEADERS);
            res.end(JSON.stringify(applied));
            return;
        }

        const parsed = parsePriorityPath(url);
        if (!parsed) {
            res.writeHead(BAD_REQUEST, JSON_HEADERS);
            res.end(JSON.stringify({ message: "Expected a /pN priority prefix" }));
            return;
        }

        if (isShuttingDown) {
            // Labelled like the dispatcher's own shed, so a client sees the same reason whether the
            // request arrived just before or just after stop() ran.
            res.writeHead(SERVICE_UNAVAILABLE, { ...JSON_HEADERS, [SHED_REASON_HEADER]: SHED_SHUTTING_DOWN });
            res.end(JSON.stringify({ message: "swapiServe is shutting down" }));
            return;
        }

        const body = req.method === "GET" ? null : await readBody(req);
        const deadline = Date.now() + resolveDeadlineMs(parsed.priority, req.headers[DEADLINE_HEADER]);

        // A client that hangs up is a client whose response can no longer be delivered, so the
        // queued request is withdrawn rather than spending scarce upstream capacity on it.
        const cancellation = new AbortController();
        res.on("close", () => {
            if (!res.writableEnded) cancellation.abort();
        });

        const response = await dispatcher.submit(
            {
                method: req.method ?? "POST",
                uri: parsed.uri,
                body,
                priority: parsed.priority,
                deadline,
            },
            cancellation.signal,
        );

        // Nothing to send if the socket is already gone.
        if (res.writableEnded || cancellation.signal.aborted) return;

        res.writeHead(response.status, response.headers);
        res.end(response.body);
    };

    /**
     * Nothing a single request does may end this process.
     *
     * Node terminates on an unhandled rejection, and an async request handler turns any throw into
     * one. The routine case is a client that disappears mid-request, which rejects the body read
     * with ECONNRESET: entirely expected from a shard that died or restarted, and not worth
     * logging every time. Every shard and both updaters queue through this one process, so taking
     * it down over that would convert one client's failure into an outage for all of them.
     */
    const server: Server = createServer((req: IncomingMessage, res: ServerResponse) => {
        handleRequest(req, res).catch((err: unknown) => {
            const clientGone = res.writableEnded || !res.writable;
            if (!clientGone) {
                logger.error(`Request handler failed: ${err instanceof Error ? err.message : String(err)}`);
            }
            if (res.headersSent || clientGone) {
                res.destroy();
                return;
            }
            res.writeHead(INTERNAL_SERVER_ERROR, JSON_HEADERS);
            res.end(JSON.stringify({ message: "swapiServe failed to handle the request" }));
        });
    });

    const boundHost = host ?? LOOPBACK;
    await new Promise<void>((resolve) => server.listen(port, boundHost, resolve));
    const address = server.address();
    if (address === null || typeof address === "string") throw new Error("swapiServe failed to bind a port");

    // Unset-and-loopback is the long-standing status quo. Unset-and-exposed is the combination that
    // arrives silently the first time this runs in a container, so it says so out loud.
    if (!controlSecret && boundHost !== LOOPBACK) {
        logger.warn(`Control API is unauthenticated and bound to ${boundHost}. Set SWAPI_SERVE_CONTROL_SECRET.`);
    }

    return {
        url: `http://${boundHost}:${address.port}`,
        close: async () => {
            isShuttingDown = true;
            // Settles everything queued, so no caller is left holding a response that never ends.
            dispatcher.stop();
            await new Promise<void>((resolve, reject) => {
                // Bounds the wait for in-flight requests. Without it a single slow upstream call
                // holds shutdown open for the full upstream timeout.
                const deadline = setTimeout(() => server.closeAllConnections(), SHUTDOWN_GRACE_MS);
                deadline.unref();
                server.once("close", () => clearTimeout(deadline));

                server.close((err) => (err ? reject(err) : resolve()));

                // server.close() waits on keep-alive sockets, and every shard holds one open.
                // Swept repeatedly since a connection still flushing a response is not idle yet.
                const sweep = setInterval(() => server.closeIdleConnections(), SHUTDOWN_SWEEP_MS);
                sweep.unref();
                server.once("close", () => clearInterval(sweep));
                server.closeIdleConnections();
            });
        },
    };
}

// Guarded so tests can import this module without binding a port.
if (process.argv[1]?.endsWith("swapiServe/index.ts")) {
    startSwapiServe({
        port: env.SWAPI_SERVE_PORT,
        host: env.SWAPI_SERVE_HOST,
        controlSecret: env.SWAPI_SERVE_CONTROL_SECRET,
        backends: [env.SWAPI_CLIENT_URL],
        accessKey: env.SWAPI_ACCESS_KEY,
        secretKey: env.SWAPI_SECRET_KEY,
        startLimit: env.SWAPI_SERVE_START_LIMIT,
        ratePerSecond: env.SWAPI_SERVE_START_RATE,
        maxLimit: env.SWAPI_SERVE_MAX_LIMIT,
        maxPerSecond: env.SWAPI_SERVE_MAX_RATE,
    })
        .then((service) => {
            logger.log("Service started", "ready", buildStartupFields({ port: env.SWAPI_SERVE_PORT, backends: [env.SWAPI_CLIENT_URL] }));

            // Without these the close() above is unreachable in production: Node exits on SIGTERM
            // and every queued caller gets a dropped socket instead of a 503.
            let shuttingDown = false;
            const gracefulShutdown = async (signal: string): Promise<void> => {
                if (shuttingDown) return;
                shuttingDown = true;

                logger.log(`Received ${signal}, starting graceful shutdown`);
                try {
                    await service.close();
                    logger.log("Graceful shutdown complete");
                    process.exit(0);
                } catch (err: unknown) {
                    logger.error(`Error during shutdown: ${err instanceof Error ? err.message : String(err)}`);
                    process.exit(1);
                }
            };

            process.on("SIGTERM", () => void gracefulShutdown("SIGTERM"));
            process.on("SIGINT", () => void gracefulShutdown("SIGINT"));

            // Logged rather than fatal, matching eventServe. One malformed response must not cost
            // every client its queue.
            process.on("uncaughtException", (err: Error) => {
                logger.error(`Uncaught exception - ${err.message}`);
                logger.error(String(err.stack));
            });
            process.on("unhandledRejection", (reason, promise) => {
                logger.error(`Unhandled rejection at ${promise}`);
                logger.error(`Reason: ${reason}`);
            });
        })
        .catch((err: unknown) => {
            logger.error(`Failed to start: ${err instanceof Error ? err.message : String(err)}`);
            process.exit(1);
        });
}
