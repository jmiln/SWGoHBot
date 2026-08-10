import { UPSTREAM_TIMEOUT_MS } from "../../data/constants/swapiServe.ts";
import { signRequest } from "./signer.ts";

export interface ForwardResult {
    /** Undefined when the request never got a response (transport error or timeout). */
    status?: number;
    headers: Record<string, string>;
    body: Buffer;
}

export type Forwarder = (backendUrl: string, request: { method: string; uri: string; body: Buffer | null }) => Promise<ForwardResult>;

/**
 * Response headers that must not be passed on to the client.
 *
 * `content-encoding` and `content-length` describe the bytes that arrived on the wire, but fetch
 * decodes the body before we ever see it, so both would describe something we are no longer
 * holding. Forwarding them hands the client a response that contradicts itself: ComlinkStub runs
 * got with `decompress: true` and fails with Z_DATA_ERROR trying to gunzip plain JSON, and Node
 * rejects the write outright once the decoded body runs past the declared length. Whether this
 * fires is the backend's choice, not ours, since fetch advertises gzip support on every request.
 *
 * The rest are hop-by-hop: they describe the connection to the backend, which is not the
 * connection the client is on. Node sets the correct values for its own response.
 */
const STRIPPED_RESPONSE_HEADERS = new Set([
    "content-encoding",
    "content-length",
    "connection",
    "keep-alive",
    "transfer-encoding",
    "upgrade",
    "proxy-authenticate",
    "proxy-authorization",
    "te",
    "trailer",
]);

/** Drops the headers that describe the upstream connection or the body's pre-decode form. */
function forwardableHeaders(headers: Headers): Record<string, string> {
    const forwardable: Record<string, string> = {};
    for (const [name, value] of headers.entries()) {
        if (!STRIPPED_RESPONSE_HEADERS.has(name.toLowerCase())) forwardable[name] = value;
    }
    return forwardable;
}

/**
 * The only part of the service that touches the network.
 *
 * Kept as a separate injectable function so the scheduler can be tested, simulated, and
 * stress-tested against a fake backend with no sockets involved. It signs at call time rather
 * than at enqueue time, so a request that waited minutes in the queue still arrives with a fresh
 * timestamp.
 */
export function createHttpForwarder({
    accessKey,
    secretKey,
    timeoutMs,
}: {
    accessKey: string;
    secretKey: string;
    timeoutMs?: number;
}): Forwarder {
    const limit = timeoutMs ?? UPSTREAM_TIMEOUT_MS;

    return async (backendUrl, request) => {
        const headers: Record<string, string> = {
            ...signRequest({ accessKey, secretKey, method: request.method, uri: request.uri, body: request.body }),
            "content-type": "application/json",
        };

        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), limit);

        // Node's fetch accepts a Buffer directly, but the DOM typings TypeScript resolves here
        // describe BodyInit without it, so the type is asserted rather than the value converted.
        // Deliberately not `body.toString()`: the signature's md5 was computed over these exact
        // bytes, and a string round-trip would re-encode them.
        const body = request.body as unknown as BodyInit | undefined;

        try {
            const response = await fetch(`${backendUrl}${request.uri}`, {
                method: request.method,
                headers,
                body,
                signal: controller.signal,
            });

            return {
                status: response.status,
                headers: forwardableHeaders(response.headers),
                body: Buffer.from(await response.arrayBuffer()),
            };
        } catch {
            // No response at all: transport error or the timeout fired. classifyOutcome reads an
            // undefined status as a transport failure.
            return { status: undefined, headers: {}, body: Buffer.alloc(0) };
        } finally {
            clearTimeout(timer);
        }
    };
}
