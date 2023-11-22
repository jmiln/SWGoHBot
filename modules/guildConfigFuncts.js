const config = require("../config.js");

// Get the guildsettings from the mongo db
exports.getGuildSettings = async ({cache, guildId}) => {
    if (!guildId) {
        return config.defaultSettings;
    }
    const guildSettings = await cache.get(config.mongodb.swgohbotdb, "guildConfigs", {guildId: guildId}, {settings: 1});
    if (!guildSettings?.length) return config.defaultSettings;
    return {...config.defaultSettings, ...guildSettings[0].settings};
};

// Set any guildSettings that do not match the defaultSettings in the bot's config
exports.setGuildSettings = async (cache, guildId, settings) => {
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
    } else {
        return false;
    }
};

// Remove all settings, events, polls, etc for the given guild
exports.deleteGuildConfig = async ({cache, guildId}) => {
    return await cache.remove(config.mongodb.swgohbotdb, "guildConfigs", {guildId: guildId});
};

exports.setEvents = async function setEvents({cache, guildId, evArrOut}) {
    if (!Array.isArray(evArrOut)) throw new Error("[/eventFuncs setEvents] Somehow have a non-array stOut");
    return await cache.put(config.mongodb.swgohbotdb, "guildConfigs", {guildId: guildId}, {events: evArrOut}, false);
};
exports.updateGuildEvent = async function updateGuildEvent({cache, guildId, evName, event}) {
    const evList = await cache.getOne(config.mongodb.swgohbotdb, "guildConfigs", {guildId}, {events: 1, _id: 0});
    const evIx = evList.events.findIndex(ev => ev.name === evName);

    if (evIx < 0) return null; // Just to be doubly sure that it exists
    evList.events[evIx] = event;

    // Set the new event in the db
    const out = await cache.put(config.mongodb.swgohbotdb, "guildConfigs", {guildId}, {events: evList.events}, false)
        .then(() => {
            return { success: true, error: null };
        })
        .catch(error => {
            // Bot.logger.error(`(Ev updateEvent)Broke trying to create new event \ninteraction: ${interaction.content}\nError: ${error}`);
            return { success: false, error: error };
        });
    return out;
};

exports.getGuildEvents = async function getGuildEvents({cache, guildId}) {
    const resArr = await cache.get(config.mongodb.swgohbotdb, "guildConfigs", {guildId: guildId}, {events: 1});
    return resArr[0]?.events || [];
};
exports.addGuildEvent = async function addGuildEvent({cache, guildId, newEvent}) {
    const events = await this.getGuildEvents(guildId);
    events.push(newEvent);
    return await cache.put(config.mongodb.swgohbotdb, "guildConfigs", {guildId: guildId}, {events}, false);
};
exports.guildEventExists = async function guildEventExists({cache, guildId, evName}) {
    const resArr = await this.getGuildEvents({cache, guildId});
    const resIx = resArr?.findIndex(ev => ev.name === evName);
    return resIx > -1;
};
exports.deleteGuildEvent = async function deleteGuildEvent({cache, guildId, evName}) {
    const res = await this.getGuildEvents({cache, guildId});

    // Filter out the specific one that we want gone, then re-save em
    const evArrOut = res.filter(ev => ev.name !== evName);
    return await cache.put(config.mongodb.swgohbotdb, "guildConfigs", {guildId: guildId}, {events: evArrOut}, false);
};
exports.getAllEvents = async function getAllEvents({cache}) {
    const resArr = await cache.get(config.mongodb.swgohbotdb, "guildConfigs", {}, {guildId: 1, events: 1, _id: 0});
    return resArr.reduce((acc, curr) => {
        if (!curr?.events?.length) return acc;
        return [...acc, ...curr.events.map(ev => {
            ev.guildId = curr.guildId;
            return ev;
        })];
    }, []);
};



exports.getGuildPolls = async function getGuildPolls({cache, guildId}) {
    const resArr = await cache.get(config.mongodb.swgohbotdb, "guildConfigs", {guildId: guildId}, {polls: 1});
    const polls = resArr[0]?.polls;
    return polls || [];
};

exports.setGuildPolls = async function setGuildPolls({cache, guildId, pollsOut}) {
    // Filter out any settings that are the same as the defaults
    if (!Array.isArray(pollsOut)) throw new Error("[/poll setPolls] Somehow have a non-array pollsOut");
    return await cache.put(config.mongodb.swgohbotdb, "guildConfigs", {guildId: guildId}, {polls: pollsOut}, false);
};



exports.getGuildShardTimes = async function getTimes({cache, guildId}) {
    const resArr = await cache.get(config.mongodb.swgohbotdb, "guildConfigs", {guildId: guildId}, {shardtimes: 1});
    return resArr[0]?.shardtimes || [];
};

exports.setGuildShardTimes = async function setTimes({cache, guildId, stOut}) {
    if (!Array.isArray(stOut)) throw new Error("[/shardTimes setTimes] Somehow have a non-array stOut");
    return await cache.put(config.mongodb.swgohbotdb, "guildConfigs", {guildId: guildId}, {shardtimes: stOut}, false);
};


function arrayEquals(a, b) {
    if (!a?.length || !b?.length) return false;
    return Array.isArray(a) &&
        Array.isArray(b) &&
        a.length === b.length &&
        a.every((val, index) => val === b[index]);
}
