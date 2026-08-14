import assert from "node:assert";
import { describe, it } from "node:test";
import { PRIORITY } from "../../data/constants/swapiServe.ts";
import { PriorityQueue, type QueueEntry } from "../../services/swapiServe/queue.ts";

const FAR_FUTURE = Number.MAX_SAFE_INTEGER;


function entry(priority: 0 | 1 | 2 | 3 | 4, payload: string, deadline = FAR_FUTURE, enqueuedAt = 0): QueueEntry<string> {
    return { priority, deadline, enqueuedAt, cost: 1, payload };
}

describe("swapiServe.PriorityQueue ordering", () => {
    it("serves a higher priority before a lower one regardless of arrival order", () => {
        const queue = new PriorityQueue<string>({});
        queue.enqueue(entry(PRIORITY.BULK, "bulk"));
        queue.enqueue(entry(PRIORITY.ARENA_TICK, "arena"));

        assert.strictEqual(queue.dequeue(0)?.payload, "arena");
    });

    it("serves FIFO within a single tier", () => {
        const queue = new PriorityQueue<string>({});
        queue.enqueue(entry(PRIORITY.PUBLIC_COMMAND, "first"));
        queue.enqueue(entry(PRIORITY.PUBLIC_COMMAND, "second"));

        assert.strictEqual(queue.dequeue(0)?.payload, "first");
        assert.strictEqual(queue.dequeue(0)?.payload, "second");
    });

    // The headline behaviour: a payout tick submitted last still goes first.
    it("serves an arena tick queued behind a hundred bulk requests", () => {
        const queue = new PriorityQueue<string>({});
        for (let i = 0; i < 100; i++) queue.enqueue(entry(PRIORITY.BULK, `bulk-${i}`));
        queue.enqueue(entry(PRIORITY.ARENA_TICK, "arena"));

        assert.strictEqual(queue.dequeue(0)?.payload, "arena");
    });

    it("returns null when empty", () => {
        const queue = new PriorityQueue<string>({});
        assert.strictEqual(queue.dequeue(0), null);
    });
});

describe("swapiServe.PriorityQueue reservations", () => {
    // Depth limits are per tier and P0's is the tightest (200). Tests about scheduling must not
    // be silently capped by them, so they pass their own generous limits.
    const NO_DEPTH_LIMIT = [10_000, 10_000, 10_000, 10_000, 10_000];

    /** Fills every tier with more work than the run will consume. */
    function saturate(queue: PriorityQueue<string>, perTier: number): void {
        for (let priority = 0; priority < 5; priority++) {
            for (let i = 0; i < perTier; i++) {
                const accepted = queue.enqueue(entry(priority as 0 | 1 | 2 | 3 | 4, `p${priority}-${i}`));
                assert.ok(accepted, `tier ${priority} hit its depth limit during setup, which would skew the result`);
            }
        }
    }

    function serve(queue: PriorityQueue<string>, count: number): number[] {
        const served = [0, 0, 0, 0, 0];
        for (let i = 0; i < count; i++) {
            const next = queue.dequeue(0);
            if (!next) break;
            served[next.priority]++;
        }
        return served;
    }

    // With no history, nobody is owed service, so strict priority applies. This is the ordinary
    // case and the one that keeps the payout tick first.
    it("serves the highest priority first when no tier is owed service", () => {
        const queue = new PriorityQueue<string>({});
        queue.enqueue(entry(PRIORITY.BULK, "bulk"));
        queue.enqueue(entry(PRIORITY.BACKGROUND, "background"));
        queue.enqueue(entry(PRIORITY.ARENA_TICK, "arena"));

        assert.strictEqual(queue.dequeue(0)?.payload, "arena");
    });

    // Strict priority alone would let a busy bot stall dataUpdater indefinitely, which means
    // permanently stale game data.
    it("eventually serves a starved low tier once it is owed service", () => {
        const queue = new PriorityQueue<string>({ depthLimits: NO_DEPTH_LIMIT });
        saturate(queue, 200);

        const served = serve(queue, 100);
        assert.ok(served[PRIORITY.BULK] > 0, "bulk must not be starved outright");
    });

    // The other direction: a sustained arena burst must not head-of-line block live users.
    it("protects interactive tiers from a sustained arena burst", () => {
        const queue = new PriorityQueue<string>({ depthLimits: NO_DEPTH_LIMIT });
        saturate(queue, 200);

        const served = serve(queue, 100);
        assert.ok(served[PRIORITY.PUBLIC_COMMAND] > 0, "public commands must keep flowing");
        assert.ok(served[PRIORITY.SUPPORTER_COMMAND] > 0, "supporter commands must keep flowing");
    });

    // The point of borrowing WDRR's accounting: over a run, service converges on the configured
    // shares rather than on whatever a sampling window happened to catch. The contract is a
    // floor, not an exact split, so every tier must clear its guarantee. The unreserved
    // remainder (shares total 0.8) lands wherever priority and credit take it.
    it("gives every tier at least its guaranteed share under saturation", () => {
        const queue = new PriorityQueue<string>({ depthLimits: NO_DEPTH_LIMIT });
        saturate(queue, 500);

        const total = 1000;
        const served = serve(queue, total);
        const guaranteed = [0.1, 0.2, 0.2, 0.1, 0.2];

        for (let priority = 0; priority < 5; priority++) {
            const actual = served[priority] / total;
            assert.ok(
                actual >= guaranteed[priority] - 0.02,
                `tier ${priority} received ${(actual * 100).toFixed(1)}%, below its guaranteed ${guaranteed[priority] * 100}%`,
            );
        }

        assert.strictEqual(
            served.reduce((sum, count) => sum + count, 0),
            total,
            "every dispatch should be accounted for",
        );
    });

    // Without a ceiling on banked credit, a tier idle for an hour would wake up owed an hour of
    // service and monopolise the queue.
    it("caps how much an idle tier can bank while others are served", () => {
        const maxCredit = 3;
        const queue = new PriorityQueue<string>({ maxCredit, depthLimits: NO_DEPTH_LIMIT });
        for (let i = 0; i < 500; i++) queue.enqueue(entry(PRIORITY.ARENA_TICK, `arena-${i}`));
        serve(queue, 400);
        assert.ok(queue.depth(PRIORITY.ARENA_TICK) > 0, "the top tier must still have work, or this proves nothing");

        // Bulk shows up only now, after a long absence
        for (let i = 0; i < 50; i++) queue.enqueue(entry(PRIORITY.BULK, `bulk-${i}`));
        const served = serve(queue, maxCredit + 1);

        assert.ok(
            served[PRIORITY.BULK] <= maxCredit,
            `a long-idle tier banked more than the cap: ${served[PRIORITY.BULK]} of ${maxCredit + 1}`,
        );
    });

    it("serves the only waiting tier regardless of credit", () => {
        const queue = new PriorityQueue<string>({});
        for (let i = 0; i < 20; i++) queue.enqueue(entry(PRIORITY.ARENA_TICK, `arena-${i}`));

        for (let i = 0; i < 20; i++) {
            assert.strictEqual(queue.dequeue(0)?.priority, PRIORITY.ARENA_TICK);
        }
    });
});

describe("swapiServe.PriorityQueue cancellation", () => {
    // Upstream capacity is the scarce resource. Spending it on a response nobody can receive is
    // pure waste, so a client that has gone away must not reach the backend.
    it("drops a cancelled entry instead of dispatching it", () => {
        const queue = new PriorityQueue<string>({});
        const cancelled = entry(PRIORITY.PUBLIC_COMMAND, "gone");
        queue.enqueue(cancelled);
        queue.enqueue(entry(PRIORITY.PUBLIC_COMMAND, "still here"));

        cancelled.cancelled = true;

        assert.strictEqual(queue.dequeue(0)?.payload, "still here");
        assert.strictEqual(queue.size(), 0);
    });

    it("does not fire onExpire for a cancelled entry, which is not a timeout", () => {
        const expired: string[] = [];
        const queue = new PriorityQueue<string>({ onExpire: (e) => expired.push(e.payload) });
        const cancelled = entry(PRIORITY.PUBLIC_COMMAND, "gone");
        queue.enqueue(cancelled);
        cancelled.cancelled = true;

        queue.dequeue(0);
        assert.deepStrictEqual(expired, []);
    });
});

describe("swapiServe.PriorityQueue deadlines", () => {
    it("drops expired entries instead of dispatching them", () => {
        const expired: string[] = [];
        const queue = new PriorityQueue<string>({ onExpire: (e) => expired.push(e.payload) });
        queue.enqueue(entry(PRIORITY.PUBLIC_COMMAND, "stale", 100));
        queue.enqueue(entry(PRIORITY.PUBLIC_COMMAND, "fresh", 5000));

        assert.strictEqual(queue.dequeue(1000)?.payload, "fresh");
        assert.deepStrictEqual(expired, ["stale"]);
    });

    it("returns null when every waiting entry has expired", () => {
        const queue = new PriorityQueue<string>({});
        queue.enqueue(entry(PRIORITY.PUBLIC_COMMAND, "stale", 100));

        assert.strictEqual(queue.dequeue(1000), null);
        assert.strictEqual(queue.size(), 0);
    });

    // Expiry cannot only happen on the way to a dispatch: when no capacity is available there is
    // no dispatch to ride along with, and the waiting callers are exactly the ones whose deadlines
    // are passing.
    it("sweeps expired entries without being asked for one to dispatch", () => {
        const expired: string[] = [];
        const queue = new PriorityQueue<string>({ onExpire: (e) => expired.push(e.payload) });
        queue.enqueue(entry(PRIORITY.PUBLIC_COMMAND, "stale", 100));
        queue.enqueue(entry(PRIORITY.BULK, "patient", 500_000));

        queue.sweepExpired(1000);

        assert.deepStrictEqual(expired, ["stale"]);
        assert.strictEqual(queue.size(), 1, "work that has not expired must keep its place");
    });

    it("reports the earliest deadline across every tier, so a wakeup can be armed for it", () => {
        const queue = new PriorityQueue<string>({});
        assert.strictEqual(queue.earliestDeadline(), null, "an empty queue has nothing to wake for");

        queue.enqueue(entry(PRIORITY.BULK, "patient", 500_000));
        queue.enqueue(entry(PRIORITY.PUBLIC_COMMAND, "impatient", 15_000));
        queue.enqueue(entry(PRIORITY.ARENA_TICK, "tick", 45_000));

        assert.strictEqual(queue.earliestDeadline(), 15_000);
    });

    it("reports the earliest deadline within a tier, not just the entry at its head", () => {
        const queue = new PriorityQueue<string>({});
        queue.enqueue(entry(PRIORITY.PUBLIC_COMMAND, "first", 30_000));
        queue.enqueue(entry(PRIORITY.PUBLIC_COMMAND, "shorter", 10_000));

        assert.strictEqual(queue.earliestDeadline(), 10_000);
    });
});

describe("swapiServe.PriorityQueue metrics", () => {
    it("reports the age of the oldest entry per tier", () => {
        const queue = new PriorityQueue<string>({});
        queue.enqueue(entry(PRIORITY.BULK, "old", FAR_FUTURE, 1000));
        queue.enqueue(entry(PRIORITY.BULK, "new", FAR_FUTURE, 4000));

        assert.strictEqual(queue.metrics(5000).oldestAgeMs[PRIORITY.BULK], 4000);
        assert.strictEqual(queue.metrics(5000).oldestAgeMs[PRIORITY.ARENA_TICK], 0);
    });

    it("records wait time per tier as entries are dispatched", () => {
        const queue = new PriorityQueue<string>({});
        queue.enqueue(entry(PRIORITY.BULK, "waited", FAR_FUTURE, 1000));
        queue.dequeue(3000);

        const metrics = queue.metrics(3000);
        assert.strictEqual(metrics.meanWaitMs[PRIORITY.BULK], 2000);
        assert.strictEqual(metrics.maxWaitMs[PRIORITY.BULK], 2000);
    });

    it("counts entries dropped for expiry and for cancellation separately", () => {
        const queue = new PriorityQueue<string>({});
        queue.enqueue(entry(PRIORITY.PUBLIC_COMMAND, "stale", 100));
        const cancelled = entry(PRIORITY.BULK, "gone");
        queue.enqueue(cancelled);
        cancelled.cancelled = true;

        queue.dequeue(1000);

        const metrics = queue.metrics(1000);
        assert.strictEqual(metrics.droppedExpired[PRIORITY.PUBLIC_COMMAND], 1);
        assert.strictEqual(metrics.droppedCancelled[PRIORITY.BULK], 1);
    });
});

describe("swapiServe.PriorityQueue depth limits", () => {
    it("accepts entries below the tier limit and reports depth", () => {
        const queue = new PriorityQueue<string>({});
        assert.strictEqual(queue.enqueue(entry(PRIORITY.ARENA_TICK, "a")), true);
        assert.strictEqual(queue.depth(PRIORITY.ARENA_TICK), 1);
        assert.strictEqual(queue.size(), 1);
    });

    it("rejects an entry once its tier is at the depth limit", () => {
        const queue = new PriorityQueue<string>({ depthLimits: [1, 1, 1, 1, 1] });
        assert.strictEqual(queue.enqueue(entry(PRIORITY.BULK, "first")), true);
        assert.strictEqual(queue.enqueue(entry(PRIORITY.BULK, "second")), false);
        assert.strictEqual(queue.depth(PRIORITY.BULK), 1);
    });

    it("limits each tier independently", () => {
        const queue = new PriorityQueue<string>({ depthLimits: [1, 1, 1, 1, 1] });
        queue.enqueue(entry(PRIORITY.BULK, "bulk"));
        assert.strictEqual(queue.enqueue(entry(PRIORITY.ARENA_TICK, "arena")), true);
    });
});
