export type Outcome = "ok" | "throttled" | "server_error" | "transport_failure" | "client_timeout" | "not_found" | "rejected";

// 408 Request Timeout is the one 4xx that describes a transient condition rather than a request
// the server will reject identically next time.
const REQUEST_TIMEOUT = 408;
const TOO_MANY_REQUESTS = 429;

/**
 * Classifies an upstream response into an outcome, which drives two independent decisions:
 * whether to retry (isRetryable) and whether the backend's health score should suffer
 * (affectsHealth). The old isNonRetryableFetchError in modules/swapi.ts answered only the first.
 *
 * `status` is undefined when the request never got a response at all (transport errors:
 * ECONNREFUSED, socket timeouts). `message` is the upstream body's message where one was
 * readable, used only for the two textual rules below.
 */
export function classifyOutcome(status: number | undefined, message?: string): Outcome {
    // A dead or renamed ally code never resolves, whatever status it arrives with.
    if (message && /failed to find ally code/i.test(message)) return "not_found";
    if (message && /too many requests|rate limit/i.test(message)) return "throttled";

    if (status === undefined) return "transport_failure";
    if (status >= 200 && status < 300) return "ok";
    if (status === TOO_MANY_REQUESTS) return "throttled";
    if (status === REQUEST_TIMEOUT) return "client_timeout";
    if (status >= 500) return "server_error";
    if (status >= 400) return "rejected";
    return "ok";
}

/**
 * Whether the request is worth sending again.
 *
 * Throttles are retryable here, unlike in the code this replaces. The old rule (modules/swapi.ts)
 * refused to retry a 429, reasoning that the limit was shared across everything we ran so a retry
 * only deepened the hole. That was correct when nothing paced us: every failing call would triple
 * its requests at exactly the wrong moment. Now a 429 halves the backend's concurrency and rate,
 * and the retry re-enters the queue rather than bypassing it, so it is paced by the collapsed rate
 * and capped by the retry budget. Dropping it instead would lose the request for no benefit.
 */
export function isRetryable(outcome: Outcome): boolean {
    return outcome === "throttled" || outcome === "server_error" || outcome === "transport_failure" || outcome === "client_timeout";
}

/**
 * Whether the outcome says anything about the backend's health. Only failures caused by the
 * backend count. A rejected request or a missing ally code is the caller's problem and must not
 * shrink the concurrency limit.
 */
export function affectsHealth(outcome: Outcome): boolean {
    return outcome === "throttled" || outcome === "server_error" || outcome === "transport_failure";
}
