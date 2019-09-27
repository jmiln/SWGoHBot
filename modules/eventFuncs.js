const momentTZ = require("moment-timezone");
require("moment-duration-format");

module.exports = (Bot, client) => {
    // The scheduler for events
    Bot.schedule = require("node-schedule");

    // Bunch of stuff for the events
    Bot.loadAllEvents = async () => {
        let ix = 0;
        const nowTime = momentTZ().unix() * 1000;                       // The current time of it running
        const oldTime = momentTZ().subtract(20, "m").unix() * 1000;     // 20 min ago, don't try again if older than this
        const events = await Bot.database.models.eventDBs.findAll();

        const eventList = [];
        for (let i = 0; i < events.length; i++ ) {
            const event = events[i];
            const eventNameID = event.eventID.split("-");
            const guildID = eventNameID[0];

            // Make sure it only loads events for it's shard
            if (client.guilds.keyArray().includes(guildID)) {
                const guildSettings = await Bot.database.models.settings.findOne({where: {guildID: guildID}, attributes: Object.keys(Bot.config.defaultSettings)});
                const guildConf = guildSettings.dataValues;
                eventList.push([event.dataValues, guildConf]);
            }
        }

        if (eventList.length > 0) {
            for (let i = 0; i < eventList.length; i++ ) {
                const [event, guildConf] = eventList[i];
                // If it's past when it was supposed to announce
                if (event.eventDT < nowTime) {
                    // If it's been skipped over somehow (probably bot reboot or discord connection issue)
                    if (event.eventDT > oldTime) {
                        // If it's barely missed the time (within 20min), then send it late, but with a
                        // note about it being late, then re-schedule if needed
                        let eventName = event.eventID.split("-");
                        const guildID = eventName.splice(0, 1)[0];
                        eventName = eventName.join("-");

                        const lang = Bot.languages[guildConf.language] || Bot.languages["en_US"];

                        // Alert them that it was skipped with a note
                        const announceMessage = `**${eventName}**\n${event.eventMessage} \n\n${Bot.codeBlock(lang.get("BASE_EVENT_LATE"))}`;
                        if (guildConf["announceChan"] != "" || event.eventChan !== "") {
                            if (event["eventChan"] && event.eventChan !== "") { // If they've set a channel, use it
                                try {
                                    Bot.announceMsg(client.guilds.get(guildID), announceMessage, event.eventChan);
                                } catch (e) {
                                    Bot.log("ERROR", "Broke trying to announce event with ID: ${ev.eventID} \n${e}");
                                }
                            } else { // Else, use the default one from their settings
                                Bot.announceMsg(client.guilds.get(guildID), announceMessage);
                            }
                        }
                    }
                    if (event.repeatDays.length || (event.repeat.repeatDay || event.repeat.repeatHour || event.repeat.repeatMin)) {
                        // If it's got a repeat set up, simulate it/ find the next viable time then re-set it in the future/ wipe the old one
                        const tmpEv = await reCalc(event, nowTime);
                        if (tmpEv) {
                            // Got a viable next time, so set it and move on
                            event.eventDT = tmpEv.eventDT;
                            event.repeatDays = tmpEv.repeatDays;
                            event.repeat = tmpEv.repeat;
                            // Save it back with the new values
                            await Bot.database.models.eventDBs.update(event, {where: {eventID: event.eventID}})
                                .then(async () => {
                                    Bot.scheduleEvent(event, guildConf.eventCountdown);
                                });
                        } else {
                            // There was no viable next time, so wipe it out
                            await Bot.database.models.eventDBs.destroy({where: {eventID: event.eventID}})
                                .catch(error => { Bot.log("ERROR",`Broke trying to delete zombies ${error}`); });
                        }
                    } else {
                        // If no repeat and it's long-gone, just wipe it from existence
                        await Bot.database.models.eventDBs.destroy({where: {eventID: event.eventID}})
                            .catch(error => { Bot.log("ERROR",`Broke trying to delete zombies ${error}`); });
                    }
                } else {
                    ix++;
                    Bot.scheduleEvent(event, guildConf.eventCountdown);
                }
            }
        }
        console.log(`Loaded ${ix} events`);
    };

    // Actually schedule em here
    Bot.scheduleEvent = async (event, countdown) => {
        if (Object.keys(Bot.schedule.scheduledJobs).indexOf(event.eventID) > -1) {
            return;
        }
        Bot.schedule.scheduleJob(event.eventID, parseInt(event.eventDT), function() {
            Bot.eventAnnounce(event);
        });

        if (countdown.length && (event.countdown === "true" || event.countdown === "yes" || event.countdown === true)) {
            const timesToCountdown = countdown;
            const nowTime = momentTZ().unix() * 1000;
            timesToCountdown.forEach(time => {
                const cdTime = time * 60;
                const evTime = event.eventDT / 1000;
                const newTime = (evTime-cdTime-60) * 1000;
                if (newTime > nowTime) {    // If the countdown is between now and the event
                    const sID = `${event.eventID}-CD${time}`;
                    if (!Bot.evCountdowns[event.eventID]) {
                        Bot.evCountdowns[event.eventID] = [sID];
                    } else {
                        Bot.evCountdowns[event.eventID].push(sID);
                    }
                    Bot.schedule.scheduleJob(sID, parseInt(newTime) , function() {
                        Bot.countdownAnnounce(event);
                    });
                }
            });
        }
    };

    // Re-caclulate a viable eventDT, and return the updated event
    async function reCalc(ev, nowTime) {
        if (ev.repeatDays.length > 0) { // repeatDays is an array of days to skip
            // If it's got repeatDays set up, splice the next time, and if it runs out of times, return null
            while (nowTime > ev.eventDT && ev.repeatDays.length > 0) {
                const days = ev.repeatDays.splice(0, 1)[0];
                ev.eventDT = momentTZ(parseInt(ev.eventDT)).add(parseInt(days), "d").unix()*1000;
            }
            if (nowTime > ev.eventDT) { // It ran out of days
                return null;
            }
        } else { // 0d0h0m
            // Else it's using basic repeat
            while (nowTime > ev.eventDT) {
                ev.eventDT = momentTZ(parseInt(ev.eventDT)).add(ev.repeat.repeatDay, "d").add(ev.repeat.repeatHour, "h").add(ev.repeat.repeatMin, "m").unix()*1000;
            }
        }
        return ev;
    }

    // Delete em here as needed
    Bot.deleteEvent = async (eventID) => {
        const event = await Bot.database.models.eventDBs.findOne({where: {eventID: eventID}});

        await Bot.database.models.eventDBs.destroy({where: {eventID: eventID}})
            .then(() => {
                const eventToDel = Bot.schedule.scheduledJobs[eventID];
                if (!eventToDel) {
                    console.log("Could not find scheduled event to delete: " + event);
                } else {
                    eventToDel.cancel();
                }
            })
            .catch(error => {
                Bot.log("ERROR",`Broke deleting an event ${error}`);
            });

        if (Bot.evCountdowns[event.eventID] && (event.countdown === "true" || event.countdown === "yes")) {
            Bot.evCountdowns[event.eventID].forEach(time => {
                const eventToDel = Bot.schedule.scheduledJobs[time];
                if (eventToDel) {
                    eventToDel.cancel();
                }
            });
        }
    };

    // To stick into node-schedule for each countdown event
    Bot.countdownAnnounce = async (event) => {
        let eventName = event.eventID.split("-");
        const guildID = eventName.splice(0, 1)[0];
        eventName = eventName.join("-");

        const guildSettings = await Bot.database.models.settings.findOne({where: {guildID: guildID}, attributes: Object.keys(Bot.config.defaultSettings)});
        const guildConf = guildSettings.dataValues;

        var timeToGo = momentTZ.duration(momentTZ().diff(momentTZ(parseInt(event.eventDT)), "minutes") * -1, "minutes").format(`h [${Bot.languages[guildConf.language].getTime("HOUR", "SHORT_SING")}], m [${Bot.languages[guildConf.language].getTime("MINUTE", "SHORT_SING")}]`);
        var announceMessage = Bot.languages[guildConf.language].get("BASE_EVENT_STARTING_IN_MSG", eventName, timeToGo);

        if (guildConf["announceChan"] != "" || event.eventChan !== "") {
            if (event["eventChan"] && event.eventChan !== "") { // If they've set a channel, use it
                Bot.announceMsg(client.guilds.get(guildID), announceMessage, event.eventChan);
            } else { // Else, use the default one from their settings
                Bot.announceMsg(client.guilds.get(guildID), announceMessage);
            }
        }
    };

    // To stick into node-schedule for each full event
    Bot.eventAnnounce = async (event) => {
        // Parse out the eventName and guildName from the ID
        let eventName = event.eventID.split("-");
        const guildID = eventName.splice(0, 1)[0];
        eventName = eventName.join("-");

        const guildSettings = await Bot.database.models.settings.findOne({where: {guildID: guildID}, attributes: Object.keys(Bot.config.defaultSettings)});
        const guildConf = guildSettings.dataValues;

        let repTime = false, repDay = false;
        let newEvent = {};
        const repDays = event.repeatDays;

        if (event.countdown === "yes") {
            event.countdown = "true";
        } else if (event.countdown === "no") {
            event.countdown = "false";
        }

        // Announce the event
        var announceMessage = `**${eventName}**\n${event.eventMessage}`;
        if (guildConf["announceChan"] != "" || event.eventChan !== "") {
            if (event["eventChan"] && event.eventChan !== "") { // If they've set a channel, use it
                try {
                    Bot.announceMsg(client.guilds.get(guildID), announceMessage, event.eventChan);
                } catch (e) {
                    Bot.log("ERROR", "Broke trying to announce event with ID: ${event.eventID} \n${e}", {color: Bot.colors.red});
                }
            } else { // Else, use the default one from their settings
                Bot.announceMsg(client.guilds.get(guildID), announceMessage);
            }
        }

        // If it's got any left in repeatDays
        if (repDays.length > 0) {
            repDay = true;
            let eventMsg = event.eventMessage;
            // If this is the last time, tack a message to the end to let them know it's the last one
            if (repDays.length === 1) {
                eventMsg += Bot.languages[guildConf.language].get("BASE_LAST_EVENT_NOTIFICATION");
            }
            newEvent = {
                "eventID": event.eventID,
                "eventDT": (momentTZ(parseInt(event.eventDT)).add(parseInt(repDays.splice(0, 1)), "d").unix()*1000),
                "eventMessage": eventMsg,
                "eventChan": event.eventChan,
                "countdown": event.countdown,
                "repeat": {
                    "repeatDay": 0,
                    "repeatHour": 0,
                    "repeatMin": 0
                },
                "repeatDays": repDays
            };
            // Else if it's set to repeat
        } else if (event["repeat"] && (event.repeat["repeatDay"] !== 0 || event.repeat["repeatHour"] !== 0 || event.repeat["repeatMin"] !== 0)) { // At least one of em is more than 0
            repTime = true;
            newEvent = {
                "eventID": event.eventID,
                "eventDT": (momentTZ(parseInt(event.eventDT)).add(event.repeat["repeatDay"], "d").add(event.repeat["repeatHour"], "h").add(event.repeat["repeatMin"], "m").unix()*1000),
                "eventMessage": event.eventMessage,
                "eventChan": event.eventChan,
                "countdown": event.countdown,
                "repeat": {
                    "repeatDay": event.repeat["repeatDay"],
                    "repeatHour": event.repeat["repeatHour"],
                    "repeatMin": event.repeat["repeatMin"]
                },
                "repeatDays": []
            };
        }

        if (repTime || repDay) {
            await Bot.database.models.eventDBs.update(newEvent, {where: {eventID: event.eventID}})
                .then(async () => {
                    Bot.scheduleEvent(newEvent, guildConf.eventCountdown);
                })
                .catch(error => { Bot.log("ERROR", "Broke trying to replace event: " + error, {color: Bot.colors.red}); });
        } else {
            // Just destroy it
            await Bot.database.models.eventDBs.destroy({where: {eventID: event.eventID}})
                .then(async () => {})
                .catch(error => { Bot.log("ERROR",`Broke trying to delete old event ${error}`, {color: Bot.colors.red}); });
        }
    };
};
