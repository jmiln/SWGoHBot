import { MongoClient } from "mongodb";
import type { Socket } from "socket.io";
import { Server } from "socket.io";
import config from "../config.js";
import cache from "../modules/cache.ts";
import logger from "../modules/Logger.ts";
import {
    addGuildEvent,
    deleteGuildEvent,
    getCountdownEvents,
    getGuildEvents,
    getTriggeredEvents,
    guildEventExists,
} from "../modules/guildConfig/events.ts";
import { getGuildSettings } from "../modules/guildConfig/settings.ts";
import type { GuildConfigEvent } from "../types/guildConfig_types.ts";

const io = new Server(config.eventServe.port);

async function init() {
    try {
        // Init this so it'll be ready for the event handlers
        const mongo = await MongoClient.connect(config.mongodb.url);
        cache.init(mongo);

        io.on("connection", (socket) => {
            logger.log("EventMgr: Socket connected");
            setupEventHandlers(socket);
        });

        logger.log(`EventMgr: Service started on port ${config.eventServe.port}`);
    } catch (error) {
        logger.error(`EventMgr: Failed to initialize - ${error.message}`);
        process.exit(1);
    }
}

// Handle uncaught errors
process.on("uncaughtException", (error) => {
    logger.error(`EventMgr: Uncaught exception - ${error.message}`);
    logger.error(String(error.stack));
});

process.on("unhandledRejection", (reason, promise) => {
    logger.error(`EventMgr: Unhandled rejection at ${promise}`);
    logger.error(`Reason: ${reason}`);
});

function setupEventHandlers(socket: Socket) {
    socket.on("checkEvents", async (callback) => {
        try {
            const eventsOut = await processEvents();
            callback(eventsOut);
        } catch (error) {
            logger.error(`Failed to check events: ${error}`);
            callback([]);
        }
    });

    socket.on("addEvents", async ({ guildId, events }, callback) => {
        try {
            const results = await addEvents(guildId, events);
            callback(results);
        } catch (error) {
            logger.error(`Failed to add events: ${error}`);
            callback([]);
        }
    });

    socket.on("delEvent", async ({ guildId, eventName }, callback) => {
        try {
            const result = await removeEvent(guildId, eventName);
            callback(result);
        } catch (error) {
            logger.error(`Failed to delete event: ${error}`);
            callback({ eventName, success: false, error: error.message });
        }
    });

    socket.on("getEventByName", async ({ guildId, evName }, callback) => {
        try {
            const events = await getGuildEvents({ guildId });
            callback(events.find((ev) => ev.name === evName));
        } catch (error) {
            logger.error(`Failed to get event by name: ${error}`);
            callback([]);
        }
    });

    socket.on("getEventsByFilter", async (guildId, filterArr, callback) => {
        try {
            const events = await getEventsByFilter(guildId, filterArr);
            callback(events);
        } catch (error) {
            logger.error(`Failed to get events by filter: ${error}`);
            callback([]);
        }
    });

    socket.on("getEventsByGuild", async (guildId, callback) => {
        try {
            const events = await getGuildEvents({ guildId });
            callback(events);
        } catch (error) {
            logger.error(`Failed to get events by guild: ${error}`);
            callback([]);
        }
    });
}

async function processEvents() {
    const nowTime = Date.now();

    // Use database-level filtering to get triggered events
    const triggeredEvents = await getTriggeredEvents({ nowTime });
    const eventsOut = [...triggeredEvents];

    // Get countdown events separately with database filtering
    const countdownEvents = await getCountdownEvents({ nowTime });

    // Process countdown events to check if they match configured countdown times
    for (const ev of countdownEvents) {
        const guildConf = await getGuildSettings({ guildId: ev.guildId });

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

async function addEvents(guildId: string, events: GuildConfigEvent | GuildConfigEvent[]) {
    const eventArr = Array.isArray(events) ? events : [events];
    const results = [];

    for (const event of eventArr) {
        const evRes = { event, success: true, error: null };
        const exists = await guildEventExists({ guildId, evName: event.name });
        if (exists) {
            evRes.success = false;
            evRes.error = `Event "${event.name}" already exists`;
            results.push(evRes);
            continue;
        }

        try {
            await addGuildEvent({ guildId, newEvent: event });
            results.push(evRes);
        } catch (error) {
            evRes.success = false;
            evRes.error = error.message;
            results.push(evRes);
        }
    }
    return results;
}

async function removeEvent(guildId: string, eventName: string) {
    const res = { eventName, success: true, error: null };
    const exists = await guildEventExists({ guildId, evName: eventName });

    if (!exists) {
        res.success = false;
        res.error = "Invalid event. Does not exist";
        return res;
    }

    try {
        await deleteGuildEvent({ guildId, evName: eventName });
    } catch (error) {
        res.success = false;
        res.error = error.message;
    }
    return res;
}

async function getEventsByFilter(guildId: string, filter: string | string[]) {
    const filterArr = Array.isArray(filter) ? filter : [filter];
    const events = await getGuildEvents({ guildId });
    return events.filter((ev) => filterArr.every((e) => `${ev.message} ${ev.name}`.includes(e)));
}

function convertMS(milliseconds: number) {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const totalMin = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const hour = Math.floor(totalMin / 60);
    const minute = totalMin % 60;
    return { hour, minute, totalMin, seconds };
}

init();
