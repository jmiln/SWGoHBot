import { GOVERNOR, type Priority, RETRY } from "../../data/constants/swapiServe.ts";
import logger from "../../modules/Logger.ts";
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
    /**
     * The queue entry currently holding this request, or null while it is in flight or waiting out
     * a retry. A retry re-enters the queue as a NEW entry, so cancellation has to follow the
     * request rather than the entry it happened to be in when the caller first submitted it.
     */
    entry: QueueEntry<PendingRequest> | null;
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
    /** Mirrors the Governor's probe cadence, which is the horizon shedDoomed measures against. */
    private readonly probeIntervalMs: number;
    private readonly endpointCosts = new Map<string, { count: number; totalLatencyMs: number; totalBytes: number }>();
    private stopped = false;
    private wakeup: TimerHandle | null = null;
    /** Epoch ms the outstanding wakeup is due, so a nearer need can bring it forward. */
    private wakeupAt = 0;
    /**
     * Requests waiting out a retry backoff, which are held by a timer rather than by the queue and
     * so cannot be reached by draining it. Tracked so shutdown can settle them too: a Retry-After
     * honoured from upstream can be tens of seconds, and every one of those is a socket the HTTP
     * layer is still holding open.
     */
    private readonly retryTimers = new Map<TimerHandle, PendingRequest>();
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
        this.probeIntervalMs = circuitProbeIntervalMs ?? GOVERNOR.CIRCUIT_PROBE_INTERVAL_MS;
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
            const pending: PendingRequest = { request, attempt: 0, id: ++this.lastRequestId, settled: false, entry: null, resolve };

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
            pending.entry = entry;

            signal?.addEventListener(
                "abort",
                () => {
                    // Marks whichever entry currently holds the request, which after a retry is
                    // not the one created above. The queue discards cancelled entries on its next
                    // sweep; resolving here means the HTTP layer stops waiting immediately either
                    // way, and settling first is what stops any further retry being scheduled.
                    this.settle(pending, "cancelled", shedResponse("Client cancelled the request"));
                    if (pending.entry) pending.entry.cancelled = true;
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
        retryBudget: ReturnType<RetryBudget["metrics"]>;
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
            retryBudget: this.retryBudget.metrics(),
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

    /**
     * Stops dispatching and answers everything still waiting.
     *
     * Draining the queue is what makes shutdown terminate. A queued request is a caller holding an
     * unresolved promise, which for the HTTP layer is a response that never ends and a socket that
     * never closes, so server.close() would wait on it forever and the process would only die to
     * SIGKILL. Requests already in flight are left alone: the upstream cost is paid either way and
     * they settle on their own, which is what makes this a graceful stop rather than an abort.
     */
    stop(): void {
        this.stopped = true;
        if (this.wakeup) {
            this.clock.clearTimeout(this.wakeup);
            this.wakeup = null;
        }
        for (const [timer, pending] of this.retryTimers) {
            this.clock.clearTimeout(timer);
            this.settle(pending, "shutting_down", shedResponse("swapiServe is shutting down"));
        }
        this.retryTimers.clear();

        for (const entry of this.queue.drainAll()) {
            this.settle(entry.payload, "shutting_down", shedResponse("swapiServe is shutting down"));
        }
    }

    /** Dispatches as many queued requests as there are free backend slots. */
    private pump(): void {
        while (!this.stopped) {
            const now = this.clock.now();

            // Take the slot BEFORE taking the work. Dequeuing first and putting the entry back on
            // a full pool would append it to the tail of its tier, so a request could be starved
            // by later arrivals at its own priority.
            const { url: backendUrl, blockedBy, isProbe } = this.governor.acquire(now);
            if (!backendUrl) {
                if (blockedBy) this.blocked[blockedBy]++;

                // No backend is usable at all, so anyone who cannot outlive the outage is told now
                // rather than later. Without this, work drains at the circuit-probe rate: one
                // request every 15 seconds, each one failing anyway, so a hundred callers would
                // learn over 25 minutes what we knew in the first second, and interactive callers
                // would sit past their Discord token's lifetime before hearing anything.
                if (blockedBy === "health") {
                    this.shedDoomed(now);
                    this.scheduleWakeup(now);
                    return;
                }

                // Deadlines are enforced on the way to a dispatch, and there is no dispatch to ride
                // along with here, so they are swept explicitly. A backend that hangs rather than
                // fails never trips the breaker, so it holds every slot for the full upstream
                // timeout: without this the queue behind it goes stale and its callers wait out the
                // hang instead of their own deadline.
                this.queue.sweepExpired(now);
                this.scheduleWakeup(now);
                return;
            }

            const next = this.queue.dequeue(now);
            if (!next) {
                // Nothing to send: hand the slot straight back. Deliberately not reported as a
                // success, because no request was made and it must not grow the limit.
                this.governor.releaseUnused(backendUrl, isProbe);
                return;
            }

            // No longer queued, so a later cancellation has nothing to mark: the request is about
            // to be in flight and the upstream cost is paid either way.
            next.payload.entry = null;
            void this.forward(next.payload, backendUrl, isProbe === true);
        }
    }

    /**
     * Fails the waiting requests that cannot survive long enough to be served, for when no backend
     * can serve any of them right now.
     *
     * The cutoff is one probe interval, because a probe is the only thing that can restore service:
     * a request expiring before the next one lands cannot be served whatever happens, so telling
     * its caller immediately costs nothing and saves it a pointless wait. Anything with more
     * headroom keeps its place, which is the whole of what bulk work wants. Its deadline is ten
     * minutes against a fifteen-second probe, nothing is watching it, and re-running a nightly
     * cycle is far more expensive than waiting out a blip. Shedding those too turned every
     * transient outage into a failed dataUpdater run.
     *
     * Requests that keep their place are re-examined on the next pump, so a probe that fails
     * simply sheds the next tranche as their deadlines come into range.
     */
    private shedDoomed(now: number): void {
        const cutoff = now + this.probeIntervalMs;
        for (const entry of this.queue.drainWhere((waiting) => waiting.deadline <= cutoff)) {
            this.settle(entry.payload, "backend_unavailable", shedResponse("No comlink backend is currently available"));
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
        if (this.queue.size() === 0) return;

        const wait = this.nextWakeupDelay(now);
        if (wait === null) return;

        // An armed timer is kept unless the new need lands sooner, which keeps a deep queue from
        // scheduling thousands of them while still answering a request whose deadline falls inside
        // an already-armed wait.
        const dueAt = now + wait;
        if (this.wakeup) {
            if (dueAt >= this.wakeupAt) return;
            this.clock.clearTimeout(this.wakeup);
        }

        this.wakeupAt = dueAt;
        this.wakeup = this.clock.setTimeout(() => {
            this.wakeup = null;
            this.pump();
        }, wait);
        this.wakeup.unref?.();
    }

    /**
     * How long until the queue next needs attention: the sooner of capacity freeing up and the next
     * queued deadline passing.
     *
     * The deadline half is not redundant. A saturated pool reports no capacity time at all, because
     * a backend with no free slot has no time to report: it is waiting on a completion, and a
     * wedged backend's completion is a minute away. Meanwhile the callers behind it have deadlines
     * of fifteen seconds, and those have to be answered on their own schedule.
     */
    private nextWakeupDelay(now: number): number | null {
        const capacityWait = this.governor.nextAvailableAt(now);
        const earliestDeadline = this.queue.earliestDeadline();
        if (earliestDeadline === null) return capacityWait;

        const deadlineWait = Math.max(0, earliestDeadline - now);
        return capacityWait === null ? deadlineWait : Math.min(capacityWait, deadlineWait);
    }

    /**
     * Sends one request and settles it, retries it, or hands it back to the queue.
     *
     * `isProbe` says whether the slot this request holds is the half-open circuit's probe, which the
     * governor cannot work out for itself once more than one request is in flight. It is carried
     * here rather than on PendingRequest because it describes the dispatch, not the request: a retry
     * is the same request acquiring a different slot, which may or may not be a probe in its turn.
     */
    private async forward(pending: PendingRequest, backendUrl: string, isProbe: boolean): Promise<void> {
        const { request } = pending;

        const startedAt = this.clock.now();
        this.retryBudget.recordDispatch(request.priority, startedAt);
        this.dispatchCount++;

        let result: Awaited<ReturnType<Forwarder>>;
        try {
            result = await this.forwarder(backendUrl, request);
        } catch (err) {
            // The production forwarder resolves even for transport errors and timeouts, so
            // reaching here means a defect on our side rather than anything the backend did.
            //
            // Handing the slot back matters more than what caused it: the slot was taken before
            // the forward and is only returned by reporting an outcome, so without this it is lost
            // for the process's lifetime. With MIN_LIMIT at 1, a few of these wedge the backend
            // entirely and nothing in the design ever recovers it. releaseUnused rather than
            // report, because blaming the backend's health for our bug would halve the limit of a
            // backend that may be perfectly healthy.
            this.governor.releaseUnused(backendUrl, isProbe);
            logger.error(`SwapiServe: Forwarder threw for ${request.uri}: ${err instanceof Error ? err.message : String(err)}`);
            this.settle(pending, "upstream_error", shedResponse("Upstream request failed"));
            this.pump();
            return;
        }

        const { status, headers: responseHeaders, body } = result;

        const outcome = classifyOutcome(status, status !== undefined && status >= 400 ? readMessage(body) : undefined);
        const now = this.clock.now();
        this.governor.report(backendUrl, outcome, now, isProbe);

        const latency = now - startedAt;
        this.latencyTotal += latency;
        if (latency > this.latencyMax) this.latencyMax = latency;
        this.recordEndpointCost(request.uri, latency, body.length);

        if (this.shouldRetry(pending, outcome, now)) {
            pending.attempt++;
            this.retryCount++;
            const backoffMs = Math.max(this.retryDelayMs * pending.attempt, readRetryAfterMs(responseHeaders));

            const timer = this.clock.setTimeout(() => {
                this.retryTimers.delete(timer);
                if (this.stopped) {
                    this.settle(pending, "shutting_down", shedResponse("swapiServe is shutting down"));
                    return;
                }
                // The caller went away while the backoff was running, so this retry now has
                // nobody to answer. Re-queueing it would spend a slot on a discarded response.
                if (pending.settled) return;

                // A retry is the same request with attempt incremented, re-entering the same
                // queue with the same id. There is no separate retry path or retry queue.
                const entry: QueueEntry<PendingRequest> = {
                    priority: request.priority,
                    deadline: request.deadline,
                    enqueuedAt: this.clock.now(),
                    cost: request.cost ?? 1,
                    payload: pending,
                };
                if (!this.queue.enqueue(entry)) {
                    this.settle(pending, "queue_overflow", shedResponse("swapiServe queue is full for this priority"));
                } else {
                    pending.entry = entry;
                }
                this.pump();
            }, backoffMs);
            this.retryTimers.set(timer, pending);
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
        // Already answered, which for a request still in flight means the caller cancelled or the
        // service is shutting down. Retrying would spend upstream budget on a response nobody is
        // waiting for, which is the exact cost cancellation exists to avoid.
        if (pending.settled) return false;

        // Requests in flight when stop() ran are left to finish, but their failures must not start
        // a new backoff: the retry timers were drained once already, so a timer armed after that
        // holds its caller, and the socket behind it, until it fires. Upstream sets that wait with
        // Retry-After and it can be tens of seconds, well past the shutdown grace period, which
        // turns a graceful stop into a SIGKILL. Answering with the failure we have is both faster
        // and truer: the service is going away and is not going to send this again.
        if (this.stopped) return false;
        if (!isRetryable(outcome)) return false;
        if (pending.attempt >= RETRY.ATTEMPTS) return false;
        if (pending.request.deadline <= now) return false;
        // Drawn against the request's own tier, so a nightly bulk run cannot spend the allowance the
        // payout tick depends on.
        return this.retryBudget.tryConsume(pending.request.priority, now);
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
