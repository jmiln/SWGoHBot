import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { env } from "../../config/config.ts";
import { PRIORITY_COUNT, type Priority } from "../../data/constants/swapiServe.ts";
import logger from "../../modules/Logger.ts";
import { Dispatcher } from "./dispatcher.ts";

const BAD_REQUEST = 400;
const SERVICE_UNAVAILABLE = 503;
const LOOPBACK = "127.0.0.1";
const JSON_HEADERS = { "Content-Type": "application/json" };

// Clients express how long the request is still worth sending via this header. Anything without
// one gets the default, which is generous enough for a bulk pull.
const DEADLINE_HEADER = "x-swapi-deadline-ms";
const DEFAULT_DEADLINE_MS = 120_000;

const CONTROL_PATH = /^\/backend\/([^/]+)\/(drain|enable|set-limit)$/;

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

function readDeadlineMs(req: IncomingMessage): number {
    const raw = req.headers[DEADLINE_HEADER];
    const value = Number(Array.isArray(raw) ? raw[0] : raw);
    return Number.isFinite(value) && value > 0 ? value : DEFAULT_DEADLINE_MS;
}

export interface RunningService {
    url: string;
    close: () => Promise<void>;
}

/**
 * Starts the queueing reverse proxy.
 *
 * Binds to loopback only. Unlike eventServe there is no bearer secret: ComlinkStub puts its HMAC
 * signature in the Authorization header, so a bearer token would collide with it. Every client
 * (bot shards, dataUpdater, counterUpdater) runs on this host by design.
 */
export async function startSwapiServe({
    port,
    backends,
    accessKey,
    secretKey,
    ratePerSecond,
    startLimit,
}: {
    port: number;
    backends: string[];
    accessKey: string;
    secretKey: string;
    /** Overrides the starting refill rate. Tests set this high so pacing does not slow them down. */
    ratePerSecond?: number;
    /** Overrides the starting concurrency limit. Tests use it to force deterministic queueing. */
    startLimit?: number;
}): Promise<RunningService> {
    const dispatcher = new Dispatcher({ backends, accessKey, secretKey, ratePerSecond, startLimit });
    let isShuttingDown = false;

    const server: Server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
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
            const target = decodeURIComponent(control[1]);
            const payload = req.method === "GET" ? null : await readBody(req);
            const applied = dispatcher.control(target, control[2], payload);

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
            res.writeHead(SERVICE_UNAVAILABLE, JSON_HEADERS);
            res.end(JSON.stringify({ message: "swapiServe is shutting down" }));
            return;
        }

        const body = req.method === "GET" ? null : await readBody(req);
        const deadline = Date.now() + readDeadlineMs(req);

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
    });

    await new Promise<void>((resolve) => server.listen(port, LOOPBACK, resolve));
    const address = server.address();
    if (address === null || typeof address === "string") throw new Error("swapiServe failed to bind a port");

    return {
        url: `http://${LOOPBACK}:${address.port}`,
        close: async () => {
            isShuttingDown = true;
            dispatcher.stop();
            await new Promise<void>((resolve, reject) => {
                server.close((err) => (err ? reject(err) : resolve()));
            });
        },
    };
}

// Entry point when run as a service rather than imported by tests.
if (process.argv[1]?.endsWith("swapiServe/index.ts")) {
    startSwapiServe({
        port: env.SWAPI_SERVE_PORT,
        backends: [env.SWAPI_CLIENT_URL],
        accessKey: env.SWAPI_ACCESS_KEY,
        secretKey: env.SWAPI_SECRET_KEY,
    })
        .then(() => {
            logger.log("SwapiServe: Service started");
        })
        .catch((err: unknown) => {
            logger.error(`SwapiServe: Failed to start: ${err instanceof Error ? err.message : String(err)}`);
            process.exit(1);
        });
}
