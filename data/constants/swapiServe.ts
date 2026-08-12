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
//
// Both apply PER TIER, not to one shared pool. A shared pool is a priority inversion: bulk work
// dispatches orders of magnitude more than anything else, so a nightly cycle failing its way
// through a window could spend the allowance the arena tick needed, and a tick request hitting one
// transient 502 would then be dropped. That loses the account's payout alert for a minute the
// payout cycle repeats every day. Per tier, each funds its own retries and bulk cannot reach the
// tick's. The cost is that the floor now applies five times over, so a total outage allows up to
// PRIORITY_COUNT * MIN_IN_WINDOW retries per window rather than MIN_IN_WINDOW; a few dozen extra
// requests a minute is a trade worth making to keep the tick's retries out of bulk's reach.
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
// the most important tier exactly backwards. Bulk work is the easy end: nothing is watching, and
// it is cheaper to wait than to re-run a nightly cycle.
//
// The deadline also decides who survives an outage, because Dispatcher.shedDoomed sheds whatever
// expires within one CIRCUIT_PROBE_INTERVAL_MS: no probe can land in time to serve it. So the two
// user-facing tiers sit AT that interval, which sheds them on the very first pump rather than
// letting them wait out probe after probe. That is deliberate and must stay true - a user staring
// at a Discord spinner is better served by a prompt failure than by a two-minute one - so keep
// these at or below CIRCUIT_PROBE_INTERVAL_MS. swapiServe.integration.test.ts asserts it.
//
// The tick is the exception, and is longer than a user command rather than shorter. It runs on a
// 60s interval guarded by arenaTickRunning in events/clientReady.ts, so it must fail well inside
// its minute, but no human is waiting on it: a tick that queued 30s and still landed is a win,
// where a command that took 30s has already lost its user. Being past the probe interval means a
// tick waits out part of an outage, which costs nothing, since it is shed with 15s to spare and
// the next tick fires on schedule regardless.
//
// Clients may override with the x-swapi-deadline-ms header, but ComlinkStub has no per-request
// header hook, so in practice these defaults are what every caller gets.
export const DEADLINE_MS: readonly number[] = [
    45_000, // ARENA_TICK: inside its minute, with room to answer
    15_000, // SUPPORTER_COMMAND: one probe interval, so an outage fails it at once
    15_000, // PUBLIC_COMMAND: likewise; priority buys precedence, not extra patience
    300_000, // BACKGROUND
    600_000, // BULK
];

// Per-process cap used when swapiServe is unreachable and clients fall back to calling comlink
// directly. Deliberately far below the old MAX_CONCURRENT of 20, since every shard applies it
// independently with no coordination.
export const FALLBACK_MAX_CONCURRENT = 5;

// How long a client waits before retrying swapiServe after a connection failure.
export const SERVICE_RECHECK_MS = 30_000;
