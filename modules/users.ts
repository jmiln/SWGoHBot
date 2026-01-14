import type { BotType, UserConfig } from "../types/types.ts";

// const {inspect} = require("util");
export default (Bot: BotType) => {
    const cache = Bot.cache;

    return {
        // addUser: addUser,
        getUser: getUser,
        getUsersFromAlly: getUsersFromAlly,
        updateUser: updateUser,
        removeAllyCode: removeAllyCode,
        removeUser: removeUser,
    };

    // async function addUser(userId: string, allyCode: string) {
    //     try {
    //         if (!Bot.isUserID(userId)) {
    //             throw new Error("Invalid user ID.");
    //         }
    //         if (!Bot.isAllyCode(allyCode)) {
    //             throw new Error("Invalid ally code.");
    //         }
    //         let user: UserConfig = await cache.get(Bot.config.mongodb.swgohbotdb, "users", { id: userId });
    //         const defSettings = JSON.parse(JSON.stringify(Bot.config.defaultUserConf));
    //         defSettings.id = userId;
    //         defSettings.accounts = [
    //             {
    //                 allyCode: allyCode,
    //                 primary: true,
    //             },
    //         ];
    //
    //         if (!user || !user[0]) {
    //             // If they're not in there, put them in with the default settings
    //             user = await cache.put(Bot.config.mongodb.swgohbotdb, "users", { id: userId }, defSettings);
    //         } else {
    //             user = user[0];
    //         }
    //         return user;
    //     } catch (err) {
    //         return err;
    //     }
    // }

    async function getUser(userId: string) {
        // Get and return the user's info
        const user = await cache.getOne<UserConfig>(Bot.config.mongodb.swgohbotdb, "users", { id: userId });
        return user || null;
    }

    async function getUsersFromAlly(allyCode: string | number) {
        const users = await cache.get<UserConfig>(Bot.config.mongodb.swgohbotdb, "users", { "accounts.allyCode": allyCode?.toString() });
        return users?.length ? users : null;
    }

    async function updateUser(userId: string, userObj: UserConfig) {
        // Get and update a user's info
        const newUser = await cache.put<UserConfig>(Bot.config.mongodb.swgohbotdb, "users", { id: userId }, userObj);
        return newUser?.[0] || newUser;
    }

    async function removeAllyCode(userId: string, allyCode: string | number) {
        // Remove one of the ally codes from a user
        const user = (await cache.getOne<UserConfig>(Bot.config.mongodb.swgohbotdb, "users", { id: userId }));
        if (!user) throw new Error("Could not find specified user");
        const exists = user.accounts.find((a) => a.allyCode === allyCode);
        if (!exists) throw new Error("Specified ally code not linked to this user");
        user.accounts = user.accounts.filter((a) => a.allyCode !== allyCode);
        return await cache.put(Bot.config.mongodb.swgohbotdb, "users", { id: userId }, user);
    }

    async function removeUser(userId: string) {
        // Completely wipe a user?
        const res = await Bot.mongo
            .db(Bot.config.mongodb.swgohbotdb)
            .collection("users")
            .deleteOne({ id: userId })
            .then(() => {
                return true;
            })
            .catch(() => {
                return false;
            });
        return res;
    }
};
