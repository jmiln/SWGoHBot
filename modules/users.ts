import { isDeepStrictEqual } from "node:util";
import type { Document } from "mongodb";
import { env } from "../config/config.ts";
import type { BotCache } from "../types/cache_types.ts";
import type { UserConfig } from "../types/types.ts";

// Rewritten on every save, and _id cannot be set at all
const UNTRACKED_FIELDS = ["_id", "updated", "updatedAt"];

// List entries carrying this key are saved by it rather than by position, so an edit lands on the
// same account even if another writer removed or reordered entries since the copy was loaded
const LIST_ENTRY_KEY = "allyCode";

type FieldChanges = { set: Record<string, unknown>; unset: Record<string, "">; arrayFilters: Map<string, Document> };

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null && !Array.isArray(value) && [Object.prototype, null].includes(Object.getPrototypeOf(value));

const changeCount = (changes: FieldChanges) => Object.keys(changes.set).length + Object.keys(changes.unset).length;

function trackedFields(user: UserConfig): Record<string, unknown> {
    const fields: Record<string, unknown> = { ...user };
    for (const field of UNTRACKED_FIELDS) delete fields[field];
    return fields;
}

// The entry keys of two lists holding the same entries in the same order, or null when an entry was
// added, removed or reordered, which only writing the whole list can express
function sameEntryKeys(before: unknown, after: unknown): number[] | null {
    if (!Array.isArray(before) || !Array.isArray(after) || before.length !== after.length) return null;
    const keys = after.map((entry) => (isPlainObject(entry) ? entry[LIST_ENTRY_KEY] : undefined));
    const keyed = keys.every(
        (key, ix) => Number.isSafeInteger(key) && (key as number) > 0 && isPlainObject(before[ix]) && before[ix][LIST_ENTRY_KEY] === key,
    );
    return keyed && new Set(keys).size === keys.length ? (keys as number[]) : null;
}

function collectChanges(changes: FieldChanges, path: string, before: unknown, after: unknown): void {
    if (isDeepStrictEqual(before, after)) return;

    if (isPlainObject(before) && isPlainObject(after)) {
        for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
            const childPath = path ? `${path}.${key}` : key;
            if (after[key] !== undefined) {
                collectChanges(changes, childPath, before[key], after[key]);
            } else if (before[key] !== undefined) {
                changes.unset[childPath] = "";
            }
        }
        return;
    }

    const entryKeys = sameEntryKeys(before, after);
    if (entryKeys && Array.isArray(before) && Array.isArray(after)) {
        entryKeys.forEach((key, ix) => {
            const id = `entry${key}`;
            const countBefore = changeCount(changes);
            collectChanges(changes, `${path}.$[${id}]`, before[ix], after[ix]);
            // MongoDB rejects an array filter that no path uses
            if (changeCount(changes) > countBefore) changes.arrayFilters.set(id, { [`${id}.${LIST_ENTRY_KEY}`]: key });
        });
        return;
    }

    changes.set[path] = after;
}

class UserReg {
    private cache!: BotCache;
    // Each user handed out, as it was read or last saved, so updateUser can tell what the caller changed
    private readonly loadedCopies = new WeakMap<UserConfig, Record<string, unknown>>();

    private track<T extends UserConfig | null>(user: T): T {
        if (user) this.loadedCopies.set(user, structuredClone(trackedFields(user)));
        return user;
    }

    /**
     * Initialize the UserReg module with cache dependency
     */
    init(cache: BotCache): void {
        this.cache = cache;
    }

    async getUser(userId: string) {
        const user = (await this.cache.getOne(env.MONGODB_SWGOHBOT_DB, "users", { id: userId })) as UserConfig | null;
        return this.track(user || null);
    }

    async getUsersByIds(userIds: string[]): Promise<Map<string, UserConfig>> {
        const users = (await this.cache.get(env.MONGODB_SWGOHBOT_DB, "users", { id: { $in: userIds } })) as UserConfig[];
        const map = new Map<string, UserConfig>();
        for (const user of users ?? []) {
            if (user.id) map.set(user.id, this.track(user));
        }
        return map;
    }

    async getUsersByAllyCodes(allyCodes: number[]): Promise<Map<number, UserConfig[]>> {
        const users = (await this.cache.get(env.MONGODB_SWGOHBOT_DB, "users", {
            accounts: { $in: allyCodes },
        })) as UserConfig[];
        const map = new Map<number, UserConfig[]>();
        const wantedCodes = new Set(allyCodes);
        for (const user of users ?? []) {
            for (const allyCode of user.accounts ?? []) {
                if (wantedCodes.has(allyCode)) {
                    if (!map.has(allyCode)) map.set(allyCode, []);
                    map.get(allyCode)?.push(user);
                }
            }
        }
        return map;
    }

    async getUsersFromAlly(allyCode: number) {
        const users = (await this.cache.get(env.MONGODB_SWGOHBOT_DB, "users", {
            accounts: allyCode,
        })) as UserConfig[];
        return users?.length ? users : null;
    }

    // Background jobs write into the documents commands edit; saving a loaded copy whole would roll them back
    async updateUser(userId: string, userObj: UserConfig) {
        const loaded = this.loadedCopies.get(userObj);
        if (!loaded) {
            const newUser = (await this.cache.put(env.MONGODB_SWGOHBOT_DB, "users", { id: userId }, userObj)) as UserConfig;
            return this.track(newUser);
        }

        const changes: FieldChanges = { set: {}, unset: {}, arrayFilters: new Map() };
        collectChanges(changes, "", loaded, trackedFields(userObj));
        if (changeCount(changes)) {
            const hasUnset = Object.keys(changes.unset).length > 0;
            // No upsert, for the same reason as updateUserFields
            await this.cache.update<Document>(
                env.MONGODB_SWGOHBOT_DB,
                "users",
                { id: userId },
                { $set: { ...changes.set, updated: Date.now(), updatedAt: new Date() }, ...(hasUnset ? { $unset: changes.unset } : {}) },
                { arrayFilters: [...changes.arrayFilters.values()] },
            );
        }
        return this.track(userObj);
    }

    /**
     * Write individual fields by dotted path (e.g. "arenaWatch.payout.char.msgID"), leaving the
     * rest of the document alone. For callers that own only a couple of fields and hold no copy
     * from getUser/getUsersByIds for updateUser to compare against.
     */
    async updateUserFields(userId: string, fields: Record<string, unknown>, onlyIfStillMatches: Record<string, unknown> = {}) {
        // No upsert: these are partial writes, so a user deleted since the caller loaded them must
        // stay deleted rather than be rebuilt from the id plus whichever paths this call happened
        // to carry. Nothing validates user documents on read, so such a record would go unnoticed.
        await this.cache.put(env.MONGODB_SWGOHBOT_DB, "users", { ...onlyIfStillMatches, id: userId }, fields, true, false);
    }

    async removeAllyCode(userId: string, allyCode: number) {
        const user = await this.getUser(userId);
        if (!user) throw new Error("Could not find specified user");
        if (!user.accounts.includes(allyCode)) throw new Error("Specified ally code not linked to this user");
        user.accounts = user.accounts.filter((a) => a !== allyCode);
        if (user.primaryAllyCode === allyCode) {
            user.primaryAllyCode = user.accounts[0] ?? null;
        }
        // A leftover payout marker would suppress the alert if this code is relinked inside the
        // cycle it last recorded, so drop it with the link.
        if (user.arenaAlert?.alerted) {
            delete user.arenaAlert.alerted[String(allyCode)];
        }
        return await this.updateUser(userId, user);
    }

    async removeUser(userId: string) {
        const result = await this.cache.remove(env.MONGODB_SWGOHBOT_DB, "users", { id: userId });
        return !!result.deletedCount;
    }
}

// Create and export a singleton instance
const userReg = new UserReg();

export default userReg;
export { UserReg };
