const config = require("../../config.js");

// Grab the tiers data file for use later
const patreonTiers = require("../../data/patreon.js");

exports.getPatreonSettings = async ({cache, guildId}) => {
    if (!guildId) return {};
    const res = await cache.getOne(config.mongodb.swgohbotdb, "guildConfigs", {guildId}, {patreonSettings: 1, _id: 0});
    return res?.patreonSettings || {};
};

exports.setPatreonSettings = async ({cache, guildId, patreonSettingsOut}) => {
    // Filter out any settings that are the same as the defaults
    const res = await cache.put(config.mongodb.swgohbotdb, "guildConfigs", {guildId}, {patreonSettings: patreonSettingsOut}, false)
        .then(() => {
            return { success: true, error: null };
        })
        .catch(error => {
            return { success: false, error: error };
        });
    return res;
};

// Function to:
//  - Add/update/remove a user & tier to the supporters list
//  - Supports consist of userID (Discord user ID), and tier (amount_cents/100)
// Returns success/ error for both the user setting & the guild one
exports.addServerSupporter = async ({cache, guildId, userInfo}) => {
    if (!guildId) return {success: false, error: "Missing guild ID."};
    if (!userInfo?.userId || !userInfo?.tier) return {success: false, error: "Missing userId or tier."};

    const res = await cache.getOne(config.mongodb.swgohbotdb, "guildConfigs", {guildId}, {patreonSettings: 1, _id: 0});
    const patSettings = res?.patreonSettings || {};
    const resOut = { user: null, guild: null };

    // If this guild doesn't have the supporters array, create it
    if (!patSettings?.supporters) patSettings.supporters = [];

    // Check if the user is already set in there
    if (patSettings.supporters?.filter(supp => supp.id === userInfo.id)?.length) return {success: false, error: "User already set."};

    // If the user isn't there yet, put them in
    patSettings.supporters.push(userInfo);

    resOut.guild = await cache.put(config.mongodb.swgohbotdb, "guildConfigs", {guildId}, {patreonSettings: patSettings}, false)
        .then(() => { return { success: true, error: null }; })
        .catch(error => { return { success: false, error: error }; });

    // ################
    // Set the userconf settings here too
    // ################

    // Get the userConf for the user running it
    const userConf = await cache.getOne(config.mongodb.swgohbotdb, "users", {id: userInfo.userId});
    if (!userConf) {
        resOut.user = { success: false, error: `Cannot find userConf for <@${userInfo.userId}>` };
    } else {
        // Set this server's ID in the user's config
        userConf.bonusServer = guildId;
        const newUser = await cache.put(config.mongodb.swgohbotdb, "users", {id: userInfo.userId}, userConf);

        if (!newUser && !newUser[0])
            resOut.user = { success: false, error: `Cannot update userConf for <@${userInfo.userId}>` };
        else
            resOut.user = { success: true, error: null };
    }

    return resOut;
};

//  - Get the users from the given guilds' supporters list if available
exports.getServerSupporters = async ({cache, guildId}) => {
    if (!guildId) return [];
    const res = await cache.getOne(config.mongodb.swgohbotdb, "guildConfigs", {guildId}, {patreonSettings: 1, _id: 0});
    return res?.patreonSettings?.supporters || [];
};


// Remove a user from the given guilds' supporters
exports.removeServerSupporter = async ({cache, guildId, userId}) => {
    if (!guildId) return [];
    const guildPatSettings = await cache.getOne(config.mongodb.swgohbotdb, "guildConfigs", {guildId}, {patreonSettings: 1, _id: 0});
    const hasUser = guildPatSettings?.patreonSettings?.supporters.filter(sup => sup.userId === userId)?.length > 1 ? true : false;

    // If the user isn't in the supporters arr, say so
    if (!hasUser) return { success: false, error: "User not in supporters array" };

    // Get the list of supporters without the user, then save it as such
    guildPatSettings.patreonSettings.supporters = guildPatSettings.patreonSettings.supporters.filter(sup => sup.userId !== userId);
    return await cache.put(config.mongodb.swgohbotdb, "guildConfigs", {guildId}, {patreonSettings: guildPatSettings}, false)
        .then(() => { return { success: true, error: null }; })
        .catch(error => { return { success: false, error: error }; });
};

// Remove all the server & user settings for a given user
// Returns success/ error for both the user setting & the guild one
exports.clearSupporterInfo = async ({cache, userId}) => {
    const userConf = await cache.getOne(config.mongodb.swgohbotdb, "users", {id: userId});
    const resOut = {
        user: {success: true, error: null},
        guild: {success: true, error: null}
    };

    // If there's no bonus server set, then don't bother
    if (!userConf?.bonusServer) return {success: true, error: null};

    // Otherwise, remove the set bonusServer from the user
    const thisBonusServer = userConf.bonusServer;
    userConf.bonusServer = null;
    try {
        await cache.put(config.mongodb.swgohbotdb, "users", {id: userId}, userConf);
    } catch (err) {
        resOut.user = {success: false, error: err.toString()};
    }

    // Then remove the user info from the previously bonusServer guild
    const gRemRes = this.removeServerSupporter({cache, guildId: thisBonusServer, userId});
    if (gRemRes.error) resOut.guild = {success: false, error: gRemRes.error};

    return resOut;
};

// Go through each server that has anyone in their supports array, and make sure those users still have it set to that server
exports.ensureGuildSupporter = async ({cache}) => {
    // Grab all guilds' patreonSettings that have someone listed
    const supporterGuilds = await cache.get(
        config.mongodb.swgohbotdb,
        "guildConfigs",
        {"patreonSettings.supporters": {$exists: true, $ne: []}},
        {supporters: "$patreonSettings.supporters", guildId: 1, _id: 0}
    );

    // Go through each of those, and check that each person listed in each of those has the given server selected, and if not, remove them from that guilds' list
    for (const guild of supporterGuilds) {
        // For each guild
        let isModified = false;
        for (const user of guild.supporters) {
            // Check each supporter against their userConf
            const userConf = await cache.getOne(config.mongodb.swgohbotdb, "users", {id: user.userId});

            // If the set bonusServer is the same as this guild's ID, it's fine, so move on
            if (userConf.bonusServer === guild.guildId) continue;

            // Otherwise, remove this user from the supporters list of that guild
            isModified = true;
            guild.supporters = guild.supporters.filter(sup => sup.userId !== user.userId);
        }

        // If the supporter list hasn't been modified, go on to the next one
        if (!isModified) continue;

        // Otherwise, resave it
        return await cache.put(config.mongodb.swgohbotdb, "guildConfigs", {guildId: guild.guildId}, {"patreonSettings.supporters": guild.supporters}, false)
            .then(() => { return { success: true, error: null }; })
            .catch(error => { return { success: false, error: error }; });
    }
};

// Make sure the user's info is logged correctly in the guild they have set
exports.ensureBonusServerSet = async ({cache, userId, amount_cents}) => {
    // If the user is active, and has a server linked, make sure it shows up in that guild's settings
    const userConf = await cache.getOne(config.mongodb.swgohbotdb, "users", {id: userId});

    // If they don't have their bonusServer set, move on
    if (!userConf?.bonusServer?.length) return {};

    // If they do have one set, try and get that guild's supporter list and make sure they're in there
    const guildSupArr = await this.getServerSupporters({cache, guildId: userConf.bonusServer});

    // The user is already in the guild's supporter array, move on
    if (guildSupArr.filter(sup => sup.userId === userId)?.length > 0) return {};

    // If the guild doesn't have anyone in their supporters array or this user isn't in there, create it/ add them
    const addServerRes = await this.addServerSupporter({
        cache,
        guildId: userConf.bonusServer,
        userInfo: {
            userId: userId,
            tier: Math.floor(amount_cents/100)
        }
    });

    return addServerRes;
};

//  - Get the combined / highest available tier from the supporters of a given server
const tierNums = Object.keys(patreonTiers.tiers);
exports.getGuildSupporterTier = async ({cache, guildId}) => {
    // If no guildId supplied, return the lowest tier available (0)
    if (!guildId) return 0;

    // Get the guild's patreon settings
    const res = await cache.getOne(config.mongodb.swgohbotdb, "guildConfigs", {guildId}, {patreonSettings: 1, _id: 0});

    // Add up tiers from here, and return a higher tier if they add up to one
    const totalRes = res?.patreonSettings?.supporters?.reduce((curr, acc) => curr += acc.tier, 0);
    for (const tier of tierNums.reverse()) {
        if (totalRes >= tier) return parseInt(tier, 10);
    }

    // If it gets to here (It shouldn't), return 0
    return 0;
};


//  - Figure out the settings for various sub-chunks, like auto-commands or guildtickets, etc
//      * Getter/ setter/ changer
//      * Change the guildtickets to be part of this mess/ allow any of the server mods to change it?
//      * Update the arenawatch to be saved in the guild config too, so anyone with perms can update it?
