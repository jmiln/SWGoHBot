const config = require("../config");
const {
    addGuildEvent,
    deleteGuildEvent,
    getAllEvents,
    getGuildEvents,
    guildEventExists,
} = require("../modules/guildConfig/events.js");
const { getGuildSettings } = require("../modules/guildConfig/settings.js");
const { Server } = require("socket.io");
const io = new Server(config.eventServe.port);

async function init() {
    const { MongoClient } = require("mongodb");
    const mongo = await MongoClient.connect(config.mongodb.url);
    const cache = require("../modules/cache.js")(mongo);

    io.on("connection", socket => {
        console.log("Socket connected");
        setupEventHandlers(socket, cache);
    });
}

function setupEventHandlers(socket, cache) {
    socket.on("checkEvents", async (callback) => {
        try {
            const eventsOut = await processEvents(cache);
            callback(eventsOut);
        } catch (error) {
            console.error("Failed to check events:", error);
            callback([]);
        }
    });

    socket.on("addEvents", async ({ guildId, events }, callback) => {
        try {
            const results = await addEvents(cache, guildId, events);
            callback(results);
        } catch (error) {
            console.error("Failed to add events:", error);
            callback([]);
        }
    });

    socket.on("delEvent", async ({ guildId, eventName }, callback) => {
        try {
            const result = await removeEvent(cache, guildId, eventName);
            callback(result);
        } catch (error) {
            console.error("Failed to delete event:", error);
            callback({ eventName, success: false, error: error.message });
        }
    });

    socket.on("getEventByName", async ({ guildId, evName }, callback) => {
        try {
            const events = await getGuildEvents({ cache, guildId });
            callback(events.filter(ev => ev.name === evName));
        } catch (error) {
            console.error("Failed to get event by name:", error);
            callback([]);
        }
    });

    socket.on("getEventsByFilter", async (guildId, filterArr, callback) => {
        try {
            const events = await getEventsByFilter(cache, guildId, filterArr);
            callback(events);
        } catch (error) {
            console.error("Failed to get events by filter:", error);
            callback([]);
        }
    });

    socket.on("getEventsByGuild", async (guildId, callback) => {
        try {
            const events = await getGuildEvents({ cache, guildId });
            callback(events);
        } catch (error) {
            console.error("Failed to get events by guild:", error);
            callback([]);
        }
    });
}

async function processEvents(cache) {
    const nowTime = Date.now();
    const events = await getAllEvents({ cache });
    const eventsOut = events.filter(e => Number.parseInt(e.eventDT, 10) <= nowTime);

    for (const ev of events.filter(e => Number.parseInt(e.eventDT, 10) > nowTime && e.countdown)) {
        const guildConf = await getGuildSettings({ cache, guildId: ev.guildId });

        if (!guildConf?.eventCountdown?.length) continue;

        const timesToCountdown = new Set(guildConf.eventCountdown);
        const timeTil = ev.eventDT - nowTime;
        const { minute } = convertMS(timeTil);
        const cdMin = timesToCountdown.has(minute);

        if (cdMin) {
            ev.isCD = true;
            ev.name = `${ev.name}-CD${cdMin}`;
            eventsOut.push(ev);
        }
    }
    return eventsOut;
}

async function addEvents(cache, guildId, events) {
    const eventArr = Array.isArray(events) ? events : [events];
    const results = [];

    for (const event of eventArr) {
        const evRes = { event, success: true, error: null };
        const exists = await guildEventExists({ cache, guildId, evName: event.name });
        if (exists) {
            evRes.success = false;
            evRes.error = `Event "${event.name}" already exists`;
            results.push(evRes);
            continue;
        }
        event.countdown = event.countdown === "true" || event.countdown === true;

        try {
            await addGuildEvent({ cache, guildId, newEvent: event });
            results.push(evRes);
        } catch (error) {
            evRes.success = false;
            evRes.error = error.message;
            results.push(evRes);
        }
    }
    return results;
}

async function removeEvent(cache, guildId, eventName) {
    const res = { eventName, success: true, error: null };
    const exists = await guildEventExists({ cache, guildId, evName: eventName });

    if (!exists) {
        res.success = false;
        res.error = "Invalid event. Does not exist";
        return res;
    }

    try {
        await deleteGuildEvent({ cache, guildId, evName: eventName });
    } catch (error) {
        res.success = false;
        res.error = error.message;
    }
    return res;
}

async function getEventsByFilter(cache, guildId, filter) {
    const filterArr = Array.isArray(filter) ? filter : [filter];
    const events = await getGuildEvents({ cache, guildId });
    return events.filter(ev => filterArr.every(e => `${ev.message} ${ev.name}`.includes(e)));
}

function convertMS(milliseconds) {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const totalMin = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const hour = Math.floor(totalMin / 60);
    const minute = totalMin % 60;
    return { hour, minute, totalMin, seconds };
}

init();
