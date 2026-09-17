import { STATUS_WINDOW } from "../../data/constants/swapiServe.ts";

export interface WindowSeries {
    count: number;
    perSecond: number;
    mean: number;
    max: number;
}

export interface WindowMetrics {
    /** How much time the figures below actually span, which is under WINDOW_MS on a young service. */
    coveredMs: number;
    series: Record<string, WindowSeries>;
}

interface SeriesTotals {
    count: number;
    sum: number;
    max: number;
}

interface Bucket {
    startedAt: number;
    series: Map<string, SeriesTotals>;
}

/**
 * Counts and averages over a trailing span, so a stateless poller reads a rate and a recent peak
 * without differencing two samples of its own. Bucketed rather than a pair of periodically-rotated
 * snapshots: buckets expire by timestamp, so a long gap between reads self-corrects instead of
 * reporting a window the service never observed.
 */
export class RollingWindow {
    private readonly windowMs: number;
    private readonly bucketMs: number;
    private buckets: Bucket[] = [];

    constructor({ windowMs, bucketMs }: { windowMs?: number; bucketMs?: number } = {}) {
        this.windowMs = windowMs ?? STATUS_WINDOW.WINDOW_MS;
        this.bucketMs = bucketMs ?? STATUS_WINDOW.BUCKET_MS;
    }

    record(name: string, value: number, now: number): void {
        const bucket = this.currentBucket(now);
        const totals = bucket.series.get(name);
        if (!totals) {
            bucket.series.set(name, { count: 1, sum: value, max: value });
            return;
        }
        totals.count++;
        totals.sum += value;
        if (value > totals.max) totals.max = value;
    }

    metrics(now: number): WindowMetrics {
        this.expire(now);

        const merged = new Map<string, SeriesTotals>();
        for (const bucket of this.buckets) {
            for (const [name, totals] of bucket.series) {
                const into = merged.get(name);
                if (!into) {
                    merged.set(name, { ...totals });
                    continue;
                }
                into.count += totals.count;
                into.sum += totals.sum;
                if (totals.max > into.max) into.max = totals.max;
            }
        }

        const coveredMs = this.coveredMs(now);
        const series: Record<string, WindowSeries> = {};
        for (const [name, totals] of merged) {
            series[name] = {
                count: totals.count,
                perSecond: (totals.count * 1000) / coveredMs,
                mean: Math.round(totals.sum / totals.count),
                max: totals.max,
            };
        }

        return { coveredMs, series };
    }

    /** Floored at one bucket, or a service seconds old divides a few samples by a millisecond. */
    private coveredMs(now: number): number {
        const oldest = this.buckets[0];
        if (!oldest) return this.windowMs;
        return Math.min(this.windowMs, Math.max(this.bucketMs, now - oldest.startedAt));
    }

    private currentBucket(now: number): Bucket {
        this.expire(now);

        const startedAt = now - (now % this.bucketMs);
        const latest = this.buckets[this.buckets.length - 1];
        if (latest?.startedAt === startedAt) return latest;

        const bucket: Bucket = { startedAt, series: new Map() };
        this.buckets.push(bucket);
        return bucket;
    }

    private expire(now: number): void {
        const cutoff = now - this.windowMs;
        while (this.buckets.length > 0 && this.buckets[0].startedAt <= cutoff) this.buckets.shift();
    }
}
