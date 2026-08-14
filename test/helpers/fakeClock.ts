import type { Clock, TimerHandle } from "../../services/swapiServe/clock.ts";

interface ScheduledTimer extends TimerHandle {
    dueAt: number;
    fn: () => void;
    cancelled: boolean;
}

/**
 * Virtual clock for deterministic scheduler tests.
 *
 * `advance` moves time forward and fires every timer due in that window, in due order, including
 * timers scheduled by the callbacks it fires. That last part matters: retry backoff and rate
 * wakeups schedule further timers, and a clock that ignored them would silently stall.
 */
export class FakeClock implements Clock {
    private current: number;
    private timers: ScheduledTimer[] = [];

    constructor(startAt = 0) {
        this.current = startAt;
    }

    now(): number {
        return this.current;
    }

    setTimeout(fn: () => void, ms: number): TimerHandle {
        const timer: ScheduledTimer = { dueAt: this.current + Math.max(0, ms), fn, cancelled: false };
        this.timers.push(timer);
        return timer;
    }

    clearTimeout(handle: TimerHandle): void {
        (handle as ScheduledTimer).cancelled = true;
    }

    /**
     * Advances virtual time, firing every timer that comes due along the way.
     *
     * Timers scheduled by the callbacks this fires are picked up in the same pass, which matters
     * because retry backoff and rate wakeups schedule further timers: a clock that ignored them
     * would appear to stall.
     *
     * Cancelled timers are dropped here rather than left marked. Leaving them accumulates every
     * timer the run ever created, which turns each advance into a scan of the whole history and
     * makes a long simulation quadratic.
     */
    advance(ms: number): void {
        const target = this.current + ms;

        for (;;) {
            let dueIndex = -1;
            let keep = 0;
            for (let i = 0; i < this.timers.length; i++) {
                const timer = this.timers[i];
                if (timer.cancelled) continue;
                this.timers[keep] = timer;
                if (timer.dueAt <= target && (dueIndex === -1 || timer.dueAt < this.timers[dueIndex].dueAt)) {
                    dueIndex = keep;
                }
                keep++;
            }
            this.timers.length = keep;

            if (dueIndex === -1) break;

            const due = this.timers[dueIndex];
            this.timers.splice(dueIndex, 1);
            this.current = due.dueAt;
            due.fn();
        }

        this.current = target;
    }

    /** Lets already-resolved promises settle between advances. */
    async flush(): Promise<void> {
        await new Promise((resolve) => setImmediate(resolve));
    }

    pendingTimers(): number {
        return this.timers.filter((timer) => !timer.cancelled).length;
    }
}
