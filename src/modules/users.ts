import { BotType, UserReg, UserRegAccount } from "./types";

// const {inspect} = require("util");
module.exports = (Bot: BotType) => {
    const cache = Bot.cache;

    return {
        addUser: addUser,
        getUser: getUser,
        getUserFromAlly: getUserFromAlly,
        updateUser: updateUser,
        removeAllyCode: removeAllyCode,
        removeUser: removeUser
    };

    async function addUser(userId: string, allyCode: number) {
        try {
            if (!Bot.isUserID(userId)) {
                throw new Error("Invalid user ID.");
            }
            if (!Bot.isAllyCode(allyCode)) {
                throw new Error("Invalid ally code.");
            }
            let user = await cache.get(Bot.config.mongodb.swgohbotdb, "users", {id: userId});
            const defSettings = JSON.parse(JSON.stringify(Bot.config.defaultUserConf));
            defSettings.id = userId;
            defSettings.accounts = [{
                allyCode: allyCode,
                primary: true
            }];

            if (!user || !user[0]) {
                // If they're not in there, put them in with the default settings
                user = await cache.put(Bot.config.mongodb.swgohbotdb, "users", {id: userId}, defSettings);
            } else {
                user = user[0];
            }
            return user;
        } catch (err) {
            return err;
        }
    }

    async function getUser(userId: string): Promise<UserReg> {
        // Get and return the user's info
        let user = await cache.get(Bot.config.mongodb.swgohbotdb, "users", {id: userId});
        if (!user || !user.length) return null;
        if (Array.isArray(user)) user = user[0];
        return user;
    }

    async function getUserFromAlly(allyCode: number | string): Promise<UserReg[]> {
        allyCode = allyCode.toString();
        const users = await cache.get(Bot.config.mongodb.swgohbotdb, "users", {"accounts.allyCode": allyCode});
        if (!users || !users.length) return null;
        return users;
    }

    async function updateUser(userId: string, userObj: UserReg): Promise<UserReg> {
        // Get and update a user's info
        let newUser = await cache.put(Bot.config.mongodb.swgohbotdb, "users", {id: userId}, userObj);
        if (Array.isArray(newUser)) newUser = newUser[0];
        return newUser;
    }

    async function removeAllyCode(userId: string, allyCode: number | string) {
        // Remove one of the ally codes from a user
        let user = await cache.get(Bot.config.mongodb.swgohbotdb, "users", {id: userId});
        if (Array.isArray(user)) user = user[0];
        if (!user) throw new Error("Could not find specified user");
        const exists = user.accounts.find((a: UserRegAccount) => a.allyCode === allyCode);
        if (!exists) throw new Error("Specified ally code not linked to this user");
        user.accounts = user.accounts.filter((a: UserRegAccount) => a.allyCode !== allyCode);
        return await cache.put(Bot.config.mongodb.swgohbotdb, "users", {id: userId}, user);
    }

    async function removeUser(userId: string) {
        // Completely wipe a user?
        const res = await Bot.mongo.db(Bot.config.mongodb.swgohbotdb).collection("users").deleteOne({id: userId})
            .then(() => { return true; })
            .catch(() => { return false; });
        return res;
    }
};
