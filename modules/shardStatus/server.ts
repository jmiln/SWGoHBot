import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import logger from "../Logger.ts";
import type { ShardRegistry } from "./registry.ts";

const JSON_HEADERS = { "Content-Type": "application/json" };
const OK = 200;
const NOT_FOUND = 404;
const SERVICE_UNAVAILABLE = 503;

export interface ShardStatusServerOptions {
    port: number;
    /**
     * Bind address, required because it is this endpoint's only access control and Node's own
     * default is every interface. `SHARD_STATUS_HOST` owns the loopback default; containers set
     * 0.0.0.0.
     */
    host: string;
}

export interface ShardStatusServer {
    url: string;
    close: () => Promise<void>;
}

/**
 * Serves the registry over HTTP.
 *
 * Every response is built from the in-memory snapshot. Nothing here messages a shard, because a
 * wedged shard would not reply and the healthcheck would hang on Docker's clock rather than report
 * the very condition it exists to detect.
 */
export async function startShardStatusServer(registry: ShardRegistry, opts: ShardStatusServerOptions): Promise<ShardStatusServer> {
    const server: Server = createServer((req: IncomingMessage, res: ServerResponse) => {
        const snapshot = registry.snapshot();

        if (req.method === "GET" && req.url === "/health") {
            const ok = snapshot.state !== "down";
            res.writeHead(ok ? OK : SERVICE_UNAVAILABLE, JSON_HEADERS);
            res.end(JSON.stringify({ ok, state: snapshot.state, shardsUp: snapshot.shardsUp, shardsTotal: snapshot.shardsTotal }));
            return;
        }

        // Always 200 while the manager answers. The fleet verdict lives on /health; mirroring it
        // here would take every per-shard monitor down at once.
        if (req.method === "GET" && req.url === "/status") {
            res.writeHead(OK, JSON_HEADERS);
            res.end(JSON.stringify(snapshot));
            return;
        }

        res.writeHead(NOT_FOUND, JSON_HEADERS);
        res.end(JSON.stringify({ error: "Not found" }));
    });

    await new Promise<void>((resolve) => server.listen(opts.port, opts.host, resolve));

    const address = server.address();
    if (address === null || typeof address === "string") throw new Error("shardStatus failed to bind a port");

    logger.log(`ShardStatus: listening on http://${opts.host}:${address.port}`);

    return {
        url: `http://${opts.host}:${address.port}`,
        close: async () => {
            await new Promise<void>((resolve, reject) => {
                server.closeAllConnections();
                server.close((err) => (err ? reject(err) : resolve()));
            });
        },
    };
}
