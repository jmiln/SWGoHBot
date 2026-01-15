import type { BotType, UserConfig } from "../types/types.ts";

export default (Bot: BotType) => {
    const cache = Bot.cache;

    return {
        getUser: getUser,
        getUsersFromAlly: getUsersFromAlly,
        updateUser: updateUser,
        removeAllyCode: removeAllyCode,
        removeUser: removeUser,
    };

    async function getUser(userId: string) {
        const user = await cache.getOne<UserConfig>(Bot.config.mongodb.swgohbotdb, "users", { id: userId });
        return user || null;
    }

    async function getUsersFromAlly(allyCode: string | number) {
        const allyCodeStr = Number(allyCode).toString();
        const users = await cache.get<UserConfig>(Bot.config.mongodb.swgohbotdb, "users", { "accounts.allyCode": allyCodeStr });
        return users?.length ? users : null;
    }

    async function updateUser(userId: string, userObj: UserConfig) {
        const newUser = await cache.put<UserConfig>(Bot.config.mongodb.swgohbotdb, "users", { id: userId }, userObj);
        return newUser;
    }

    async function removeAllyCode(userId: string, allyCode: string | number) {
        const allyCodeStr = Number(allyCode).toString();
        const user = await cache.getOne<UserConfig>(Bot.config.mongodb.swgohbotdb, "users", { id: userId });
        if (!user) throw new Error("Could not find specified user");
        const exists = user.accounts.find((a) => a.allyCode === allyCodeStr);
        if (!exists) throw new Error("Specified ally code not linked to this user");
        user.accounts = user.accounts.filter((a) => a.allyCode !== allyCodeStr);
        return await cache.put(Bot.config.mongodb.swgohbotdb, "users", { id: userId }, user);
    }

    async function removeUser(userId: string) {
        const result = await cache.remove(Bot.config.mongodb.swgohbotdb, "users", { id: userId });
        return !!result.deletedCount;
    }
};
