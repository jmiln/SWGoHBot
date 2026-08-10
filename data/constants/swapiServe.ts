// Priority tiers for comlink traffic, highest first. arenaTick outranks live user commands
// because a missed payout minute is unrecoverable for the affected accounts, while a slow
// command is only slow.
export const PRIORITY = {
    ARENA_TICK: 0,
    SUPPORTER_COMMAND: 1,
    PUBLIC_COMMAND: 2,
    BACKGROUND: 3,
    BULK: 4,
} as const;

export type Priority = 0 | 1 | 2 | 3 | 4;

export const PRIORITY_COUNT = 5;
export const LOWEST_PRIORITY: Priority = 4;

// AIMD controller, one per backend. Shaped like TCP congestion control: grow gently on clean
// completions, halve on a throttle or server failure, then hold still while the cooldown runs
// so it does not climb straight back into the wall.
export const GOVERNOR = {
    START_LIMIT: 5,
    MIN_LIMIT: 1,
    MAX_LIMIT: 60,
    INCREASE_AFTER_CLEAN: 10,
    DECREASE_FACTOR: 0.5,
    COOLDOWN_MS: 30_000,
    CIRCUIT_OPEN_AFTER_FAILURES: 10,
    CIRCUIT_PROBE_INTERVAL_MS: 15_000,
} as const;

// Requests-per-second control, paired with GOVERNOR's concurrency control. A concurrency limit
// alone cannot regulate an upstream that counts requests per second rather than connections, and
// we do not know which comlink enforces, so both are governed and adapt together.
// BURST_FACTOR lets a quiet period bank a short burst instead of forcing perfectly even spacing.
export const RATE = {
    START_PER_SEC: 5,
    MIN_PER_SEC: 0.5,
    MAX_PER_SEC: 60,
    BURST_FACTOR: 2,
} as const;

// RESERVED_SHARES is indexed by priority: the fraction of capacity each tier is guaranteed and
// that higher tiers cannot take from it. A tier below its share with work waiting is served ahead
// of the strict-priority winner, which stops a busy bot stalling the updaters into permanently
// stale game data AND stops an arena spike head-of-line blocking live users.
//
// A reservation is a FLOOR, never a cap: arenaTick keeps strict precedence above its share,
// because the tick must finish inside its minute. Unused reservation is immediately available to
// everyone else, so a quiet tier costs nothing.
//
// These sum to 0.8, leaving 20 percent allocated purely by priority. They are starting values to
// be tuned against the queue-age metrics, not fundamentals.
//
// DEPTH_LIMITS is indexed by priority; bulk work is rejected early because it has no deadline
// and will come back around, while interactive tiers get a fast rejection instead of a long
// wait that outlives the Discord interaction token.
// MAX_CREDIT bounds the service credit in both directions. Without a ceiling, a tier idle for an
// hour would bank an hour of claim and then monopolise the queue the moment it wakes; without a
// floor, a tier that legitimately used spare capacity would be locked out for a long stretch
// afterwards. A few requests' worth of slack is enough to smooth bursts without either effect.
export const QUEUE = {
    RESERVED_SHARES: [0.1, 0.2, 0.2, 0.1, 0.2],
    DEPTH_LIMITS: [200, 500, 500, 500, 5000],
    MAX_CREDIT: 5,
} as const;

// Retries are capped as a fraction of dispatches in a rolling window. This replaces the
// per-batch createRetryBudget in modules/swapi.ts, which has no meaning in a service that sees
// no batches, while preserving its intent: during a systemic outage retries must not multiply
// load at exactly the moment we are over budget.
// MIN_IN_WINDOW carries over RETRY_BUDGET_MIN from the code this replaces: the fraction alone
// rounds down to zero at low traffic, so an isolated blip on a quiet service could never be
// retried at all, which is the one case retries exist for. Only a systemic outage should ever
// exhaust the budget.
export const RETRY = {
    ATTEMPTS: 2,
    BASE_DELAY_MS: 500,
    WINDOW_MS: 60_000,
    MAX_FRACTION_OF_DISPATCHES: 0.25,
    MIN_IN_WINDOW: 10,
} as const;

export const UPSTREAM_TIMEOUT_MS = 60_000;

// How long a request is still worth sending, indexed by priority. Past this the queue drops it and
// answers 503 rather than spending upstream budget on a response whose caller has moved on.
//
// These are per-tier because the tiers differ in what being late costs, and a single default gets
// the most important tier exactly backwards. arenaTick runs on a 60s interval guarded by
// arenaTickRunning in events/clientReady.ts: a tick still waiting when the next one fires drops
// that minute entirely, and since the payout cycle and the poll interval are exact multiples, the
// same minute is lost every day. So its work must fail well inside the minute rather than survive
// past it. Bulk work is at the other extreme: nothing is watching, and it is cheaper to wait than
// to re-run a nightly cycle.
//
// Clients may override with the x-swapi-deadline-ms header, but ComlinkStub has no per-request
// header hook, so in practice these defaults are what every caller gets.
export const DEADLINE_MS: readonly number[] = [
    45_000, // ARENA_TICK: inside its minute, with room to answer
    120_000, // SUPPORTER_COMMAND
    120_000, // PUBLIC_COMMAND
    300_000, // BACKGROUND
    600_000, // BULK
];

// Per-process cap used when swapiServe is unreachable and clients fall back to calling comlink
// directly. Deliberately far below the old MAX_CONCURRENT of 20, since every shard applies it
// independently with no coordination.
export const FALLBACK_MAX_CONCURRENT = 5;

// How long a client waits before retrying swapiServe after a connection failure.
export const SERVICE_RECHECK_MS = 30_000;
