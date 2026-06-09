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
        for (const user of users ?? []) {
            for (const allyCode of user.accounts ?? []) {
                if (allyCodes.includes(allyCode)) {
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

    async removeAllyCode(userId: string, allyCode: number) {
        const user = (await this.cache.getOne(env.MONGODB_SWGOHBOT_DB, "users", { id: userId })) as UserConfig | null;
        if (!user) throw new Error("Could not find specified user");
        if (!user.accounts.includes(allyCode)) throw new Error("Specified ally code not linked to this user");
        user.accounts = user.accounts.filter((a) => a !== allyCode);
        if (user.primaryAllyCode === allyCode) {
            user.primaryAllyCode = user.accounts[0] ?? null;
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
