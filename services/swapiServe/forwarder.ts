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
                headers: Object.fromEntries(response.headers.entries()),
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
