const config = require("../../config.js");

module.exports = {
    setEvents,
    updateGuildEvent,
    getGuildEvents,
    addGuildEvent,
    guildEventExists,
    deleteGuildEvent,
    getAllEvents,
};

async function setEvents({ cache, guildId, evArrOut }) {
    if (!Array.isArray(evArrOut)) throw new Error("[/eventFuncs setEvents] Somehow have a non-array stOut");
    return await cache.put(config.mongodb.swgohbotdb, "guildConfigs", { guildId: guildId }, { events: evArrOut }, false);
}
async function updateGuildEvent({ cache, guildId, evName, event }) {
    const evList = await cache.getOne(config.mongodb.swgohbotdb, "guildConfigs", { guildId }, { events: 1, _id: 0 });
    const evIx = evList.events.findIndex((ev) => ev.name === evName);

    if (evIx < 0) return null; // Just to be doubly sure that it exists
    evList.events[evIx] = event;

    // Set the new event in the db
    const out = await cache
        .put(config.mongodb.swgohbotdb, "guildConfigs", { guildId }, { events: evList.events }, false)
        .then(() => {
            return { success: true, error: null };
        })
        .catch((error) => {
            // Bot.logger.error(`(Ev updateEvent)Broke trying to create new event \ninteraction: ${interaction.content}\nError: ${error}`);
            return { success: false, error: error };
        });
    return out;
}

async function getGuildEvents({ cache, guildId }) {
    if (!guildId) return [];
    const resArr = await cache.get(config.mongodb.swgohbotdb, "guildConfigs", { guildId: guildId }, { events: 1 });
    return resArr[0]?.events || [];
}
async function addGuildEvent({ cache, guildId, newEvent }) {
    const events = await getGuildEvents({ cache, guildId });
    events.push(newEvent);
    return await cache.put(config.mongodb.swgohbotdb, "guildConfigs", { guildId: guildId }, { events }, false);
}
async function guildEventExists({ cache, guildId, evName }) {
    const resArr = await getGuildEvents({ cache, guildId });
    const resIx = resArr?.findIndex((ev) => ev.name === evName);
    return resIx > -1;
}
async function deleteGuildEvent({ cache, guildId, evName }) {
    const res = await getGuildEvents({ cache, guildId });

    // Filter out the specific one that we want gone, then re-save em
    const evArrOut = res.filter((ev) => ev.name !== evName);
    return await cache.put(config.mongodb.swgohbotdb, "guildConfigs", { guildId: guildId }, { events: evArrOut }, false);
}
async function getAllEvents({ cache }) {
    const resArr = await cache.get(config.mongodb.swgohbotdb, "guildConfigs", {}, { guildId: 1, events: 1, _id: 0 });
    return resArr.reduce((acc, curr) => {
        if (!curr?.events?.length) return acc;
        return acc.concat(
            curr.events.map((ev) => {
                ev.guildId = curr.guildId;
                return ev;
            }),
        );
    }, []);
}
