import type { ArenaPlayer, GuildAlias } from "../types/types.ts";
import arenaPlayerRegistry from "./arenaPlayerRegistry.ts";
import { buildAllyCodeChoices } from "./functions.ts";
import { getGuildAliases } from "./guildConfig/aliases.ts";
import userReg from "./users.ts";

/**
 * Short-TTL in-memory cache for autocomplete data.
 *
 * Discord fires an autocomplete event on every keystroke, and each one previously cost
 * indexed Mongo queries that returned identical data for the whole typing session. The
 * first keystroke fetches the full candidate set; subsequent keystrokes filter it in
 * memory until the TTL lapses.
 *
 * The TTL only needs to outlast a single typing session — each new command pulls fresh
 * data, so changes (register, userconf add/remove, alias edits) show up on the next
 * command without any explicit invalidation.
 */

export const AUTOCOMPLETE_CACHE_TTL_MS = 15_000;

// Lazy sweep threshold — when an insert pushes the cache past this size, expired
// entries are purged so an idle bot doesn't accumulate stale entries indefinitely
const SWEEP_SIZE = 500;

interface CacheEntry {
    expiresAt: number;
    value: unknown;
}

const entries = new Map<string, CacheEntry>();

function sweepExpired(now: number): void {
    for (const [key, entry] of entries) {
        if (entry.expiresAt <= now) entries.delete(key);
    }
}

// Generic TTL-cached fetch — returns the cached value when fresh, otherwise runs the
// fetcher and caches its result
async function getCached<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
    const now = Date.now();
    const entry = entries.get(key);
    if (entry && entry.expiresAt > now) return entry.value as T;

    const value = await fetcher();
    if (entries.size >= SWEEP_SIZE) sweepExpired(now);
    entries.set(key, { expiresAt: now + AUTOCOMPLETE_CACHE_TTL_MS, value });
    return value;
}

/**
 * Return autocomplete choices for a user's registered ally codes, served from the
 * per-user cache when fresh. searchKey must already be lowercased/trimmed.
 */
export async function getCachedAllyCodeChoices(userId: string, searchKey: string): Promise<{ name: string; value: string }[]> {
    const { allyCodes, playerMap } = await getCached(`allycodes:${userId}`, async () => {
        const user = await userReg.getUser(userId);
        const allyCodes = user?.accounts ?? [];
        const playerMap = allyCodes.length ? await arenaPlayerRegistry.batchGet(allyCodes) : new Map<number, ArenaPlayer>();
        return { allyCodes, playerMap };
    });
    return buildAllyCodeChoices(allyCodes, playerMap, searchKey);
}

/**
 * Return a guild's unit aliases for autocomplete, served from the per-guild cache when
 * fresh. Unit autocomplete is the hottest path in the bot, and aliases only change when
 * someone edits them.
 */
export async function getCachedGuildAliases(guildId: string | undefined): Promise<GuildAlias[]> {
    if (!guildId) return [];
    return getCached(`aliases:${guildId}`, () => getGuildAliases({ guildId }));
}

/**
 * Drop a user's cached allycode entry. Production code relies on the TTL instead; this
 * exists for deterministic test isolation.
 */
export function invalidateAllyCodeCache(userId: string): void {
    entries.delete(`allycodes:${userId}`);
}
