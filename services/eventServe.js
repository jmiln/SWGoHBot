const config = require("../dist/config");

const io = require("socket.io")(config.eventServe.port);

const Sequelize = require("sequelize");
const seqOps = Sequelize.Op;

const database = new Sequelize(
    config.database.data,
    config.database.user,
    config.database.pass, {
        host: config.database.host,
        dialect: "postgres",
        logging: false
    }
);

async function init() {
    try {
        await database.authenticate()
            .then(async () => {
                await require("../dist/modules/models")(Sequelize, database);
                const eventCount = await database.models.eventDBs.count();
                console.log(`Event Monitor online at port ${config.eventServe.port}.\nMonitoring ${eventCount} events.`);
            });
    } catch (err) {
        console.log("[ERROR] Cannot start event db");
        return console.error(err);
    }

    io.on("connection", async socket => {
        console.log("Socket connected");

        socket.on("checkEvents", async (callback) => {
            // Check all the events, and send back any that should be sent
            const nowTime = new Date().getTime();
            let events = await database.models.eventDBs.findAll();
            events = events.map(e => e.dataValues);

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
                const guildConf = await database.models.settings.findOne({where: {guildID: guildID}});

                if (!guildConf) continue;
                const guildConfDV = guildConf.dataValues;

                // Use the guild's eventCCountdown to calculate if it needs to send an event
                if (guildConfDV?.eventCountdown?.length) {
                    const timesToCountdown = guildConfDV.eventCountdown;
                    const nowTime = new Date().getTime();
                    const timeTil = ev.eventDT - nowTime;
                    const minTil  = parseInt(timeTil / (1000 * 60), 10);
                    let cdMin = null;

                    timesToCountdown.forEach(time => {
                        if (time === minTil) {
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
                const exists = await database.models.eventDBs.findOne({where: {eventID: event.eventID}});
                if (exists) { // If the event is already here, don't
                    evRes.success = false;
                    evRes.error = "Event already exists";
                    res.push(evRes);
                    continue;
                }
                if (event.countdown === "true") event.countdown = true;
                if (event.countdown === "false") event.countdown = false;
                await database.models.eventDBs.create(event)
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
            const exists = await database.models.eventDBs.findOne({where: {eventID: eventID}});
            if (!exists) {
                // Send back an error or something, and return
                res.success = false;
                res.error   = "Invalid event. Does not exist";
                return callback(res);
            }
            await database.models.eventDBs.destroy({where: {eventID: eventID}})
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
            const events = await database.models.eventDBs.findAll({where: {eventID: {[seqOps.in]: eventIDs}}});
            const eventDVs = events.map(e => e.dataValues);
            return callback(eventDVs);
        });

        socket.on("getEventsByGuild", async (guildID, callback) => { // eslint-disable-line no-unused-vars
            // Get and return all events for a server/ guild (For full view)
            const events = await database.models.eventDBs.findAll({where: {eventID: { [seqOps.like]: `${guildID}-%`}}});
            const eventDVs = events.map(e => e.dataValues);
            return callback(eventDVs);
        });
    });
}
init();
