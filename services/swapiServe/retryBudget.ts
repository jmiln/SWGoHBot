import { PRIORITY_COUNT, type Priority, RETRY } from "../../data/constants/swapiServe.ts";

export interface RetryBudgetMetrics {
    /** Retries allowed, per tier, within the current window. */
    granted: number[];
    /** Retries refused for want of budget, per tier. Cumulative, not windowed. */
    denied: number[];
}

/**
 * Caps retries as a fraction of dispatches over a rolling window, kept per priority tier.
 *
 * Replaces the per-batch createRetryBudget in modules/swapi.ts, which has no meaning in a service
 * that never sees a batch. The intent carries over unchanged: an isolated blip should retry freely,
 * but a comlink-wide outage classifies as transient for every request at once, and without a ceiling
 * every one of them would pay full retries plus backoff simultaneously.
 *
 * The accounting is per tier because a single shared allowance is a priority inversion, and it was
 * the last one left in the design. Slots, queue depth and deadlines are all tiered; a shared retry
 * pool let a nightly dataUpdater cycle spend the allowance funded by the arena tick's own
 * dispatches, so a tick request hitting one transient 502 mid-cycle could not be retried. That drops
 * the account's payout alert, and since the payout cycle and the poll interval are exact multiples,
 * it is the same minute every day. Each tier now funds its own retries and can never spend another
 * tier's, so bulk work cannot crowd out the tick no matter how much of it is running.
 */
export class RetryBudget {
    private readonly windowMs: number;
    private readonly maxFraction: number;
    private readonly minInWindow: number;
    private dispatches: number[][] = Array.from({ length: PRIORITY_COUNT }, () => []);
    private retries: number[][] = Array.from({ length: PRIORITY_COUNT }, () => []);
    private readonly denied = new Array(PRIORITY_COUNT).fill(0);

    constructor({ windowMs, maxFraction, minInWindow }: { windowMs?: number; maxFraction?: number; minInWindow?: number } = {}) {
        this.windowMs = windowMs ?? RETRY.WINDOW_MS;
        this.maxFraction = maxFraction ?? RETRY.MAX_FRACTION_OF_DISPATCHES;
        this.minInWindow = minInWindow ?? RETRY.MIN_IN_WINDOW;
    }

    recordDispatch(priority: Priority, now: number): void {
        this.dispatches[priority].push(now);
        this.prune(priority, now);
    }

    /** Consumes one retry allowance from the tier's own budget, false when that budget is spent. */
    tryConsume(priority: Priority, now: number): boolean {
        this.prune(priority, now);
        // The floor matters more than the fraction at low traffic: without it an isolated failure
        // on a quiet tier is never retried, since 25 percent of one dispatch is zero. Applied per
        // tier, so the tick keeps its floor however busy the tiers below it are.
        const allowed = Math.max(this.minInWindow, Math.floor(this.dispatches[priority].length * this.maxFraction));
        if (this.retries[priority].length >= allowed) {
            this.denied[priority]++;
            return false;
        }
        this.retries[priority].push(now);
        return true;
    }

    /**
     * Per-tier retry accounting for the status endpoint.
     *
     * `denied` is the number that says whether the fraction is set correctly: a tier denying retries
     * while the backends are healthy is a tier whose allowance is too small for its failure rate,
     * and it is the shape a starved tier would show if this were ever shared again.
     */
    metrics(): RetryBudgetMetrics {
        return {
            granted: this.retries.map((tier) => tier.length),
            denied: [...this.denied],
        };
    }

    private prune(priority: Priority, now: number): void {
        const cutoff = now - this.windowMs;
        this.dispatches[priority] = this.dispatches[priority].filter((at) => at > cutoff);
        this.retries[priority] = this.retries[priority].filter((at) => at > cutoff);
    }
}
