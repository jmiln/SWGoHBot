const {getGuildEvents, setEvents, deleteGuildEvent, getGuildSettings} = require("./guildConfigFuncts");

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
    async function sendMsg(event, guildConf, guildId, announceMessage) {
        if (guildConf.announceChan !== "" || event.channel !== "") {
            let chan = "";
            if (event?.channel?.length) { // If they've set a channel, use it
                chan = event.channel;
            } else {
                chan = guildConf.announceChan;
            }
            try {
                await client.shard.broadcastEval(async (client, {guildId, announceMessage, chan, guildConf}) => {
                    const targetGuild = await client.guilds.cache.find(g => g.id === guildId);
                    if (targetGuild) {
                        client.announceMsg(targetGuild, announceMessage, chan, guildConf);
                    }
                }, {context: {
                    guildId,
                    announceMessage: announceMessage,
                    chan: chan,
                    guildConf: guildConf
                }});
            } catch (e) {
                Bot.logger.error(`Broke trying to announce event with name/channel: ${event.name} (${event.channel}) \n${e.stack}`);
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

    // Send out an alert based on the guild's countdown settings
    Bot.countdownAnnounce = async (event) => {
        const guildConf = await getGuildSettings({cache: Bot.cache, guildId: event.guildId});
        const diffNum = Math.abs(new Date().getTime() - event.eventDT);
        const timeToGo = Bot.formatDuration(diffNum, Bot.languages[guildConf.language]);

        var announceMessage = Bot.languages[guildConf.language].get("BASE_EVENT_STARTING_IN_MSG", event.name, timeToGo);

        await sendMsg(event, guildConf, event.guildId, announceMessage);
    };

    Bot.eventAnnounce = async (event) => {
        // Parse out the eventName and guildName from the ID
        const guildConf = await getGuildSettings({cache: Bot.cache, guildId: event.guildId});

        let outMsg = event?.message || "";

        // If it's running late, tack a notice onto the end of the message
        const diffTime = Math.abs(event.eventDT - new Date().getTime());
        if (diffTime > (2*minMS)) {
            const minPast = Math.floor(diffTime / minMS);
            outMsg += "\n> This event is " + minPast + " minutes past time.";
        }

        // Announce the event
        const announceMessage = `**${event.name}**\n${outMsg}`;
        await sendMsg(event, guildConf, event.guildId, announceMessage);

        let doRepeat = false;
        if ((event.repeat && (event.repeat.repeatDay || event.repeat.repeatHour || event.repeat.repeatMin)) || event.repeatDays.length) {
            if (event.repeatDays?.length === 1) {
                event.message += Bot.languages[guildConf.language].get("BASE_LAST_EVENT_NOTIFICATION");
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
            // If it's set to repeat, just delete the old one, and save a new version of the event
            const guildEvents = await getGuildEvents({cache: Bot.cache, guildId: event.guildId});
            const evArrOut = guildEvents.filter(ev => ev.name !== event.name);
            evArrOut.push(event);
            await setEvents({cache: Bot.cache, guildId: event.guildId, evArrOut})
                .then(() => {
                    // console.log(`Updating repeating event ${event.name} (${event.channel}).`);
                })
                .catch(error => { Bot.logger.error(`Broke trying to replace event: ${error}`); });
        } else {
            // If it's not going to be repeating, just destroy it
            await deleteGuildEvent({cache: Bot.cache, guildId: event.guildId, evName: event.name})
                .then(() => { Bot.logger.debug(`Deleting non-repeating event ${event.name}`); })
                .catch(error => { Bot.logger.error(`Broke trying to delete old event ${error}`); });
        }
    };
};
