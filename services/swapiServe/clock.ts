export interface TimerHandle {
    /** Present on real timers; the fake clock returns a plain token. */
    unref?: () => void;
}

/**
 * The scheduler's only access to time.
 *
 * Injecting it is what lets the simulator and the invariant stress test run hundreds of thousands
 * of requests deterministically in milliseconds instead of waiting out real delays, and it removes
 * the sleep-and-hope pattern from tests of retry backoff and rate pacing.
 */
export interface Clock {
    now(): number;
    setTimeout(fn: () => void, ms: number): TimerHandle;
    clearTimeout(handle: TimerHandle): void;
}

export const systemClock: Clock = {
    now: () => Date.now(),
    setTimeout: (fn, ms) => setTimeout(fn, ms),
    clearTimeout: (handle) => clearTimeout(handle as NodeJS.Timeout),
};
