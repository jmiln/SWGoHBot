import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { gzipSync } from "node:zlib";

export interface FakeComlinkResponse {
    status: number;
    body?: string;
    /** Extra response headers, e.g. Retry-After on a 429. */
    headers?: Record<string, string>;
    /** Delay before responding, to simulate a slow or hung backend. */
    delayMs?: number;
    /**
     * Compresses the body and sets content-encoding/content-length to match the compressed bytes,
     * as a real comlink does when the client advertises gzip. Node's fetch decodes the body but
     * leaves both headers describing the compressed form, so anything proxying them verbatim
     * hands the client a body that disagrees with its own headers.
     */
    gzip?: boolean;
}

export interface FakeComlink {
    url: string;
    close: () => Promise<void>;
    requestCount: () => number;
    lastHeaders: () => Record<string, string | string[] | undefined>;
    lastBody: () => string;
    /** Highest number of requests the server had open at once. */
    peakConcurrent: () => number;
    /** Requests whose client went away before the response was sent. */
    abandonedCount: () => number;
}

/**
 * Starts a scriptable stand-in for comlink on an ephemeral port so dispatcher and service tests
 * can drive real HTTP without touching the live API.
 */
export async function startFakeComlink(
    handler: (request: { uri: string; count: number }) => FakeComlinkResponse,
): Promise<FakeComlink> {
    let count = 0;
    let headers: Record<string, string | string[] | undefined> = {};
    let body = "";
    let inFlight = 0;
    let peak = 0;
    let abandoned = 0;

    const server: Server = createServer((req: IncomingMessage, res: ServerResponse) => {
        count++;
        headers = req.headers;

        // A client that cancels closes the socket before the response is written, which is how a
        // caller proves it really withdrew the request rather than merely walking away from it.
        res.on("close", () => {
            if (!res.writableEnded) abandoned++;
        });

        const chunks: Buffer[] = [];
        req.on("data", (chunk: Buffer) => chunks.push(chunk));
        req.on("end", () => {
            body = Buffer.concat(chunks).toString();
            const result = handler({ uri: req.url ?? "", count });

            inFlight++;
            if (inFlight > peak) peak = inFlight;

            const send = () => {
                inFlight--;
                const payload = result.body ?? "{}";
                if (result.gzip) {
                    const compressed = gzipSync(Buffer.from(payload));
                    res.writeHead(result.status, {
                        "Content-Type": "application/json",
                        "Content-Encoding": "gzip",
                        "Content-Length": String(compressed.length),
                        ...result.headers,
                    });
                    res.end(compressed);
                    return;
                }
                res.writeHead(result.status, { "Content-Type": "application/json", ...result.headers });
                res.end(payload);
            };

            if (result.delayMs) {
                setTimeout(send, result.delayMs).unref();
            } else {
                send();
            }
        });
    });

    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (address === null || typeof address === "string") throw new Error("fake comlink failed to bind a port");

    return {
        url: `http://127.0.0.1:${address.port}`,
        close: () =>
            new Promise<void>((resolve, reject) => {
                server.close((err) => (err ? reject(err) : resolve()));
            }),
        requestCount: () => count,
        lastHeaders: () => headers,
        lastBody: () => body,
        peakConcurrent: () => peak,
        abandonedCount: () => abandoned,
    };
}
