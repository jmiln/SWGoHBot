import { env } from "../config/config.ts";
import type { BotCache } from "../types/cache_types.ts";
import type { UserConfig } from "../types/types.ts";

class UserReg {
    private cache!: BotCache;

    /**
     * Initialize the UserReg module with cache dependency
     */
    init(cache: BotCache): void {
        this.cache = cache;
    }

    async getUser(userId: string) {
        const user = (await this.cache.getOne(env.MONGODB_SWGOHBOT_DB, "users", { id: userId })) as UserConfig | null;
        return user || null;
    }

    async getUsersByIds(userIds: string[]): Promise<Map<string, UserConfig>> {
        const users = (await this.cache.get(env.MONGODB_SWGOHBOT_DB, "users", { id: { $in: userIds } })) as UserConfig[];
        const map = new Map<string, UserConfig>();
        for (const user of users ?? []) {
            if (user.id) map.set(user.id, user);
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

    async updateUser(userId: string, userObj: UserConfig) {
        const newUser = (await this.cache.put(env.MONGODB_SWGOHBOT_DB, "users", { id: userId }, userObj)) as UserConfig;
        return newUser;
    }

    /**
     * Write individual fields by dotted path (e.g. "arenaWatch.payout.char.msgID"), leaving the
     * rest of the document alone. For callers that own only a couple of fields and would
     * otherwise roll back whatever another task wrote since their copy was loaded - updateUser
     * `$set`s every top-level field of the object it is given.
     */
    async updateUserFields(userId: string, fields: Record<string, unknown>) {
        // No upsert: these are partial writes, so a user deleted since the caller loaded them must
        // stay deleted rather than be rebuilt from the id plus whichever paths this call happened
        // to carry. Nothing validates user documents on read, so such a record would go unnoticed.
        await this.cache.put(env.MONGODB_SWGOHBOT_DB, "users", { id: userId }, fields, true, false);
    }

    async removeAllyCode(userId: string, allyCode: number) {
        const user = (await this.cache.getOne(env.MONGODB_SWGOHBOT_DB, "users", { id: userId })) as UserConfig | null;
        if (!user) throw new Error("Could not find specified user");
        if (!user.accounts.includes(allyCode)) throw new Error("Specified ally code not linked to this user");
        user.accounts = user.accounts.filter((a) => a !== allyCode);
        if (user.primaryAllyCode === allyCode) {
            user.primaryAllyCode = user.accounts[0] ?? null;
        }
        // Payout alert markers are keyed by ally code and are only ever read for linked accounts,
        // so a leftover entry is inert - until the same code is relinked within the payout cycle it
        // last recorded, when it would suppress that cycle's alert. Drop it with the link.
        // (The arenaWatch equivalents live on the watch entry itself, so they go with it already.)
        if (user.arenaAlert?.alerted) {
            delete user.arenaAlert.alerted[String(allyCode)];
        }
        return await this.cache.put(env.MONGODB_SWGOHBOT_DB, "users", { id: userId }, user);
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
