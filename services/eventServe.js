const config = require("../config");

const { Server } = require("socket.io");
const io = new Server(config.eventServe.port);

async function init() {
    const MongoClient = require("mongodb").MongoClient;
    const mongo = await MongoClient.connect(config.mongodb.url);
    const cache   = require("../modules/cache.js")(mongo);

    io.on("connection", async socket => {
        console.log("Socket connected");

        socket.on("checkEvents", async (callback) => {
            // Check all the events, and send back any that should be sent
            const nowTime = new Date().getTime();
            const events = await getAllEvents();

            // Check on countdowns as well for each
            //  - This means for each event (With countdown enabled), we need to grab the guild's conf, and check their countdown settings
            //  - Probably send an extra bool along with each one to tell that it's a countdown, then the bot can calc how long til
            const eventsOut  = [];
            const pastEvents = events.filter(e => parseInt(e.eventDT, 10) <= nowTime);

            // Stick the events in that are ready to announce
            eventsOut.push(...pastEvents);

            // Grab all events that are in the future, but have countdowns enabled
            const futureCoutdownEvents = events.filter(e => (parseInt(e.eventDT, 10) > nowTime && e.countdown));
            for (const ev of futureCoutdownEvents) {
                let guildConf = await cache.get(config.mongodb.swgohbotdb, "guildConfigs", {guildId: ev.guildId}, {settings: 1});
                if (Array.isArray(guildConf)) guildConf = guildConf[0]?.settings;

                if (!guildConf) continue;

                // Use the guild's eventCCountdown to calculate if it needs to send an event
                if (guildConf?.eventCountdown?.length) {
                    const timesToCountdown = guildConf.eventCountdown;
                    const nowTime = new Date().getTime();
                    const timeTil = ev.eventDT - nowTime;
                    const msTil = convertMS(timeTil);
                    let cdMin = null;

                    timesToCountdown.forEach(time => {
                        if (time === msTil.minute) {
                            cdMin = time;
                            return;
                        }
                    });
                    if (cdMin) {
                        ev.isCD = true;
                        ev.name = `${ev.name}-CD${cdMin}`;
                        eventsOut.push(ev);
                    }
                }
            }

            // callback(pastEvents, futureCoutdownEvents);
            if (eventsOut.length) {
                // console.log(`Sending ${eventsOut.length} event(s) to the client`);
            }
            return callback(eventsOut);
        });

        socket.on("addEvents", async ({guildId, events}, callback) => {
            // Add new event(s) into the db
            if (!Array.isArray(events)) events = [events];
            const res = [];
            for (const event of events) {
                // Check for the existence of any events that match the name & channel, and if not, add it in
                const evRes = {evName: event.name, eventDT: event.eventDT, success: true, error: null};
                const exists = await guildEventExists({guildId: guildId, evName: event.name});
                if (exists) { // If the event is already here, don't
                    evRes.success = false;
                    evRes.error = `Event "${event.name}" already exists in this channel`;
                    res.push(evRes);
                    continue;
                }
                if (event.countdown === "true") event.countdown = true;
                if (event.countdown === "false") event.countdown = false;
                await addGuildEvent(guildId, event)
                    .then(() => {
                        // Push to the completed ones or whatever
                        res.push(evRes);
                    })
                    .catch((err) => {
                        // Push to invalid ones/ log the error
                        console.error(`Could not add the event ${event.name} (${event.channel})`);
                        console.error(err);

                        evRes.success = false;
                        evRes.error = err;
                        res.push(evRes);
                    });
            }
            callback(res);
        });

        socket.on("delEvent", async (guildId, eventName, callback) => {
            // Remove specified event if it exists
            const res = {evName: eventName, success: true, error: null};
            const exists = await guildEventExists({guildId: guildId, evName: eventName});
            if (!exists) {
                // Send back an error or something, and return
                res.success = false;
                res.error   = "Invalid event. Does not exist";
                return callback(res);
            }

            await deleteGuildEvent({guildId: guildId, evName: eventName})
                .then(() => {
                    // Log it here, nothing needs to update
                })
                .catch((err) => {
                    // Something broke, so set the errors to go back
                    res.success = false;
                    res.error = err;
                });
            // Send back the results, good or bad
            return callback(res);
        });

        socket.on("getEventByName", async ({guildId, evName}, callback) => {
            // Get and return a specific event (For view or trigger)
            const events = await getGuildEvents(guildId);
            return callback(events.filter(ev => ev.name === evName));
        });

        // Grab any events that match a filter
        socket.on("getEventsByFilter", async (guildId, filterArr, callback) => {
            // Get and return all matching events for a server/ guild
            if (!filterArr) return [];
            if (!Array.isArray(filterArr)) filterArr = [filterArr];
            const events = await getGuildEvents(guildId);
            const filteredEvents = events.filter(ev => {
                return filterArr.every(e => `${e.message} ${e.name}`.includes(ev));
            });
            return callback(filteredEvents);
        });

        socket.on("getEventsByGuild", async (guildId, callback) => {
            // Get and return all events for a server/ guild (For full view)
            const events = await getGuildEvents(guildId);
            return callback(events);
        });
    });

    async function getGuildEvents(guildId) {
        const resArr = await cache.get(config.mongodb.swgohbotdb, "guildConfigs", {guildId: guildId}, {events: 1});
        return resArr[0]?.events || [];
    }
    async function addGuildEvent(guildId, newEvent) {
        const events = await getGuildEvents(guildId);
        events.push(newEvent);
        await setGuildEvents(guildId, events);
    }
    async function setGuildEvents(guildId, evArrOut) {
        if (!Array.isArray(evArrOut)) throw new Error("[/eventFuncs setEvents] Somehow have a non-array evArrOut");
        return await cache.put(config.mongodb.swgohbotdb, "guildConfigs", {guildId: guildId}, {events: evArrOut}, false);
    }
    async function guildEventExists({guildId, evName}) {
        const resArr = await cache.get(config.mongodb.swgohbotdb, "guildConfigs", {guildId: guildId}, {events: 1});
        const resIx = resArr[0]?.events.indexOf(ev => ev.name === evName);
        return resIx > -1;
    }
    async function deleteGuildEvent({guildId, evName}) {
        const res = await cache.get(config.mongodb.swgohbotdb, "guildConfigs", {guildId: guildId}, {events: 1});
        const evArr = res.events;

        // Filter out the specific one that we want gone, then re-save em
        const evArrOut = evArr.filter(ev => ev.name !== evName);
        return await cache.put(config.mongodb.swgohbotdb, "guildConfigs", {guildId: guildId}, {events: evArrOut}, false);
    }
    async function getAllEvents() {
        const resArr = await cache.get(config.mongodb.swgohbotdb, "guildConfigs", {}, {guildId: 1, events: 1, _id: 0});
        return resArr.reduce((acc, curr) => {
            if (!curr?.events?.length) return acc;
            return [...acc, ...curr.events.map(ev => {
                ev.guildId = curr.guildId;
                return ev;
            })];
        }, []);
    }

}

function convertMS(milliseconds) {
    var hour, totalMin, minute, seconds;
    seconds = Math.floor(milliseconds / 1000);
    totalMin = Math.floor(seconds / 60);
    seconds = seconds % 60;
    hour = Math.floor(totalMin / 60);
    minute = totalMin % 60;
    return {
        hour: hour,
        minute: minute,
        totalMin: totalMin,
        seconds: seconds
    };
}

init();
