import { GOVERNOR, RATE } from "../../data/constants/swapiServe.ts";
import { affectsHealth, type Outcome } from "./outcomes.ts";
import { TokenBucket } from "./tokenBucket.ts";

/**
 * Circuit states, named rather than a boolean so the transitions are explicit. A bare
 * "circuitOpen" flag is the shape that quietly becomes "disabled until restart" under a later
 * edit; `open` here always reaches `half-open` once the interval elapses.
 *
 *   closed --[CIRCUIT_OPEN_AFTER_FAILURES health failures]--> open
 *   open --[CIRCUIT_PROBE_INTERVAL_MS elapsed]--> half-open
 *   half-open --[probe ok]--> closed
 *   half-open --[probe fails]--> open (interval restarts)
 */
export type CircuitState = "closed" | "open" | "half-open";

export interface BackendSnapshot {
    url: string;
    limit: number;
    inFlight: number;
    ratePerSecond: number;
    state: CircuitState;
    drained: boolean;
    outcomes: Record<string, number>;
}

/**
 * Why a dispatch attempt was refused. Three genuinely different resources, kept apart because
 * "we could not dispatch" is useless for debugging while "we were rate-bound 80 percent of the
 * time" tells you exactly which constant to change, and which of slots or rate the real upstream
 * ceiling is expressed in.
 */
export type BlockedBy = "slot" | "token" | "health";

export interface AcquireResult {
    url: string | null;
    /** Set only when url is null. */
    blockedBy?: BlockedBy;
}

interface BackendState {
    url: string;
    limit: number;
    inFlight: number;
    cleanStreak: number;
    consecutiveFailures: number;
    cooldownUntil: number;
    state: CircuitState;
    /** Operator-set, independent of health. Never cleared by a probe. */
    drained: boolean;
    /** When the breaker last entered `open`. Drives the move to `half-open`. */
    openedAt: number;
    probeInFlight: boolean;
    bucket: TokenBucket;
    outcomes: Record<string, number>;
}

/**
 * One AIMD controller per comlink backend.
 *
 * The safe request rate cannot be known in advance: the previous hand-tuned MAX_CONCURRENT of 20
 * was a guess, and the real ceiling may sit upstream at EA or inside a single comlink process.
 * So the limit is learned from outcomes, growing gently while responses are clean and halving
 * whenever the backend signals distress.
 *
 * Because each backend adapts independently, adding a second instance and watching whether the
 * two limits converge separately or collapse to a shared ceiling is what finally answers whether
 * more comlink instances buy more capacity.
 */
export class Governor {
    private readonly backends: BackendState[];
    private readonly probeIntervalMs: number;

    constructor(urls: string[], { probeIntervalMs }: { probeIntervalMs?: number } = {}) {
        this.probeIntervalMs = probeIntervalMs ?? GOVERNOR.CIRCUIT_PROBE_INTERVAL_MS;
        this.backends = urls.map((url) => ({
            url,
            limit: GOVERNOR.START_LIMIT,
            inFlight: 0,
            cleanStreak: 0,
            consecutiveFailures: 0,
            cooldownUntil: 0,
            state: "closed",
            drained: false,
            openedAt: 0,
            probeInFlight: false,
            bucket: new TokenBucket({ ratePerSecond: RATE.START_PER_SEC }),
            outcomes: {},
        }));
    }

    /**
     * Reserves a slot on the healthiest backend with headroom and returns its URL, or null with
     * the reason when everything is unavailable. A circuit-open backend is skipped except for one
     * periodic probe.
     */
    acquire(now: number): AcquireResult {
        const candidates: BackendState[] = [];
        let sawHealthy = false;

        for (const backend of this.backends) {
            // open -> half-open once the interval has elapsed. This is the transition that stops
            // the breaker ever becoming permanent.
            if (backend.state === "open" && now - backend.openedAt >= this.probeIntervalMs) {
                backend.state = "half-open";
            }

            if (backend.drained || backend.state === "open") continue;
            sawHealthy = true;

            if (backend.state === "half-open") {
                // Exactly one probe at a time, and it ignores the limit but not the rate, so a
                // wedged backend cannot be probed faster than its pacing allows.
                if (backend.probeInFlight) continue;
                if (!backend.bucket.tryTake(now)) continue;
                backend.probeInFlight = true;
                backend.inFlight++;
                return { url: backend.url };
            }

            if (backend.limit - backend.inFlight > 0) candidates.push(backend);
        }

        if (candidates.length === 0) return { url: null, blockedBy: sawHealthy ? "slot" : "health" };

        // Absolute available slots, NOT the inFlight/limit ratio. The limit is learned, so it
        // encodes health: a backend proven to carry 40 is healthier than one that just collapsed
        // to 2. Ratio-based selection would feed the sick backend precisely because its shrunken
        // limit makes it look idle.
        candidates.sort((a, b) => b.limit - b.inFlight - (a.limit - a.inFlight));

        // Walk the whole list rather than committing to the best one. A backend can have a free
        // slot but no token, and giving up there would strand the queue: nextAvailableAt scans
        // every backend, so it would report capacity available, no wakeup would be armed, and
        // nothing in flight would arrive to pump the queue.
        for (const backend of candidates) {
            if (!backend.bucket.tryTake(now)) continue;
            backend.inFlight++;
            return { url: backend.url };
        }

        // Every candidate had a slot but no token, so the rate is what held this request back.
        // Keeping that distinct from a slot block is what will show whether the real upstream
        // ceiling counts connections or requests per second.
        return { url: null, blockedBy: "token" };
    }

    /** Releases the slot and applies the AIMD update for the observed outcome. */
    report(url: string, outcome: Outcome, now: number): void {
        const backend = this.backends.find((candidate) => candidate.url === url);
        if (!backend) return;

        backend.inFlight = Math.max(0, backend.inFlight - 1);
        backend.outcomes[outcome] = (backend.outcomes[outcome] ?? 0) + 1;
        const wasProbe = backend.probeInFlight;
        backend.probeInFlight = false;

        if (affectsHealth(outcome)) {
            backend.cleanStreak = 0;
            backend.consecutiveFailures++;
            backend.limit = Math.max(GOVERNOR.MIN_LIMIT, Math.floor(backend.limit * GOVERNOR.DECREASE_FACTOR));
            backend.cooldownUntil = now + GOVERNOR.COOLDOWN_MS;
            backend.bucket.setRate(backend.bucket.getRate() * GOVERNOR.DECREASE_FACTOR);

            // A failed probe sends the breaker straight back to open and restarts the interval,
            // regardless of the failure count.
            if (wasProbe || backend.consecutiveFailures >= GOVERNOR.CIRCUIT_OPEN_AFTER_FAILURES) {
                backend.state = "open";
                backend.openedAt = now;
            }
            return;
        }

        // Anything that is not the backend's fault (ok, not_found, rejected, 408) leaves the
        // limit alone, but only a clean success counts towards growing it.
        backend.consecutiveFailures = 0;
        if (wasProbe && outcome === "ok") {
            // Re-admit, but do NOT restore the old limit: recovery climbs through normal additive
            // increase so we do not slam straight back into whatever caused the failures.
            backend.state = "closed";
        }
        if (outcome !== "ok") return;

        backend.cleanStreak++;
        if (now < backend.cooldownUntil) return;
        if (backend.cleanStreak < GOVERNOR.INCREASE_AFTER_CLEAN) return;

        backend.cleanStreak = 0;
        backend.limit = Math.min(GOVERNOR.MAX_LIMIT, backend.limit + 1);
        backend.bucket.setRate(backend.bucket.getRate() + 1);
    }

    /**
     * Operator controls, deliberately separate from the circuit state so a manual drain is never
     * confused with a health-driven one and is never undone by a successful probe. Debugging a
     * production backend should not require restarting the service.
     */
    drain(url: string): void {
        const backend = this.backends.find((candidate) => candidate.url === url);
        if (backend) backend.drained = true;
    }

    enable(url: string): void {
        const backend = this.backends.find((candidate) => candidate.url === url);
        if (backend) backend.drained = false;
    }

    /** Overrides a backend's refill rate. Used by tests that need deterministic pacing. */
    setRate(url: string, perSecond: number): void {
        this.backends.find((candidate) => candidate.url === url)?.bucket.setRate(perSecond);
    }

    /**
     * Milliseconds until some backend could accept work, or null when capacity is available now.
     *
     * The dispatcher needs this because a queue blocked by the rate, or by every circuit being
     * open, receives no completion event to wake it: every slot can be idle with work still
     * waiting. Both are therefore scheduling events in their own right.
     */
    nextAvailableAt(now: number): number | null {
        let soonest: number | null = null;

        // Returns true when capacity is available right now, meaning no timer is needed.
        const consider = (wait: number): boolean => {
            if (wait <= 0) return true;
            if (soonest === null || wait < soonest) soonest = wait;
            return false;
        };

        for (const backend of this.backends) {
            if (backend.drained) continue;

            if (backend.state === "open") {
                if (consider(this.probeIntervalMs - (now - backend.openedAt))) return null;
                continue;
            }

            if (backend.state === "half-open") {
                if (!backend.probeInFlight && consider(backend.bucket.msUntilNextToken(now))) return null;
                continue;
            }

            if (backend.inFlight >= backend.limit) continue;
            if (consider(backend.bucket.msUntilNextToken(now))) return null;
        }

        return soonest;
    }

    /** Overrides a backend's limit. Used by tests that need deterministic capacity. */
    setLimit(url: string, limit: number): void {
        const backend = this.backends.find((candidate) => candidate.url === url);
        if (!backend) return;
        backend.limit = Math.max(GOVERNOR.MIN_LIMIT, Math.min(GOVERNOR.MAX_LIMIT, limit));
    }

    /**
     * Returns a slot that was acquired but never used, because the queue turned out to be empty.
     * Deliberately not `report("ok")`: no request was made, so it must not count towards the
     * clean streak that grows the limit, or an idle service would inflate its own budget.
     */
    releaseUnused(url: string): void {
        const backend = this.backends.find((candidate) => candidate.url === url);
        if (!backend) return;
        backend.inFlight = Math.max(0, backend.inFlight - 1);
        backend.probeInFlight = false;
        backend.bucket.refund();
    }

    snapshot(): BackendSnapshot[] {
        return this.backends.map((backend) => ({
            url: backend.url,
            limit: backend.limit,
            inFlight: backend.inFlight,
            ratePerSecond: backend.bucket.getRate(),
            state: backend.state,
            drained: backend.drained,
            outcomes: { ...backend.outcomes },
        }));
    }
}
