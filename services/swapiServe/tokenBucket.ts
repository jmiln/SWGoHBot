import { RATE } from "../../data/constants/swapiServe.ts";

const MS_PER_SECOND = 1000;

/**
 * Classic leaky-bucket rate limiter with a lazily computed refill, paired with the Governor's
 * concurrency limit.
 *
 * Refill is computed from elapsed time on each call rather than on a timer, so an idle bucket
 * costs nothing and there is no interval to clean up on shutdown.
 */
export class TokenBucket {
    private ratePerSecond: number;
    private readonly burstFactor: number;
    private tokens: number;
    private lastRefillAt = 0;

    constructor({ ratePerSecond, burstFactor }: { ratePerSecond?: number; burstFactor?: number } = {}) {
        this.ratePerSecond = ratePerSecond ?? RATE.START_PER_SEC;
        this.burstFactor = burstFactor ?? RATE.BURST_FACTOR;
        this.tokens = this.capacity();
    }

    /** Takes one token if available. Returns false when the caller must wait. */
    tryTake(now: number): boolean {
        this.refill(now);
        if (this.tokens < 1) return false;
        this.tokens--;
        return true;
    }

    /** Milliseconds until at least one token is available; 0 when one already is. */
    msUntilNextToken(now: number): number {
        this.refill(now);
        if (this.tokens >= 1) return 0;
        const missing = 1 - this.tokens;
        return Math.ceil((missing / this.ratePerSecond) * MS_PER_SECOND);
    }

    setRate(perSecond: number): void {
        this.ratePerSecond = Math.max(RATE.MIN_PER_SEC, Math.min(RATE.MAX_PER_SEC, perSecond));
        // A lowered rate lowers the burst ceiling too, so banked tokens must not exceed it.
        this.tokens = Math.min(this.tokens, this.capacity());
    }

    getRate(): number {
        return this.ratePerSecond;
    }

    /** Returns a token taken for a request that was never made. */
    refund(): void {
        this.tokens = Math.min(this.capacity(), this.tokens + 1);
    }

    private capacity(): number {
        return this.ratePerSecond * this.burstFactor;
    }

    private refill(now: number): void {
        const elapsedMs = now - this.lastRefillAt;
        if (elapsedMs <= 0) return;
        this.lastRefillAt = now;
        this.tokens = Math.min(this.capacity(), this.tokens + (elapsedMs / MS_PER_SECOND) * this.ratePerSecond);
    }
}
