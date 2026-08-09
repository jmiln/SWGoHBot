import { RETRY } from "../../data/constants/swapiServe.ts";

/**
 * Caps retries as a fraction of dispatches over a rolling window.
 *
 * Replaces the per-batch createRetryBudget in modules/swapi.ts, which has no meaning in a service
 * that never sees a batch. The intent carries over unchanged: an isolated blip should retry
 * freely, but a comlink-wide outage classifies as transient for every request at once, and
 * without a ceiling every one of them would pay full retries plus backoff simultaneously.
 */
export class RetryBudget {
    private readonly windowMs: number;
    private readonly maxFraction: number;
    private readonly minInWindow: number;
    private dispatches: number[] = [];
    private retries: number[] = [];

    constructor({ windowMs, maxFraction, minInWindow }: { windowMs?: number; maxFraction?: number; minInWindow?: number } = {}) {
        this.windowMs = windowMs ?? RETRY.WINDOW_MS;
        this.maxFraction = maxFraction ?? RETRY.MAX_FRACTION_OF_DISPATCHES;
        this.minInWindow = minInWindow ?? RETRY.MIN_IN_WINDOW;
    }

    recordDispatch(now: number): void {
        this.dispatches.push(now);
        this.prune(now);
    }

    /** Consumes one retry allowance, returning false when the window's budget is spent. */
    tryConsume(now: number): boolean {
        this.prune(now);
        // The floor matters more than the fraction at low traffic: without it an isolated
        // failure on a quiet service is never retried, since 25 percent of one dispatch is zero.
        const allowed = Math.max(this.minInWindow, Math.floor(this.dispatches.length * this.maxFraction));
        if (this.retries.length >= allowed) return false;
        this.retries.push(now);
        return true;
    }

    private prune(now: number): void {
        const cutoff = now - this.windowMs;
        this.dispatches = this.dispatches.filter((at) => at > cutoff);
        this.retries = this.retries.filter((at) => at > cutoff);
    }
}
