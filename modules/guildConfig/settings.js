const config = require("../../config.js");

// Get the guildsettings from the mongo db
exports.getGuildSettings = async ({cache, guildId}) => {
    if (!guildId) return config.defaultSettings;

    const guildSettings = await cache.get(config.mongodb.swgohbotdb, "guildConfigs", {guildId: guildId}, {settings: 1});
    if (!guildSettings?.length) return config.defaultSettings;
    return {...config.defaultSettings, ...guildSettings[0].settings};
};

// Set any guildSettings that do not match the defaultSettings in the bot's config
exports.setGuildSettings = async ({cache, guildId, settings}) => {
    // Filter out any settings that are the same as the defaults
    const diffObj = {};

    for (const key of Object.keys(config.defaultSettings)) {
        const configVal = config.defaultSettings[key];
        if (Array.isArray(configVal)) {
            if (!arrayEquals(configVal, settings[key])) {
                diffObj[key] = settings[key];
            }
        } else if (config.defaultSettings[key] !== settings[key]) {
            diffObj[key] = settings[key];
        }
    }

    if (!Object.keys(diffObj)?.length) {
        // In this case, there's nothing different than the default, so go ahead and set it to blank
        return await cache.put(config.mongodb.swgohbotdb, "guildConfigs", {guildId: guildId}, {settings: {}}, false);
    }
    return await cache.put(config.mongodb.swgohbotdb, "guildConfigs", {guildId: guildId}, {settings: diffObj}, false);
};

// Check if there are settings for the guild
exports.hasGuildSettings = async (cache, guildId) => {
    const guildSettings = await cache.get(config.mongodb.swgohbotdb, "guildConfigs", {guildId: guildId}, {settings: 1});
    if (guildSettings?.length) {
        return true;
    }
    return false;
};

// Remove all settings, events, polls, etc for the given guild
exports.deleteGuildConfig = async ({cache, guildId}) => {
    return await cache.remove(config.mongodb.swgohbotdb, "guildConfigs", {guildId: guildId});
};

function arrayEquals(a, b) {
    if (!a?.length || !b?.length) return false;
    return Array.isArray(a) &&
        Array.isArray(b) &&
        a.length === b.length &&
        a.every((val, index) => val === b[index]) &&
        b.every((val, index) => val === a[index]);
}
