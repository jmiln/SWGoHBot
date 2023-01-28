const config = require("../config");

const io = require("socket.io")(config.eventServe.port);

async function init() {
    const MongoClient = require("mongodb").MongoClient;
    const mongo = await MongoClient.connect(config.mongodb.url);
    const cache   = require("../modules/cache.js")(mongo);

    io.on("connection", async socket => {
        // console.log("Socket connected");

        socket.on("checkEvents", async (callback) => {
            // Check all the events, and send back any that should be sent
            const nowTime = new Date().getTime();
            const events = await cache.get(config.mongodb.swgohbotdb, "eventDBs");

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
                const guildID = ev.eventID.split("-")[0];
                let guildConf = await cache.get(config.mongodb.swgohbotdb, "guildSettings", {guildId: guildID});
                if (Array.isArray(guildConf)) guildConf = guildConf[0];

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
                        ev.eventID = `${ev.eventID}-CD${cdMin}`;
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

        socket.on("addEvents", async (events, callback) => {
            // Add new event(s) into the db
            if (!Array.isArray(events)) events = [events];
            const res = [];
            // const res = {evID: eventID, success: true, error: null};
            for (const event of events) { // eslint-disable-line no-unused-vars
                // Check for the existence of any events that match the ID, and if not, add it in
                const evRes = {evID: event.eventID, eventDT: event.eventDT, success: true, error: null};
                const exists = await cache.exists(config.mongodb.swgohbotdb, "eventDBs", {eventID: event.eventID});
                if (exists) { // If the event is already here, don't
                    evRes.success = false;
                    evRes.error = "Event already exists";
                    res.push(evRes);
                    continue;
                }
                if (event.countdown === "true") event.countdown = true;
                if (event.countdown === "false") event.countdown = false;
                await cache.put(config.mongodb.swgohbotdb, "eventDBs", {eventID: event.eventID}, event)
                    .then(() => {
                        // Push to the completed ones or whatever
                        res.push(evRes);
                    })
                    .catch((err) => {
                        // Push to invalid ones/ log the error
                        console.error("Could not add the event " + event.eventID);
                        console.error(err);

                        evRes.success = false;
                        evRes.error = err;
                        res.push(evRes);
                    });
            }
            callback(res);
        });

        socket.on("delEvent", async (eventID, callback) => {
            // Remove specified event if it exists
            const res = {evID: eventID, success: true, error: null};
            const exists = await cache.exists(config.mongodb.swgohbotdb, "eventDBs", {eventID: eventID});
            if (!exists) {
                // Send back an error or something, and return
                res.success = false;
                res.error   = "Invalid event. Does not exist";
                return callback(res);
            }

            await cache.remove(config.mongodb.swgohbotdb, "eventDBs", {eventID: eventID})
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

        socket.on("getEventsByID", async (eventIDs, callback) => { // eslint-disable-line no-unused-vars
            if (!Array.isArray(eventIDs)) eventIDs = [eventIDs];
            // Get and return a specific event (For view or trigger)
            const events = await cache.get(config.mongodb.swgohbotdb, "eventDBs", {eventID: {$in: eventIDs}});
            return callback(events);
        });

        // Grab any events that match a filter
        socket.on("getEventsByFilter", async (guildID, filterArr, callback) => { // eslint-disable-line no-unused-vars
            // Get and return all matching events for a server/ guild
            // select * from "eventDBs" WHERE string_to_array(LOWER("eventMessage"), ' ') || string_to_array(LOWER("eventID"), '-') @> '{"@everyone","301814154136649729"}';
            if (!filterArr) return [];
            if (!Array.isArray(filterArr)) filterArr = [filterArr];
            const events = await cache.get(config.mongodb.swgohbotdb, "eventDBs", {
                eventID: new RegExp(`^${guildID}-`)
            });
            const filteredEvents = events.filter(ev => {
                return filterArr.every(e => `${ev.message} ${ev.eventID}`.includes(e));
            });
            return callback(filteredEvents);
        });

        socket.on("getEventsByGuild", async (guildID, callback) => { // eslint-disable-line no-unused-vars
            // Get and return all events for a server/ guild (For full view)
            const events = await cache.get(config.mongodb.swgohbotdb, "eventDBs", {eventID: new RegExp(`^${guildID}-`)});
            return callback(events);
        });
    });
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
