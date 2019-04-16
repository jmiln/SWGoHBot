// const {inspect} = require("util");
module.exports = (client) => {
    const cache = client.cache;

    return {
        addUser: addUser,
        getUser: getUser,
        getUserFromAlly: getUserFromAlly,
        updateUser: updateUser,
        removeAllyCode: removeAllyCode,
        removeUser: removeUser
    };

    async function addUser( userId, allyCode ) {
        try {
            if (!client.isUserID(userId)) {
                throw new Error("Invalid user ID.");
            }
            if (!client.isAllyCode(allyCode)) {
                throw new Error("Invalid ally code.");
            }
            let user = await cache.get(client.config.mongodb.swgohbotdb, "users", {id: userId});
            const defSettings = JSON.parse(JSON.stringify(client.config.defaultUserConf));
            defSettings.id = userId;
            defSettings.accounts = [{
                allyCode: allyCode,
                primary: true
            }];

            if (!user || !user[0]) {
                // If they're not in there, put them in with the default settings
                user = await cache.put(client.config.mongodb.swgohbotdb, "users", {id: userId}, defSettings);
            } else {
                user = user[0];
            }
            return user;
        } catch (err) {
            return err;
        }
    }

    async function getUser(userId) {
        // Get and return the user's info
        let user = await cache.get(client.config.mongodb.swgohbotdb, "users", {id: userId});
        if (!user || !user.length) return null;
        if (Array.isArray(user)) user = user[0];
        return user;
    }

    async function getUserFromAlly(allyCode) {
        allyCode = allyCode.toString();
        const users = await cache.get(client.config.mongodb.swgohbotdb, "users", {"accounts.allyCode": allyCode});
        if (!users || !users.length) return null;
        return users;
    }

    async function updateUser(userId, userObj) {
        // Get and update a user's info
        let newUser = await cache.put(client.config.mongodb.swgohbotdb, "users", {id: userId}, userObj);
        if (Array.isArray(newUser)) newUser = newUser[0];
        return newUser;
    }

    async function removeAllyCode(userId, allyCode) {
        // Remove one of the ally codes from a user
        let user = await cache.get(client.config.mongodb.swgohbotdb, "users", {id: userId});
        if (Array.isArray(user)) user = user[0];
        if (!user) throw new Error("Could not find specified user");
        const exists = user.accounts.find(a => a.allyCode === allyCode);
        if (!exists) throw new Error("Specified ally code not linked to this user");
        user.accounts = user.accounts.filter(a => a.allyCode !== allyCode);
        return await cache.put(client.config.mongodb.swgohbotdb, "users", {id: userId}, user);
    }

    async function removeUser(userId) {
        // Completely wipe a user?
        const res = await client.mongo.db(client.config.mongodb.swgohbotdb).collection("users").deleteOne({id: userId})
            .then(() => { return true; })
            .catch(() => { return false; });
        return res;
    }
};
