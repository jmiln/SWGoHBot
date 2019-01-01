// const {inspect} = require("util");  
module.exports = (client) => {
    const cache = client.cache;

    return {
        user: user
    };

    async function user( userID ) {
        try {
            if (!client.isUserID(userID)) {
                throw new Error("Invalid user ID.");
            }
            let user = await cache.get("swgohbot", "users", {userID: userID});

            if (!user || !user[0]) {
                // If they're not in there, put them in with the default settings
                user = await cache.put("swgohbot", "users", {userID: userID}, client.config.defaultUserConf);
            } else {
                user = user[0];
            }
            return user;
        } catch (err) {
            return err;
        }
    }
};
