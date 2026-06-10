import type { ArenaPlayer } from "../types/types.ts";
import arenaPlayerRegistry from "./arenaPlayerRegistry.ts";
import { buildAllyCodeChoices } from "./functions.ts";
import userReg from "./users.ts";

/**
 * Short-TTL per-user cache for allycode autocomplete.
 *
 * Discord fires an autocomplete event on every keystroke, and each one previously cost
 * two indexed Mongo queries (users by id, arenaPlayers by $in) that returned identical
 * data for the whole typing session. The first keystroke fetches the user's full
 * candidate set; subsequent keystrokes filter it in memory until the TTL lapses.
 *
 * The TTL only needs to outlast a single typing session — each new command pulls fresh
 * data, so account changes (register, userconf add/remove) show up on the next command
 * without any explicit invalidation.
 */

export const ALLYCODE_CACHE_TTL_MS = 15_000;

// Lazy sweep threshold — when an insert pushes the cache past this size, expired
// entries are purged so an idle bot doesn't accumulate stale users indefinitely
const SWEEP_SIZE = 500;

interface CacheEntry {
    expiresAt: number;
    allyCodes: number[];
    playerMap: Map<number, ArenaPlayer>;
}

const entries = new Map<string, CacheEntry>();

function sweepExpired(now: number): void {
    for (const [userId, entry] of entries) {
        if (entry.expiresAt <= now) entries.delete(userId);
    }
}

/**
 * Return autocomplete choices for a user's registered ally codes, served from the
 * per-user cache when fresh. searchKey must already be lowercased/trimmed.
 */
export async function getCachedAllyCodeChoices(userId: string, searchKey: string): Promise<{ name: string; value: string }[]> {
    const now = Date.now();
    let entry = entries.get(userId);

    if (!entry || entry.expiresAt <= now) {
        const user = await userReg.getUser(userId);
        const allyCodes = user?.accounts ?? [];
        const playerMap = allyCodes.length ? await arenaPlayerRegistry.batchGet(allyCodes) : new Map<number, ArenaPlayer>();
        entry = { expiresAt: now + ALLYCODE_CACHE_TTL_MS, allyCodes, playerMap };
        if (entries.size >= SWEEP_SIZE) sweepExpired(now);
        entries.set(userId, entry);
    }

    return buildAllyCodeChoices(entry.allyCodes, entry.playerMap, searchKey);
}

/**
 * Drop a user's cached entry. Production code relies on the TTL instead; this exists
 * for deterministic test isolation.
 */
export function invalidateAllyCodeCache(userId: string): void {
    entries.delete(userId);
}
