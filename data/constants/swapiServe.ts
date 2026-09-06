// Priority tiers for comlink traffic, highest first. arenaTick outranks live user commands
// because a missed payout minute is unrecoverable.
export const PRIORITY = {
    ARENA_TICK: 0,
    SUPPORTER_COMMAND: 1,
    PUBLIC_COMMAND: 2,
    BACKGROUND: 3,
    BULK: 4,
} as const;

export type Priority = (typeof PRIORITY)[keyof typeof PRIORITY];

// Anything sized to the tier list. Adding a tier to PRIORITY without widening this is a compile
// error at every table below, rather than a silently short array.
export type ByPriority<T> = readonly [T, T, T, T, T];

export const PRIORITY_COUNT = Object.keys(PRIORITY).length;
export const LOWEST_PRIORITY: Priority = PRIORITY.BULK;

// AIMD controller, one per backend: grow on clean completions, halve on a throttle or server
// failure, then hold still for the cooldown.
export const GOVERNOR = {
    START_LIMIT: 5,
    MIN_LIMIT: 1,
    // Aggregate across the five comlink containers behind SWAPI_CLIENT_URL, not per-IP. Whole
    // response bodies are buffered, so in-flight memory is this times mean response size (~400MB).
    MAX_LIMIT: 150,
    INCREASE_AFTER_CLEAN: 10,
    DECREASE_FACTOR: 0.5,
    COOLDOWN_MS: 30_000,
    CIRCUIT_OPEN_AFTER_FAILURES: 10,
    CIRCUIT_PROBE_INTERVAL_MS: 15_000,
} as const;

// Requests-per-second control, paired with GOVERNOR's concurrency control; comlink may enforce
// either, so both adapt together. BURST_FACTOR lets a quiet period bank a short burst.
export const RATE = {
    START_PER_SEC: 5,
    MIN_PER_SEC: 0.5,
    // Aggregate across the five egress IPs, at the 60/s a single IP sustained.
    MAX_PER_SEC: 300,
    BURST_FACTOR: 2,
} as const;

// Shares are a floor, never a cap - see the PriorityQueue docblock. They total 0.8, leaving 20
// percent allocated purely by priority; tune against the queue-age metrics.
export const QUEUE: { RESERVED_SHARES: ByPriority<number>; DEPTH_LIMITS: ByPriority<number>; MAX_CREDIT: number } = {
    RESERVED_SHARES: [0.1, 0.2, 0.2, 0.1, 0.2],
    DEPTH_LIMITS: [200, 500, 500, 500, 5000],
    MAX_CREDIT: 5,
};

// Capped as a fraction of dispatches in a rolling window, PER TIER - a shared pool would let a
// failing nightly cycle spend the allowance the arena tick needs. MIN_IN_WINDOW is a floor.
export const RETRY = {
    ATTEMPTS: 2,
    BASE_DELAY_MS: 500,
    WINDOW_MS: 60_000,
    MAX_FRACTION_OF_DISPATCHES: 0.25,
    MIN_IN_WINDOW: 10,
} as const;

export const UPSTREAM_TIMEOUT_MS = 60_000;

// How long a request is still worth sending. Keep the user-facing tiers at or below
// CIRCUIT_PROBE_INTERVAL_MS so shedDoomed drops them on the first pump; the integration test asserts it.
export const DEADLINE_MS: ByPriority<number> = [
    45_000, // ARENA_TICK: inside its minute, with room to answer
    15_000, // SUPPORTER_COMMAND: one probe interval, so an outage fails it at once
    15_000, // PUBLIC_COMMAND: likewise; priority buys precedence, not extra patience
    300_000, // BACKGROUND
    600_000, // BULK
];

// A shed request and a genuine upstream 503 share a status code, so this names the terminal reason.
// SHED_SHUTTING_DOWN is the only one that should fall back to calling comlink directly.
export const SHED_REASON_HEADER = "x-swapi-shed";
export const SHED_SHUTTING_DOWN = "shutting_down";

// Per-process cap used when swapiServe is unreachable and clients fall back to calling comlink
// directly. Kept low, since every shard applies it independently with no coordination.
export const FALLBACK_MAX_CONCURRENT = 5;

// How long a client waits before retrying swapiServe after finding it unavailable.
export const SERVICE_RECHECK_MS = 30_000;

// Slack on a client's watchdog bound (watchdogMsForTier), covering loopback and queue jitter.
export const WATCHDOG_SLACK_MS = 5_000;
