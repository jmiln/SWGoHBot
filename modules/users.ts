import config from "../config.ts";
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
        const user = (await this.cache.getOne(config.mongodb.swgohbotdb, "users", { id: userId })) as UserConfig | null;
        return user || null;
    }

    async getUsersFromAlly(allyCode: string | number) {
        const allyCodeStr = Number(allyCode).toString();
        const users = (await this.cache.get(config.mongodb.swgohbotdb, "users", { "accounts.allyCode": allyCodeStr })) as UserConfig[];
        return users?.length ? users : null;
    }

    async updateUser(userId: string, userObj: UserConfig) {
        const newUser = (await this.cache.put(config.mongodb.swgohbotdb, "users", { id: userId }, userObj)) as UserConfig;
        return newUser;
    }

    async removeAllyCode(userId: string, allyCode: string | number) {
        const allyCodeStr = Number(allyCode).toString();
        const user = (await this.cache.getOne(config.mongodb.swgohbotdb, "users", { id: userId })) as UserConfig | null;
        if (!user) throw new Error("Could not find specified user");
        const exists = user.accounts.find((a) => a.allyCode === allyCodeStr);
        if (!exists) throw new Error("Specified ally code not linked to this user");
        user.accounts = user.accounts.filter((a) => a.allyCode !== allyCodeStr);
        return await this.cache.put(config.mongodb.swgohbotdb, "users", { id: userId }, user);
    }

    async removeUser(userId: string) {
        const result = await this.cache.remove(config.mongodb.swgohbotdb, "users", { id: userId });
        return !!result.deletedCount;
    }
}

// Create and export a singleton instance
const userReg = new UserReg();

export default userReg;
export { UserReg };
