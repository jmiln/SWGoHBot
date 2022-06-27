const momentTZ = require("moment-timezone");
require("moment-duration-format");

module.exports = (Bot, client) => {
    // Some base time conversions to milliseconds
    const dayMS  = 86400000;
    const hourMS = 3600000;
    const minMS  = 60000;

    // Handle any events that have been found via the checker
    Bot.manageEvents = async (eventList) => {
        for (const event of eventList) {
            if (event.isCD) {
                // It's a countdown alert, so do that
                await Bot.countdownAnnounce(event);
            } else {
                // It's a full event, so announce that
                await Bot.eventAnnounce(event);
            }
        }
    };

    // BroadcastEval a message send
    async function sendMsg(event, guildConf, guildID, announceMessage) {
        if (guildConf.announceChan !== "" || event.eventChan !== "") {
            let chan = "";
            if (event?.eventChan !== "") { // If they've set a channel, use it
                chan = event.eventChan;
            } else {
                chan = guildConf.announceChan;
            }
            if (announceMessage) announceMessage = announceMessage.replace(/`/g, "\\`");
            try {
                await client.shard.broadcastEval(async (client, {guildID, announceMessage, chan, guildConf}) => {
                    const targetGuild = await client.guilds.cache.find(g => g.id === guildID);
                    if (targetGuild) {
                        client.announceMsg(targetGuild, announceMessage, chan, guildConf);
                    }
                }, {context: {
                    guildID: guildID,
                    announceMessage: announceMessage,
                    chan: chan,
                    guildConf: guildConf
                }});
            } catch (e) {
                Bot.logger.error(`Broke trying to announce event with ID: ${event.eventID} \n${e.stack}`);
            }
        }
    }

    // Re-caclulate a viable eventDT, and return the updated event
    async function reCalc(ev) {
        const nowTime = new Date().getTime();
        if (ev.repeatDays.length > 0) { // repeatDays is an array of days to skip
            // If it's got repeatDays set up, splice the next time, and if it runs out of times, return null
            while (nowTime > ev.eventDT && ev.repeatDays.length > 0) {
                const days = parseInt(ev.repeatDays.splice(0, 1)[0], 10);
                ev.eventDT = parseInt(ev.eventDT, 10) + parseInt(dayMS * days, 10);
            }
            if (nowTime > ev.eventDT) { // It ran out of days
                return null;
            }
        } else if (ev.repeat.repeatDay || ev.repeat.repeatHour || ev.repeat.repeatMin) { // 0d0h0m
            // Else it's using basic repeat
            while (nowTime >= ev.eventDT) {
                ev.eventDT =
                    parseInt(ev.eventDT, 10)        +
                    (ev.repeat.repeatDay  * dayMS)  +
                    (ev.repeat.repeatHour * hourMS) +
                    (ev.repeat.repeatMin  * minMS);
            }
        }
        return ev;
    }

    // Delete em here as needed
    Bot.deleteEvent = async (eventID) => {
        await Bot.database.models.eventDBs.destroy({where: {eventID: eventID}})
            .catch(error => {
                Bot.logger.error(`Broke deleting an event (${eventID}) ${error}`);
            });
    };

    // Send out an alert based on the guild's countdown settings
    Bot.countdownAnnounce = async (event) => {
        let eventName = event.eventID.split("-");
        const guildID = eventName.splice(0, 1)[0];
        eventName = eventName.join("-");

        const guildConf = await Bot.getGuildConf(guildID);

        var timeToGo = momentTZ.duration(momentTZ().diff(momentTZ(parseInt(event.eventDT, 10)), "minutes") * -1, "minutes").format(`h [${Bot.languages[guildConf.language].getTime("HOUR", "SHORT_SING")}], m [${Bot.languages[guildConf.language].getTime("MINUTE", "SHORT_SING")}]`);
        var announceMessage = Bot.languages[guildConf.language].get("BASE_EVENT_STARTING_IN_MSG", eventName, timeToGo);

        await sendMsg(event, guildConf, guildID, announceMessage);
    };

    // To stick into node-schedule for each full event
    Bot.eventAnnounce = async (event) => {
        // Parse out the eventName and guildName from the ID
        let eventName = event.eventID.split("-");
        const guildID = eventName.splice(0, 1)[0];
        eventName = eventName.join("-");

        const guildConf = await Bot.getGuildConf(guildID);

        // If it's running late, tack a notice onto the end of the message
        const nowTime = new Date().getTime();
        if ((nowTime - event.eventDT) > (2*minMS)) {
            const minPast = parseInt((nowTime - event.eventDT) / minMS, 10);
            event.eventMessage += "\nThis event is " + minPast + " minutes past time.";
        }

        // Announce the event
        const announceMessage = `**${eventName}**\n${event.eventMessage}`;
        await sendMsg(event, guildConf, guildID, announceMessage);

        let doRepeat = false;
        if ((event.repeat && (event.repeat.repeatDay || event.repeat.repeatHour || event.repeat.repeatMin)) || event.repeatDays.length) {
            if (event.repeatDays?.length === 1) {
                event.eventMessage += Bot.languages[guildConf.language].get("BASE_LAST_EVENT_NOTIFICATION");
            }

            const tmpEv = await reCalc(event);
            if (tmpEv) {
                // Got a viable next time, so set it and move on
                event.eventDT    = tmpEv.eventDT;
                event.repeatDays = tmpEv.repeatDays;
                event.repeat     = tmpEv.repeat;
            }
            doRepeat = true;
        }

        if (doRepeat) {
            // If it's been updated,
            await Bot.database.models.eventDBs.update({eventDT: event.eventDT, repeatDays: event.repeatDays, repeat: event.repeat}, {where: {eventID: event.eventID}})
                .then(() => {
                    // console.log(`Updating repeating event ${event.eventID}.`);
                })
                .catch(error => { Bot.logger.error(`Broke trying to replace event: ${error}`); });
        } else {
            // Just destroy it
            await Bot.database.models.eventDBs.destroy({where: {eventID: event.eventID}})
                .then(() => { Bot.logger.debug(`Deleting non-repeating event ${event.eventID}`); })
                .catch(error => { Bot.logger.error(`Broke trying to delete old event ${error}`); });
        }
    };
};
