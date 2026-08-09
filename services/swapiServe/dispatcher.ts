import { type Priority, RETRY } from "../../data/constants/swapiServe.ts";
import { type Clock, systemClock, type TimerHandle } from "./clock.ts";
import { createHttpForwarder, type Forwarder } from "./forwarder.ts";
import { type BlockedBy, Governor } from "./governor.ts";
import { classifyOutcome, isRetryable, type Outcome } from "./outcomes.ts";
import { PriorityQueue, type QueueEntry } from "./queue.ts";
import { RetryBudget } from "./retryBudget.ts";

export interface ProxyRequest {
    method: string;
    uri: string;
    body: Buffer | null;
    priority: Priority;
    /** Epoch ms after which the caller no longer wants this request sent. */
    deadline: number;
    /**
     * How much upstream budget this request consumes. Always 1 for now, and nothing reads it yet.
     * It exists so that if the per-endpoint metrics later show a guild pull costs five times a
     * player pull, weighting becomes a scheduler change rather than a change to every interface
     * between here and the callers.
     */
    cost?: number;
}

export interface ProxyResponse {
    status: number;
    headers: Record<string, string>;
    body: Buffer;
}

/**
 * Exactly one of these is recorded for every request that leaves the queue.
 *
 * "Removed" is not a useful thing to learn during an incident. Knowing that four hundred requests
 * hit `deadline` while the service was `token`-blocked identifies both the symptom and the
 * constant to change; a bare disappearance identifies neither.
 */
export type TerminalReason =
    | "completed"
    | "upstream_error"
    | "backend_unavailable"
    | "cancelled"
    | "deadline"
    | "queue_overflow"
    | "shutting_down";

interface PendingRequest {
    request: ProxyRequest;
    /** 0 on first try. A retry is the same request with this incremented, never a new kind. */
    attempt: number;
    /** Stable identity across retries, so a request can be followed through the logs. */
    id: number;
    /**
     * Set once the caller has been answered. The abort listener outlives the request, so a client
     * that hangs up while the request is in flight or waiting out a retry would otherwise settle
     * it a second time: harmless for the promise, which ignores the duplicate resolve, but it
     * would double-count the terminal reason and break the one-reason-per-request guarantee.
     */
    settled: boolean;
    resolve: (response: ProxyResponse) => void;
}

const SERVICE_UNAVAILABLE = 503;
const JSON_HEADERS = { "content-type": "application/json" };

function shedResponse(reason: string): ProxyResponse {
    return {
        status: SERVICE_UNAVAILABLE,
        headers: JSON_HEADERS,
        body: Buffer.from(JSON.stringify({ message: reason })),
    };
}

/**
 * Owns the run loop: queue by priority, hand out backend slots as they free up, forward, classify
 * the outcome, retry when allowed, and resolve the caller.
 *
 * Response bodies are Buffers throughout and are never parsed. The one exception is a best-effort
 * peek at an error body's `message` field, which the outcome rules need to tell a missing ally
 * code apart from a genuine rejection. That peek is confined to non-2xx responses.
 */
export class Dispatcher {
    private readonly queue: PriorityQueue<PendingRequest>;
    private readonly governor: Governor;
    private readonly retryBudget: RetryBudget;
    private readonly clock: Clock;
    private readonly forwarder: Forwarder;
    private readonly retryDelayMs: number;
    private readonly endpointCosts = new Map<string, { count: number; totalLatencyMs: number; totalBytes: number }>();
    private stopped = false;
    private wakeup: TimerHandle | null = null;
    private lastRequestId = 0;
    private dispatchCount = 0;
    private retryCount = 0;
    private latencyTotal = 0;
    private latencyMax = 0;
    private readonly blocked: Record<BlockedBy, number> = { slot: 0, token: 0, health: 0 };
    private readonly terminal: Record<TerminalReason, number> = {
        completed: 0,
        upstream_error: 0,
        backend_unavailable: 0,
        cancelled: 0,
        deadline: 0,
        queue_overflow: 0,
        shutting_down: 0,
    };

    constructor({
        backends,
        accessKey,
        secretKey,
        forwarder,
        clock,
        startLimit,
        ratePerSecond,
        depthLimits,
        retryDelayMs,
        timeoutMs,
        circuitProbeIntervalMs,
    }: {
        backends: string[];
        accessKey: string;
        secretKey: string;
        /** Overrides upstream I/O. The simulator and stress test pass a fake; production omits it. */
        forwarder?: Forwarder;
        /** Overrides time. Tests pass a FakeClock so backoff and pacing are deterministic. */
        clock?: Clock;
        startLimit?: number;
        ratePerSecond?: number;
        depthLimits?: readonly number[];
        retryDelayMs?: number;
        timeoutMs?: number;
        /** Overrides the circuit probe cadence. Tests use it to avoid waiting out the real one. */
        circuitProbeIntervalMs?: number;
    }) {
        this.clock = clock ?? systemClock;
        this.forwarder = forwarder ?? createHttpForwarder({ accessKey, secretKey, timeoutMs });
        this.governor = new Governor(backends, { probeIntervalMs: circuitProbeIntervalMs });

        // Tests need deterministic pacing; production uses GOVERNOR.START_LIMIT and RATE.START_PER_SEC.
        for (const backend of this.governor.snapshot()) {
            if (startLimit !== undefined) this.governor.setLimit(backend.url, startLimit);
            if (ratePerSecond !== undefined) this.governor.setRate(backend.url, ratePerSecond);
        }

        this.queue = new PriorityQueue<PendingRequest>({
            depthLimits,
            onExpire: (entry) => this.settle(entry.payload, "deadline", shedResponse("Request expired before dispatch")),
        });
        this.retryBudget = new RetryBudget({});
        this.retryDelayMs = retryDelayMs ?? RETRY.BASE_DELAY_MS;
    }

    /**
     * Queues a request and resolves once it has been answered, shed, expired, or cancelled.
     *
     * `signal` lets the caller withdraw a request that is still queued, which the HTTP layer
     * wires to the client connection closing. Cancellation applies only before dispatch: once a
     * request is in flight the upstream cost is already paid, so it runs to completion.
     */
    submit(request: ProxyRequest, signal?: AbortSignal): Promise<ProxyResponse> {
        return new Promise<ProxyResponse>((resolve) => {
            const pending: PendingRequest = { request, attempt: 0, id: ++this.lastRequestId, settled: false, resolve };

            if (this.stopped) {
                this.settle(pending, "shutting_down", shedResponse("swapiServe is shutting down"));
                return;
            }
            if (request.deadline <= this.clock.now()) {
                this.settle(pending, "deadline", shedResponse("Request expired before dispatch"));
                return;
            }

            const entry: QueueEntry<PendingRequest> = {
                priority: request.priority,
                deadline: request.deadline,
                enqueuedAt: this.clock.now(),
                cost: request.cost ?? 1,
                payload: pending,
            };

            if (!this.queue.enqueue(entry)) {
                this.settle(pending, "queue_overflow", shedResponse("swapiServe queue is full for this priority"));
                return;
            }

            signal?.addEventListener(
                "abort",
                () => {
                    // The queue discards cancelled entries on its next sweep; resolving here means
                    // the HTTP layer stops waiting immediately either way.
                    entry.cancelled = true;
                    this.settle(pending, "cancelled", shedResponse("Client cancelled the request"));
                },
                { once: true },
            );

            this.pump();
        });
    }

    /**
     * Applies an operator control action to a backend. Kept on the dispatcher so the HTTP layer
     * stays free of scheduling concepts and only does routing.
     */
    control(target: string, action: string, payload: Buffer | null): { ok: boolean; message: string } {
        const known = this.governor.snapshot().some((backend) => backend.url === target);
        if (!known) return { ok: false, message: `Unknown backend: ${target}` };

        switch (action) {
            case "drain":
                this.governor.drain(target);
                return { ok: true, message: `Draining ${target}` };
            case "enable":
                this.governor.enable(target);
                this.pump();
                return { ok: true, message: `Enabled ${target}` };
            case "set-limit": {
                const limit = readLimit(payload);
                if (limit === null) return { ok: false, message: 'Expected a JSON body of {"limit": <positive integer>}' };
                this.governor.setLimit(target, limit);
                this.pump();
                return { ok: true, message: `Set ${target} limit to ${limit}` };
            }
            default:
                return { ok: false, message: `Unknown action: ${action}` };
        }
    }

    status(): {
        backends: ReturnType<Governor["snapshot"]>;
        queue: ReturnType<PriorityQueue<PendingRequest>["metrics"]>;
        blocked: Record<BlockedBy, number>;
        terminal: Record<TerminalReason, number>;
        latencyMs: { mean: number; max: number };
        dispatches: number;
        retries: number;
        endpoints: Record<string, { count: number; meanLatencyMs: number; meanBytes: number }>;
    } {
        return {
            backends: this.governor.snapshot(),
            queue: this.queue.metrics(this.clock.now()),
            blocked: { ...this.blocked },
            terminal: { ...this.terminal },
            latencyMs: {
                mean: this.dispatchCount > 0 ? Math.round(this.latencyTotal / this.dispatchCount) : 0,
                max: this.latencyMax,
            },
            dispatches: this.dispatchCount,
            retries: this.retryCount,
            endpoints: Object.fromEntries(
                [...this.endpointCosts].map(([uri, cost]) => [
                    uri,
                    {
                        count: cost.count,
                        meanLatencyMs: Math.round(cost.totalLatencyMs / cost.count),
                        meanBytes: Math.round(cost.totalBytes / cost.count),
                    },
                ]),
            ),
        };
    }

    stop(): void {
        this.stopped = true;
        if (this.wakeup) {
            this.clock.clearTimeout(this.wakeup);
            this.wakeup = null;
        }
    }

    /** Dispatches as many queued requests as there are free backend slots. */
    private pump(): void {
        while (!this.stopped) {
            const now = this.clock.now();

            // Take the slot BEFORE taking the work. Dequeuing first and putting the entry back on
            // a full pool would append it to the tail of its tier, so a request could be starved
            // by later arrivals at its own priority.
            const { url: backendUrl, blockedBy } = this.governor.acquire(now);
            if (!backendUrl) {
                if (blockedBy) this.blocked[blockedBy]++;

                // No backend is usable at all, so holding the queue helps nobody. Without this,
                // work drains at the circuit-probe rate: one request every 15 seconds, each one
                // failing anyway, so a hundred callers would learn over 25 minutes what we knew
                // in the first second. Interactive callers would sit past their Discord token's
                // lifetime before hearing anything.
                if (blockedBy === "health") {
                    this.shedAll("No comlink backend is currently available");
                    return;
                }

                this.scheduleWakeup(now);
                return;
            }

            const next = this.queue.dequeue(now);
            if (!next) {
                // Nothing to send: hand the slot straight back. Deliberately not reported as a
                // success, because no request was made and it must not grow the limit.
                this.governor.releaseUnused(backendUrl);
                return;
            }

            void this.forward(next.payload, backendUrl);
        }
    }

    /**
     * Fails every waiting request at once, for when no backend can serve any of them.
     *
     * The circuit probe keeps running on its own cadence, so normal service resumes the moment a
     * probe succeeds; requests arriving during the outage are shed the same way, except the one
     * that happens to arrive after the probe interval has elapsed, which becomes the next probe.
     */
    private shedAll(reason: string): void {
        for (const entry of this.queue.drainAll()) {
            this.settle(entry.payload, "backend_unavailable", shedResponse(reason));
        }
    }

    /**
     * Wakes the queue when nothing else will.
     *
     * A slot-blocked queue is woken by the next completion, but a rate-blocked one has no such
     * event coming (every slot can be idle while work waits on tokens), and neither does a pool
     * whose circuits are all open. Only one timer is kept outstanding, so a deep queue does not
     * schedule thousands of them.
     */
    private scheduleWakeup(now: number): void {
        if (this.wakeup || this.queue.size() === 0) return;

        const wait = this.governor.nextAvailableAt(now);
        if (wait === null) return;

        this.wakeup = this.clock.setTimeout(() => {
            this.wakeup = null;
            this.pump();
        }, wait);
        this.wakeup.unref?.();
    }

    private async forward(pending: PendingRequest, backendUrl: string): Promise<void> {
        const { request } = pending;

        const startedAt = this.clock.now();
        this.retryBudget.recordDispatch(startedAt);
        this.dispatchCount++;

        const { status, headers: responseHeaders, body } = await this.forwarder(backendUrl, request);

        const outcome = classifyOutcome(status, status !== undefined && status >= 400 ? readMessage(body) : undefined);
        const now = this.clock.now();
        this.governor.report(backendUrl, outcome, now);

        const latency = now - startedAt;
        this.latencyTotal += latency;
        if (latency > this.latencyMax) this.latencyMax = latency;
        this.recordEndpointCost(request.uri, latency, body.length);

        if (this.shouldRetry(pending, outcome, now)) {
            pending.attempt++;
            this.retryCount++;
            const backoffMs = Math.max(this.retryDelayMs * pending.attempt, readRetryAfterMs(responseHeaders));

            this.clock.setTimeout(() => {
                if (this.stopped) {
                    this.settle(pending, "shutting_down", shedResponse("swapiServe is shutting down"));
                    return;
                }
                // A retry is the same request with attempt incremented, re-entering the same
                // queue with the same id. There is no separate retry path or retry queue.
                const requeued = this.queue.enqueue({
                    priority: request.priority,
                    deadline: request.deadline,
                    enqueuedAt: this.clock.now(),
                    cost: request.cost ?? 1,
                    payload: pending,
                });
                if (!requeued) {
                    this.settle(pending, "queue_overflow", shedResponse("swapiServe queue is full for this priority"));
                }
                this.pump();
            }, backoffMs);
            return;
        }

        if (status === undefined) {
            this.settle(pending, "upstream_error", shedResponse("Upstream request failed"));
        } else {
            this.settle(pending, "completed", { status, headers: responseHeaders, body });
        }
        this.pump();
    }

    private shouldRetry(pending: PendingRequest, outcome: Outcome, now: number): boolean {
        if (!isRetryable(outcome)) return false;
        if (pending.attempt >= RETRY.ATTEMPTS) return false;
        if (pending.request.deadline <= now) return false;
        return this.retryBudget.tryConsume(now);
    }

    /**
     * The single place a request leaves the system. Everything resolves through here so the
     * terminal-reason counters can never drift from reality.
     */
    private settle(pending: PendingRequest, reason: TerminalReason, response: ProxyResponse): void {
        if (pending.settled) return;
        pending.settled = true;
        this.terminal[reason]++;
        pending.resolve(response);
    }

    /**
     * Per-endpoint cost accounting.
     *
     * Every request currently counts the same against the budget, but they are unlikely to be
     * equal: a player pull and a full guild pull are very different amounts of upstream work.
     * Weighted costs are deliberately NOT implemented yet. Recording the evidence now means the
     * decision can later be made from data instead of from a guess.
     */
    private recordEndpointCost(uri: string, latencyMs: number, bytes: number): void {
        const existing = this.endpointCosts.get(uri) ?? { count: 0, totalLatencyMs: 0, totalBytes: 0 };
        existing.count++;
        existing.totalLatencyMs += latencyMs;
        existing.totalBytes += bytes;
        this.endpointCosts.set(uri, existing);
    }
}

/** Reads a positive integer `limit` from a control-request body, or null when absent/invalid. */
function readLimit(payload: Buffer | null): number | null {
    if (!payload) return null;
    try {
        const parsed: unknown = JSON.parse(payload.toString());
        if (typeof parsed !== "object" || parsed === null || !("limit" in parsed)) return null;
        const { limit } = parsed as { limit: unknown };
        return typeof limit === "number" && Number.isInteger(limit) && limit > 0 ? limit : null;
    } catch {
        return null;
    }
}

/**
 * Reads an upstream Retry-After header, in seconds, as milliseconds. Returns 0 when absent or
 * unparseable, so the caller falls back to its own backoff.
 */
function readRetryAfterMs(headers: Record<string, string>): number {
    const seconds = Number(headers["retry-after"]);
    return Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : 0;
}

/**
 * Best-effort read of an error body's `message` field. Only called for non-2xx responses, where
 * the outcome rules need the text to tell "Failed to find ally code" apart from a rejection.
 * Any parse failure simply means the textual rules do not apply.
 */
function readMessage(body: Buffer): string | undefined {
    try {
        const parsed: unknown = JSON.parse(body.toString());
        if (typeof parsed === "object" && parsed !== null && "message" in parsed) {
            const { message } = parsed as { message: unknown };
            return typeof message === "string" ? message : undefined;
        }
    } catch {
        return undefined;
    }
    return undefined;
}
