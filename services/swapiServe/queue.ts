import { PRIORITY_COUNT, type Priority, QUEUE } from "../../data/constants/swapiServe.ts";

export interface QueueEntry<T> {
    priority: Priority;
    /** Epoch ms after which this request is pointless to send. */
    deadline: number;
    /** Epoch ms the entry joined the queue. Set by enqueue; drives the wait-time metrics. */
    enqueuedAt: number;
    /** Set to true by the owner when the client goes away; checked before dispatch. */
    cancelled?: boolean;
    /** Upstream budget this entry consumes. Always 1 today; see ProxyRequest.cost. */
    cost: number;
    payload: T;
}

export interface QueueMetrics {
    depths: number[];
    /** Age in ms of the oldest entry waiting in each tier. */
    oldestAgeMs: number[];
    /** Mean wait before dispatch per tier, over the entries dispatched so far. */
    meanWaitMs: number[];
    /** Longest wait before dispatch seen per tier. */
    maxWaitMs: number[];
    droppedExpired: number[];
    droppedCancelled: number[];
}

/**
 * Per-tier FIFO queues with deadline dropping, cancellation, and credit-based reservations.
 *
 * Strict priority alone cuts both ways: it would let a busy bot starve dataUpdater into
 * permanently stale game data, and it would let an arena spike head-of-line block live users. So
 * every tier carries a reserved share of service that higher tiers cannot take from it.
 *
 * Selection is two questions, in order:
 *   1. Is any tier below its guaranteed share? Serve the highest-priority one of those.
 *   2. Otherwise serve the highest-priority tier with work.
 *
 * "Below its share" is measured with a service credit borrowed from Weighted Deficit Round Robin
 * rather than with an instantaneous count or a rolling time window. Every dispatch grants each
 * tier its share of that work as credit and charges the served tier the cost; a tier owed at
 * least one request's worth of service is underserved. That integrates over time instead of
 * sampling, so a burst does not read as permanent unfairness and there are no window boundaries
 * to sit awkwardly across. Credits are clamped so an idle tier cannot bank unlimited claim and
 * then monopolise the queue when it wakes up.
 *
 * A reservation remains a floor, never a cap: arenaTick keeps strict precedence whenever nothing
 * is underserved, because the tick must land inside its minute. Unused share is immediately
 * available to everyone else, so a quiet tier costs nothing.
 */
export class PriorityQueue<T> {
    private readonly buckets: QueueEntry<T>[][] = Array.from({ length: PRIORITY_COUNT }, () => []);
    private readonly depthLimits: readonly number[];
    private readonly reservedShares: readonly number[];
    private readonly credits = new Array(PRIORITY_COUNT).fill(0);
    private readonly maxCredit: number;
    private readonly onExpire?: (entry: QueueEntry<T>) => void;
    private readonly waitTotals = new Array(PRIORITY_COUNT).fill(0);
    private readonly waitCounts = new Array(PRIORITY_COUNT).fill(0);
    private readonly waitMaxes = new Array(PRIORITY_COUNT).fill(0);
    private readonly droppedExpired = new Array(PRIORITY_COUNT).fill(0);
    private readonly droppedCancelled = new Array(PRIORITY_COUNT).fill(0);

    constructor({
        depthLimits,
        reservedShares,
        maxCredit,
        onExpire,
    }: {
        depthLimits?: readonly number[];
        reservedShares?: readonly number[];
        maxCredit?: number;
        onExpire?: (entry: QueueEntry<T>) => void;
    }) {
        this.depthLimits = depthLimits ?? QUEUE.DEPTH_LIMITS;
        this.reservedShares = reservedShares ?? QUEUE.RESERVED_SHARES;
        this.maxCredit = maxCredit ?? QUEUE.MAX_CREDIT;
        this.onExpire = onExpire;
    }

    /** Returns false when the tier is full, so the caller can shed the request immediately. */
    enqueue(entry: QueueEntry<T>): boolean {
        const bucket = this.buckets[entry.priority];
        if (bucket.length >= this.depthLimits[entry.priority]) return false;
        bucket.push(entry);
        return true;
    }

    /**
     * Picks the next entry to dispatch, dropping anything expired or cancelled along the way.
     *
     * Needs nothing from the backend manager: the credit accounting is self-contained, which is
     * what keeps scheduling policy and backend health as separate concerns.
     */
    dequeue(now: number): QueueEntry<T> | null {
        this.dropExpired(now);

        let firstWaiting: Priority | null = null;
        for (let priority = 0; priority < PRIORITY_COUNT; priority++) {
            if (this.buckets[priority].length === 0) continue;

            // Scanning high to low means the first underserved tier found is also the
            // highest-priority one, so priority still decides among tiers owed service.
            if (this.credits[priority] >= this.buckets[priority][0].cost) {
                return this.take(priority as Priority, now);
            }
            if (firstWaiting === null) firstWaiting = priority as Priority;
        }

        // Nobody is owed service, so the highest-priority tier with work wins outright. This is
        // the case that keeps arenaTick first in the ordinary course of events.
        if (firstWaiting === null) return null;
        return this.take(firstWaiting, now);
    }

    private take(priority: Priority, now: number): QueueEntry<T> | null {
        const entry = this.buckets[priority].shift();
        if (!entry) return null;
        this.charge(priority, entry.cost);
        this.recordWait(priority, now - entry.enqueuedAt);
        return entry;
    }

    /**
     * Credit accounting, borrowed from Weighted Deficit Round Robin.
     *
     * Serving `cost` units of work grants every tier its configured share of that work and
     * charges the served tier the full amount. A tier receiving exactly its share stays near
     * zero; one receiving less drifts positive and becomes underserved; one receiving more drifts
     * negative and yields. Clamping both ends stops an idle tier banking unlimited claim, and
     * stops a heavily served tier being locked out for a long stretch afterwards.
     */
    private charge(served: Priority, cost: number): void {
        for (let priority = 0; priority < PRIORITY_COUNT; priority++) {
            const earned = this.credits[priority] + this.reservedShares[priority] * cost - (priority === served ? cost : 0);
            this.credits[priority] = Math.max(-this.maxCredit, Math.min(this.maxCredit, earned));
        }
    }

    /**
     * Removes and returns every waiting entry, for when no backend can serve them at all.
     *
     * Deliberately does not charge service credit or record a wait: nothing was served, and
     * counting a mass failure as service would leave the affected tiers looking over-served once
     * the backends recover.
     */
    drainAll(): QueueEntry<T>[] {
        return this.drainWhere(() => true);
    }

    /**
     * Removes the entries matching `predicate` and returns the ones with a caller still waiting.
     *
     * Cancelled entries are dropped without being returned, the same as in a full drain: their
     * caller has already been answered, so handing them back would settle them twice.
     */
    drainWhere(predicate: (entry: QueueEntry<T>) => boolean): QueueEntry<T>[] {
        const drained: QueueEntry<T>[] = [];
        for (const bucket of this.buckets) {
            let kept = 0;
            for (const entry of bucket) {
                if (!predicate(entry)) {
                    bucket[kept] = entry;
                    kept++;
                } else if (!entry.cancelled) {
                    drained.push(entry);
                }
            }
            bucket.length = kept;
        }
        return drained;
    }

    depth(priority: Priority): number {
        return this.buckets[priority].length;
    }

    depths(): number[] {
        return this.buckets.map((bucket) => bucket.length);
    }

    size(): number {
        return this.buckets.reduce((total, bucket) => total + bucket.length, 0);
    }

    /**
     * Snapshot for the status endpoint. Queue age is the metric that says whether the reservations
     * are set correctly: bulk trending into hours means its share is too small, bulk sitting near
     * zero while interactive tiers queue means it is too large.
     */
    metrics(now: number): QueueMetrics {
        return {
            depths: this.depths(),
            oldestAgeMs: this.buckets.map((bucket) => (bucket.length > 0 ? now - bucket[0].enqueuedAt : 0)),
            meanWaitMs: this.waitTotals.map((total, priority) =>
                this.waitCounts[priority] > 0 ? Math.round(total / this.waitCounts[priority]) : 0,
            ),
            maxWaitMs: [...this.waitMaxes],
            droppedExpired: [...this.droppedExpired],
            droppedCancelled: [...this.droppedCancelled],
        };
    }

    private recordWait(priority: Priority, waitedMs: number): void {
        this.waitTotals[priority] += waitedMs;
        this.waitCounts[priority]++;
        if (waitedMs > this.waitMaxes[priority]) this.waitMaxes[priority] = waitedMs;
    }

    /**
     * Removes entries that are past their deadline or whose client has gone away.
     *
     * Both are the same idea: upstream capacity is the scarce resource, and spending it on a
     * response nobody can receive is pure waste. Expiry catches the deadline passing; cancellation
     * catches a client that gave up early or a shard that died.
     */
    private dropExpired(now: number): void {
        for (const [priority, bucket] of this.buckets.entries()) {
            let kept = 0;
            for (const entry of bucket) {
                if (entry.cancelled) {
                    this.droppedCancelled[priority]++;
                } else if (entry.deadline <= now) {
                    this.droppedExpired[priority]++;
                    this.onExpire?.(entry);
                } else {
                    bucket[kept] = entry;
                    kept++;
                }
            }
            bucket.length = kept;
        }
    }
}
