const momentTZ = require("moment-timezone");
require("moment-duration-format");
// const {inspect} = require("util");

const Command = require("../base/Command");

class Event extends Command {
    constructor(Bot) {
        super(Bot, {
            guildOnly: true,
            name: "event",
            category: "Misc",
            aliases: ["events", "ev"],
            flags: {
                "countdown": {
                    aliases: ["cd"]
                },
                "min": {
                    aliases: ["minimal", "minimize", "m"]
                },
                "json": {
                    aliases: []
                }
            },
            subArgs: {
                "channel": {
                    aliases: ["c", "ch", "chan", "channel", "channel"]
                },
                "repeatDay": {
                    aliases: ["repeatday", "repday", "rd"]
                },
                "repeat": {
                    aliases: ["repeat", "rep", "r"]
                },
                "pages": {
                    aliases: ["p", "page"]
                }
            }
        });
    }

    async run(Bot, message, args, options) {
        const level = options.level;

        const maxSize = 1000;
        const guildSettings = await Bot.database.models.settings.findOne({where: {guildID: message.guild.id}, attributes: Object.keys(Bot.config.defaultSettings)});
        const guildConf = guildSettings.dataValues;

        const EVENTS_PER_PAGE = 5;

        const overallExample = `event create name 8/10/2018 15:45\n${message.guildSettings.prefix}event view\n${message.guildSettings.prefix}event delete name`;

        const actions = ["create", "view", "delete", "help", "trigger", "edit"];
        const exampleEvent = {
            "eventID": "guildID-eventName",
            "eventDT": 1545299520000,
            "eventMessage": "eventMsg",
            "eventChan": "",
            "countdown": "no",
            "repeat": {
                "repeatDay": 0,
                "repeatHour": 0,
                "repeatMin": 0
            },
            "repeatDays": 0
        };

        let action = "";
        let eventName = "";
        let eventMessage = "";
        let repeatDay = 0;
        let repeatHour = 0;
        let repeatMin = 0;
        let dayList = [];

        if (!args[0] || !actions.includes(args[0].toLowerCase())) {
            return super.error(message, message.language.get("COMMAND_EVENT_INVALID_ACTION", actions.join(", ")), {example: overallExample});
        }
        action = args.splice(0, 1);
        action = action[0].toLowerCase();

        if (["create", "delete", "trigger"].includes(action)) {
            if (level < 3) {  // Permlevel 3 is the adminRole of the server, so anyone under that shouldn"t be able to use these
                return super.error(message, message.language.get("COMMAND_EVENT_INVALID_PERMS"));
            }
        }
        switch (action) {
            case "create": {
                const err = [];
                const guildEvents = await Bot.database.models.eventDBs.findAll({where: {eventID: { [Bot.seqOps.like]: `${message.guild.id}-%`}}}, {attributes: [Object.keys(exampleEvent)]});
                const evCount = guildEvents.length;
                // If they have too many events, stop here
                if (evCount >= 50) {
                    // 50 should be fine, as at the time of making this, the most anyone has is 31
                    return super.error(message, message.language.get("COMMAND_EVENT_TOO_MANY_EVENTS"));
                }
                if (!options.flags.json) {
                    let repeatTime = options.subArgs["repeat"];
                    const repeatDays = options.subArgs["repeatDay"];
                    let eventChan = options.subArgs["channel"];
                    let countdownOn = options.flags["countdown"];
                    const timeReg = /^\d{1,2}d\d{1,2}h\d{1,2}m/i;
                    const dayReg  = /^[0-9,]*$/gi;

                    const [evName, evDate, evTime, ...evMsg] = args;

                    if (!evName || !evName.length) {
                        err.push(message.language.get("COMMAND_EVENT_NEED_NAME"));
                    }

                    // Check if that name/ event already exists
                    const exists = await Bot.database.models.eventDBs.findOne({where: {eventID: `${message.guild.id}-${evName}`}})
                        .then(token => token !== null)
                        .then(isUnique => isUnique);
                    if (exists) {
                        err.push(message.language.get("COMMAND_EVENT_JSON_EXISTS"));
                    }

                    if (!evDate) {
                        // If there is no date
                        err.push(message.language.get("COMMAND_EVENT_NEED_DATE"));
                    } else if (!momentTZ(evDate, "D/M/YYYY").isValid()) {
                        // Or if the given date is not valid
                        err.push(message.language.get("COMMAND_EVENT_JSON_INVALID_DAY", evDate));
                    }

                    if (!evTime) {
                        // If there is no time
                        err.push(message.language.get("COMMAND_EVENT_NEED_TIME"));
                    } else if (!momentTZ(evTime, "H:mm").isValid()) {
                        // Or if the given time is not valid
                        err.push(message.language.get("COMMAND_EVENT_JSON_INVALID_TIME", evTime));
                    }
                    const eventDT = momentTZ.tz(`${evDate} ${evTime}`, "DD/MM/YYYY H:mm", guildConf.timezone).unix() * 1000;

                    if (!evMsg) {
                        eventMessage = "";
                    } else {
                        eventMessage = evMsg.join(" ");
                    }

                    if ((eventMessage.length + evName.length) > maxSize) {
                        const currentSize = eventMessage.length + evName.length;
                        err.push(message.language.get("COMMAND_EVENT_TOO_BIG", currentSize-maxSize));
                    }

                    if (momentTZ(eventDT).isBefore(momentTZ())) {
                        var eventDATE = momentTZ.tz(eventDT, guildConf.timezone).format("D/M/YYYY H:mm");
                        var nowDATE = momentTZ().tz(guildConf["timezone"]).format("D/M/YYYY H:mm");

                        err.push(message.language.get("COMMAND_EVENT_PAST_DATE", eventDATE, nowDATE));
                    }

                    // If they try and set a repeat time and a repeating day schedule, tell em to pick just one
                    if (repeatDays && repeatTime) {
                        err.push(message.language.get("COMMAND_EVENT_JSON_NO_2X_REPEAT"));
                    } else {
                        // If the repeat is set, try to parse it
                        if (repeatTime) {
                            if (repeatTime.match(timeReg)) {
                                repeatDay = parseInt(repeatTime.substring(0, repeatTime.indexOf("d")));
                                repeatTime = repeatTime.replace(/^\d{1,2}d/, "");
                                repeatHour = parseInt(repeatTime.substring(0, repeatTime.indexOf("h")));
                                repeatTime = repeatTime.replace(/^\d{1,2}h/, "");
                                repeatMin = parseInt(repeatTime.substring(0, repeatTime.indexOf("m")));
                            } else {
                                err.push(message.language.get("COMMAND_EVENT_INVALID_REPEAT"));
                            }
                        } else {
                            repeatTime = "0";
                        }

                        // If they chose repeatDay, split the days
                        if (repeatDays) {
                            if (repeatDays.match(dayReg)) {
                                dayList = repeatDays.split(",");
                                if (dayList.find(d => d <= 0)) {
                                    err.push(message.language.get("COMMAND_EVENT_JSON_BAD_NUM"));
                                }
                            } else {
                                err.push(message.language.get("COMMAND_EVENT_USE_COMMAS"));
                            }
                        }
                    }

                    if (countdownOn === "yes") {
                        countdownOn = "true";
                    } else if (countdownOn === "no") {
                        countdownOn = "false";
                    }

                    // If the event channel is something other than default, check to make sure it works, then set it
                    const announceChannel = message.guild.channels.find(c => c.name === guildConf["announceChan"]);
                    if (eventChan) {
                        // Try getting the channel by ID first
                        let checkChan = message.guild.channels.get(eventChan.replace(/[^0-9]/g, ""));
                        // If it doesn't come up by ID, try it by name
                        if (!checkChan) {
                            if (eventChan.startsWith("#")) {
                                eventChan = eventChan.replace(/^#/, "");
                            }
                            checkChan = message.guild.channels.find(c => c.name === eventChan);
                        }
                        if (!checkChan) {   // Make sure it"s a real channel
                            err.push(message.language.get("COMMAND_EVENT_JSON_INVALID_CHANNEL", checkChan));
                        } else if (!checkChan.permissionsFor(message.guild.me).has(["SEND_MESSAGES", "VIEW_CHANNEL"])) {   // Make sure it can send messages there
                            err.push(message.language.get("COMMAND_EVENT_JSON_MISSING_CHANNEL_PERMS", checkChan));
                        } else {
                            // It found a valid channel and has permission to post there, so save the ID
                            eventChan = checkChan.id;
                        }
                    } else if (!announceChannel) {
                        err.push(message.language.get("COMMAND_EVENT_NEED_CHAN"));
                    }

                    if (err.length) {
                        return super.error(message, Bot.codeBlock("* " + err.join("\n* ")));
                    }

                    const newEvent = {
                        eventID: `${message.guild.id}-${evName}`,
                        eventDT: eventDT,
                        eventMessage: eventMessage,
                        eventChan: eventChan ? eventChan.toString() : "",
                        countdown: countdownOn,
                        repeat: {
                            "repeatDay": repeatDay,
                            "repeatHour": repeatHour,
                            "repeatMin": repeatMin
                        },
                        repeatDays: dayList
                    };
                    Bot.scheduleEvent(newEvent, guildConf.eventCountdown);
                    await Bot.database.models.eventDBs.create(newEvent)
                        .then(() => {
                            return message.channel.send(message.language.get("COMMAND_EVENT_CREATED", evName, momentTZ.tz(eventDT, guildConf.timezone).format("MMM Do YYYY [at] H:mm")));
                        })
                        .catch(error => {
                            Bot.log("ERROR",`Broke trying to create new event \nMessage: ${message.content}\nError: ${error}`);
                            return message.channel.send(message.language.get("COMMAND_EVENT_NO_CREATE"));
                        });
                } else {
                    // Using the json code block method of creating events

                    const regex = new RegExp(/([`]{3})([^```]*)([`]{3})/g);
                    const match = regex.exec(message.content);
                    if (match) {
                        let jsonWhole;
                        try {
                            jsonWhole = JSON.parse(match[2]);
                        } catch (e) {
                            return super.error(message, "**ERROR Parsing the json**" + Bot.codeBlock(e.message));
                        }

                        if (!Array.isArray(jsonWhole)) {
                            jsonWhole = [jsonWhole];
                        }

                        // ```{
                        //     "name":      "Example",               // No spaces ?
                        //     "time":      "12:36",                 // hh:mm    (24hr format)
                        //     "day":       "28/09/18",              // dd/mm/yy
                        //     "message":   "Example message here",  // If you need a line break, put \n in the spot you want it
                        //     "repeatDay": [0, 0, 0],               // Only need one of these, if
                        //     "repeat":    "0d0h0m",                // you have both, it won't work
                        //     "countdown": false,                   // true if you want a countdown, false if not
                        //     "channel":   "327974285563920387"     // Channel ID, not name anymore
                        // }```

                        // TODO Maybe add in a special help for -json  ";ev -jsonHelp" since it'll need more of a description
                        const outArr = [];
                        const nameArr = [];
                        let evErr = false;
                        let ix = 0;
                        for (const json of jsonWhole) {
                            ix = ix++;
                            const err = [];
                            const newEvent = {
                                eventID: "",
                                eventDT: "",
                                eventMessage: "",
                                eventChan: "",
                                countdown: false,
                                repeat: {
                                    "repeatDay": 0,
                                    "repeatHour": 0,
                                    "repeatMin": 0
                                },
                                repeatDays: []
                            };
                            if (!json.name || !json.name.length) {
                                err.push(message.language.get("COMMAND_EVENT_JSON_INVALID_NAME"));
                            } else if (json.name.indexOf(" ") > -1) {
                                err.push(message.language.get("COMMAND_EVENT_JSON_NO_SPACES"));
                            } else {
                                const exists = await Bot.database.models.eventDBs.findOne({where: {eventID: `${message.guild.id}-${json.name}`}})
                                    .then(token => token !== null)
                                    .then(isUnique => isUnique);
                                if (exists) {
                                    err.push(message.language.get("COMMAND_EVENT_JSON_EXISTS"));
                                } else if (nameArr.includes(json.name)) {
                                    err.push(message.language.get("COMMAND_EVENT_JSON_DUPLICATE"));
                                } else {
                                    nameArr.push(json.name);
                                }
                                newEvent.eventID = `${message.guild.id}-${json.name}`;
                            }
                            if (!json.day) {
                                err.push(message.language.get("COMMAND_EVENT_JSON_MISSING_DAY"));
                            } else if (!json.day.match(/\d{1,2}\/\d{1,2}\/\d{2,4}/) || !momentTZ(json.day, "D/M/YYYY").isValid()) {
                                err.push(message.language.get("COMMAND_EVENT_JSON_INVALID_DAY", json.day));
                            }
                            if (!json.time) {
                                err.push(message.language.get("COMMAND_EVENT_JSON_MISSING_TIME"));
                            } else if (!json.time.match(/^\d{1,2}:\d{2}$/) || !momentTZ(json.time, "H:mm").isValid()) {
                                err.push(message.language.get("COMMAND_EVENT_JSON_INVALID_TIME", json.time));
                            }
                            newEvent.eventDT = momentTZ.tz(`${json.day} ${json.time}`, "DD/MM/YYYY H:mm", guildConf.timezone).unix() * 1000;
                            if (momentTZ(newEvent.eventDT).isBefore(momentTZ())) {
                                const eventDATE = momentTZ.tz(newEvent.eventDT, guildConf.timezone).format("D/M/YYYY H:mm");
                                const nowDATE = momentTZ().tz(guildConf["timezone"]).format("D/M/YYYY H:mm");

                                err.push(message.language.get("COMMAND_EVENT_PAST_DATE", eventDATE, nowDATE));
                            }

                            if (json.message.length) {
                                newEvent.eventMessage = json.message;
                            }
                            if (json.channel) {
                                json.channel = json.channel.toString();
                                let channel = message.guild.channels.get(json.channel);
                                if (!channel) {
                                    channel = message.guild.channels.find(c => c.name === json.channel);
                                }
                                if (!channel) {
                                    err.push(message.language.get("COMMAND_EVENT_JSON_INVALID_CHANNEL", json.channel));
                                } else if (!channel.permissionsFor(message.guild.me).has(["SEND_MESSAGES", "VIEW_CHANNEL"])) {
                                    err.push(message.language.get("COMMAND_EVENT_JSON_MISSING_CHANNEL_PERMS", json.channel));
                                } else {
                                    newEvent.eventChan = channel.id;
                                }
                            }
                            if (json.repeat && json.repeatDay) {
                                err.push(message.language.get("COMMAND_EVENT_JSON_NO_2X_REPEAT"));
                            } else {
                                // If the repeat is set, try to parse it
                                const timeReg = /^\d{1,2}d\d{1,2}h\d{1,2}m/i;
                                if (json.repeat) {
                                    let repeat = json.repeat;
                                    if (repeat.match(timeReg)) {
                                        newEvent.repeat.repeatDay = parseInt(repeat.substring(0, repeat.indexOf("d")));
                                        repeat = repeat.replace(/^\d{1,2}d/, "");
                                        newEvent.repeat.repeatHour = parseInt(repeat.substring(0, repeat.indexOf("h")));
                                        repeat = repeat.replace(/^\d{1,2}h/, "");
                                        newEvent.repeat.repeatMin = parseInt(repeat.substring(0, repeat.indexOf("m")));
                                    } else {
                                        err.push(message.language.get("COMMAND_EVENT_INVALID_REPEAT"));
                                    }
                                } else if (json.repeatDay) {
                                    if (Array.isArray(json.repeatDay)) {
                                        const breaker = json.repeatDay.forEach(r => {
                                            if (r <= 0) {
                                                err.push(message.language.get("COMMAND_EVENT_JSON_BAD_NUM"));
                                                return false;
                                            }
                                        });
                                        if (!breaker) {
                                            newEvent.repeatDays = json.repeatDay;
                                        }
                                    } else {
                                        err.push(message.language.get("COMMAND_EVENT_JSON_BAD_FORMAT"));
                                    }
                                }
                                if (!json.countdown || json.countdown === "false") {
                                    newEvent.countdown = false;
                                } else if (json.countdown === true || json.countdown === "true") {
                                    newEvent.countdown = true;
                                } else {
                                    err.push(message.language.get("COMMAND_EVENT_JSON_COUNTDOWN_BOOL"));
                                }
                            }
                            let outStr;
                            if (err.length) {
                                outStr = message.language.get("COMMAND_EVENT_JSON_ERROR_LIST", (ix+1), err.map(e => `* ${e}`).join("\n"));
                                evErr = true;
                            } else {
                                outStr = message.language.get("COMMAND_EVENT_JSON_EVENT_VALID", (ix+1), json.name, json.time, json.day);
                            }
                            outArr.push({
                                str: outStr,
                                event: newEvent
                            });
                        }
                        if (evErr) {
                            return message.channel.send(message.language.get("COMMAND_EVENT_JSON_ERR_NOT_ADDED", Bot.codeBlock(outArr.map(e => e.str).join("\n\n"))));
                        } else {
                            // If there were no errors in the setup, go ahead and add all the events in, then tell em as such
                            const evAddLog = [];
                            const evFailLog = [];

                            for (const ev of outArr) {
                                await Bot.scheduleEvent(ev.event, guildConf.eventCountdown);
                                await Bot.database.models.eventDBs.create(ev.event)
                                    .then(() => {
                                        evAddLog.push(message.language.get("COMMAND_EVENT_CREATED", ev.event.eventID.split("-")[1], momentTZ.tz(ev.event.eventDT, guildConf.timezone).format("MMM Do YYYY [at] H:mm")));
                                    })
                                    .catch(error => {
                                        evFailLog.push(message.language.get("COMMAND_EVENT_JSON_EV_ADD_ERROR", ev.event.name, error.message));
                                    });
                            }

                            if (evFailLog.length) {
                                return message.channel.send(message.language.get("COMMAND_EVENT_JSON_YES_NO", evFailLog.length, evFailLog.join("\n"), evAddLog.length. evAddLog.join("\n")));
                            } else {
                                return message.channel.send(message.language.get("COMMAND_EVENT_JSON_ADDED", evAddLog.length, evAddLog.join("\n")));
                            }
                        }
                    } else {
                        return message.channel.send(message.language.get("COMMAND_EVENT_JSON_BAD_JSON"));
                    }
                }
                break;
            } case "view": {
                const array = [];
                if (args[0]) {
                    // If they are looking to show a specific event
                    const guildEvents = await Bot.database.models.eventDBs.findOne({where: {eventID: `${message.guild.id}-${args[0]}`}});
                    if (!guildEvents) {
                        return message.channel.send(message.language.get("COMMAND_EVENT_UNFOUND_EVENT", args[0]));
                    }
                    const thisEvent = guildEvents.dataValues;
                    if (thisEvent) {
                        let eventName = thisEvent.eventID.split("-");
                        eventName.splice(0, 1);
                        eventName = eventName.join("-");
                        const eventDate = momentTZ(parseInt(thisEvent.eventDT)).tz(guildConf.timezone).format("MMM Do YYYY [at] H:mm");

                        let eventString = message.language.get("COMMAND_EVENT_TIME", eventName, eventDate);
                        eventString += message.language.get("COMMAND_EVENT_TIME_LEFT", momentTZ.duration(momentTZ().diff(momentTZ(parseInt(thisEvent.eventDT)), "minutes") * -1, "minutes").format("d [days], h [hrs], m [min]"));
                        if (thisEvent.eventChan && thisEvent.eventChan !== "") {
                            let chanName = "";
                            if (message.guild.channels.has(thisEvent.eventChan)) {
                                chanName = message.guild.channels.get(thisEvent.eventChan).name;
                            } else {
                                chanName = thisEvent.eventChan;
                            }
                            eventString += message.language.get("COMMAND_EVENT_CHAN", chanName);
                        }
                        if (thisEvent["repeatDays"].length > 0) {
                            eventString += message.language.get("COMMAND_EVENT_SCHEDULE", thisEvent.repeatDays.join(", "));
                        } else if (thisEvent["repeat"] && (thisEvent.repeat["repeatDay"] !== 0 || thisEvent.repeat["repeatHour"] !== 0 || thisEvent.repeat["repeatMin"] !== 0)) { // At least one of em is more than 0
                            eventString += message.language.get("COMMAND_EVENT_REPEAT", thisEvent.repeat["repeatDay"], thisEvent.repeat["repeatHour"], thisEvent.repeat["repeatMin"]);
                        }
                        if (!options.flags.min && thisEvent.eventMessage != "") {
                            // If they want to show all available events without the eventMessage showing
                            eventString += message.language.get("COMMAND_EVENT_MESSAGE", removeTags(message, thisEvent.eventMessage));
                        }
                        return message.channel.send(eventString);
                    } else {
                        return message.channel.send(message.language.get("COMMAND_EVENT_UNFOUND_EVENT", args[0]));
                    }
                } else {
                    // Grab all events for this guild
                    const guildEvents = await Bot.database.models.eventDBs.findAll({where: {eventID: { [Bot.seqOps.like]: `${message.guild.id}-%`}}}, {attributes: [Object.keys(exampleEvent)]});
                    const eventList = [];
                    guildEvents.forEach(event => {
                        eventList.push(event.dataValues);
                    });

                    // Sort the events by the time/ day
                    let sortedEvents = eventList.sort((p, c) => p.eventDT - c.eventDT);

                    // Grab the total # of events for later use
                    const eventCount = sortedEvents.length;

                    let PAGE_SELECTED = 1;
                    const PAGES_NEEDED = Math.floor(eventCount / EVENTS_PER_PAGE) + 1;
                    if (guildConf["useEventPages"]) {
                        PAGE_SELECTED = options.subArgs.pages || 0;
                        if (PAGE_SELECTED < 1) PAGE_SELECTED = 1;
                        if (PAGE_SELECTED > PAGES_NEEDED) PAGE_SELECTED = PAGES_NEEDED;

                        // If they have pages enabled, remove everything that isn"t within the selected page
                        if (PAGES_NEEDED > 1) {
                            sortedEvents = sortedEvents.slice(EVENTS_PER_PAGE * (PAGE_SELECTED-1), EVENTS_PER_PAGE * PAGE_SELECTED);
                        }
                    }
                    sortedEvents.forEach(event => {
                        let eventName = event.eventID.split("-");
                        eventName.splice(0, 1);
                        eventName = eventName.join("-");
                        const eventDate = momentTZ(parseInt(event.eventDT)).tz(guildConf.timezone).format("MMM Do YYYY [at] H:mm");

                        let eventString = message.language.get("COMMAND_EVENT_TIME", eventName, eventDate);
                        eventString += message.language.get("COMMAND_EVENT_TIME_LEFT", momentTZ.duration(momentTZ().diff(momentTZ(parseInt(event.eventDT)), "minutes") * -1, "minutes").format("d [days], h [hrs], m [min]"));
                        if (event.eventChan && event.eventChan !== "") {
                            let chanName = "";
                            if (message.guild.channels.has(event.eventChan)) {
                                chanName = message.guild.channels.get(event.eventChan).name;
                            } else {
                                chanName = event.eventChan;
                            }
                            eventString += message.language.get("COMMAND_EVENT_CHAN", chanName);
                        }
                        if (event["repeatDays"].length > 0) {
                            eventString += message.language.get("COMMAND_EVENT_SCHEDULE", event.repeatDays.join(", "));
                        } else if (event["repeat"] && (event.repeat["repeatDay"] !== 0 || event.repeat["repeatHour"] !== 0 || event.repeat["repeatMin"] !== 0)) { // At least one of em is more than 0
                            eventString += message.language.get("COMMAND_EVENT_REPEAT", event.repeat["repeatDay"], event.repeat["repeatHour"], event.repeat["repeatMin"]);
                        }
                        if (!options.flags.min && event.eventMessage != "") {
                            // If they want to show all available events with the eventMessage showing
                            const msg = removeTags(message, event.eventMessage);
                            eventString += message.language.get("COMMAND_EVENT_MESSAGE", msg);
                        }
                        array.push(eventString);
                    });
                    const evArray = Bot.msgArray(array, "\n\n");
                    try {
                        if (evArray.length === 0) {
                            return message.channel.send(message.language.get("COMMAND_EVENT_NO_EVENT"));
                        } else {
                            if (evArray.length > 1) {
                                evArray.forEach((evMsg, ix) => {
                                    if (guildConf["useEventPages"]) {
                                        return message.channel.send(message.language.get("COMMAND_EVENT_SHOW_PAGED", eventCount, PAGE_SELECTED, PAGES_NEEDED, evMsg), {split: true});
                                    } else {
                                        if (ix === 0) {
                                            return message.channel.send(message.language.get("COMMAND_EVENT_SHOW", eventCount, evMsg), {split: true});
                                        } else {
                                            return message.channel.send(evMsg, {split: true});
                                        }
                                    }
                                });
                            } else {
                                if (guildConf["useEventPages"]) {
                                    return message.channel.send(message.language.get("COMMAND_EVENT_SHOW_PAGED",eventCount, PAGE_SELECTED, PAGES_NEEDED, evArray[0]), {split: true});
                                } else {
                                    return message.channel.send(message.language.get("COMMAND_EVENT_SHOW",eventCount, evArray[0]), {split: true});
                                }
                            }
                        }
                    } catch (e) {
                        Bot.log("Event View Broke!", evArray);
                    }
                }
                break;
            } case "delete": {
                if (!args[0]) return message.channel.send(message.language.get("COMMAND_EVENT_DELETE_NEED_NAME"));
                eventName = args[0];
                const eventID = `${message.guild.id}-${eventName}`;

                // Check if that name/ event exists
                const exists = await Bot.database.models.eventDBs.findOne({where: {eventID: eventID}})
                    .then(token => token !== null)
                    .then(isUnique => isUnique);
                if (exists) {
                    Bot.deleteEvent(eventID);
                    return message.channel.send(message.language.get("COMMAND_EVENT_DELETED", eventName));
                } else {
                    return message.channel.send(message.language.get("COMMAND_EVENT_UNFOUND_EVENT", eventName));
                }
            } case "trigger": {
                if (!args[0]) return message.channel.send(message.language.get("COMMAND_EVENT_TRIGGER_NEED_NAME"));
                eventName = args[0];

                const exists = await Bot.database.models.eventDBs.findOne({where: {eventID: `${message.guild.id}-${eventName}`}})
                    .then(token => token !== null)
                    .then(isUnique => isUnique);

                // Check if that name/ event already exists
                if (!exists) {
                    return message.channel.send(message.language.get("COMMAND_EVENT_UNFOUND_EVENT", eventName));
                } else {
                    const events = await Bot.database.models.eventDBs.findOne({where: {eventID: `${message.guild.id}-${eventName}`}});
                    const event = events.dataValues;
                    var channel = "";
                    var announceMessage = `**${eventName}**\n${event.eventMessage}`;
                    if (event["eventChan"] && event.eventChan !== "") {  // If they"ve set a channel, try using it
                        channel = message.guild.channels.get(event.eventChan);
                        if (!channel) {
                            channel = message.guild.channels.find(c => c.name === event.eventChan);
                        }
                    } else { // Else, use the default one from their settings
                        channel = message.guild.channels.find(c => c.name === guildConf["announceChan"]);
                    }
                    if (channel && channel.permissionsFor(message.guild.me).has(["SEND_MESSAGES", "VIEW_CHANNEL"])) {
                        try {
                            return channel.send(announceMessage);
                        } catch (e) {
                            Bot.log("Event trigger Broke!", announceMessage);
                        }
                    }
                }
                break;
            }
            case "edit": {
                // Edit an event
                if (!args[0]) return message.channel.send(message.language.get("COMMAND_EVENT_TRIGGER_NEED_NAME"));
                eventName = args.splice(0,1);
                eventName = eventName[0];

                const changable = ["name", "time", "date", "message", "channel", "countdown", "repeat", "repeatday"];

                const exists = await Bot.database.models.eventDBs.findOne({where: {eventID: `${message.guild.id}-${eventName}`}})
                    .then(token => token !== null)
                    .then(isUnique => isUnique);

                // Check if that name/ event already exists
                if (!exists) {
                    return message.channel.send(message.language.get("COMMAND_EVENT_UNFOUND_EVENT", eventName));
                } else {
                    const events = await Bot.database.models.eventDBs.findOne({where: {eventID: `${message.guild.id}-${eventName}`}});
                    const event = events.dataValues;

                    const [target, ...changeTo] = args;

                    if (!target) {
                        return super.error(message, message.language.get("COMMAND_EVENT_EDIT_MISSING_ARG"));
                    } else if (!changable.includes(target)) {
                        return super.error(message, message.language.get("COMMAND_EVENT_EDIT_MISSING_ARG", target, changable.join(", ")));
                    }

                    const oldId = event.eventID;
                    const oldDate = momentTZ.tz(parseInt(event.eventDT), message.guildSettings.timezone).format("DD/MM/YYYY");
                    const oldTime = momentTZ.tz(parseInt(event.eventDT), message.guildSettings.timezone).format("HH:mm");
                    let cFrom, cTo;
                    switch (target) {
                        case "name": {
                            // If changing the name, need to wipe out the old event and make a new one with the new ID
                            if (changeTo.length > 1) {
                                return super.error(message, message.language.get("COMMAND_EVENT_EDIT_INVALID_NAME"));
                            } else if (!changeTo.length) {
                                return super.error(message, message.language.get("COMMAND_EVENT_EDIT_MISSING_NAME"));
                            }

                            const oldName = oldId.split("-")[1];
                            const newName = changeTo[0];

                            const newId = event.eventID.split("-")[0] + "-" + newName;
                            cFrom = oldName;
                            cTo   = newName;
                            event.eventID = newId;
                            break;
                        }
                        case "date": {
                            if (changeTo.length > 1) {
                                return super.error(message, message.language.get("COMMAND_EVENT_EDIT_SPACE_DATE"));
                            } else if (!changeTo.length) {
                                return super.error(message, message.language.get("COMMAND_EVENT_EDIT_MISSING_DATE"));
                            }

                            const newDate = changeTo[0];
                            const dateReg = /\d{1,2}\/\d{1,2}\/\d{2,4}/;
                            if (!newDate.match(dateReg)) {
                                return super.error(message, message.language.get("COMMAND_EVENT_EDIT_INVALID_DATE"));
                            }
                            cFrom = oldDate;
                            cTo   = newDate;
                            event.eventDT = momentTZ.tz(`${newDate} ${oldTime}`, "DD/MM/YYYY H:mm", message.guildSettings.timezone).unix() * 1000;
                            break;
                        }
                        case "time": {
                            if (changeTo.length > 1) {
                                return super.error(message, message.language.get("COMMAND_EVENT_EDIT_SPACE_TIME"));
                            } else if (!changeTo.length) {
                                return super.error(message, message.language.get("COMMAND_EVENT_EDIT_MISSING_TIME"));
                            }

                            const newTime = changeTo[0];
                            const dateReg = /\d{1,2}:\d{2}/;
                            if (!newTime.match(dateReg)) {
                                return super.error(message, message.language.get("COMMAND_EVENT_EDIT_INVALID_TIME"));
                            }
                            cFrom = oldTime;
                            cTo   = newTime;
                            event.eventDT = momentTZ.tz(`${oldDate} ${newTime}`, "DD/MM/YYYY H:mm", message.guildSettings.timezone).unix() * 1000;
                            break;
                        }
                        case "message": {
                            // Accept pretty much any string (Within the limit of 1000 or 1800 characters or whatever
                            if (!changeTo.length) return super.error(message, message.language.get("COMMAND_EVENT_EDIT_MISSING_MESSAGE"));
                            let newMsg = changeTo.join(" ");
                            if (newMsg === "null") newMsg = "";
                            if (newMsg.length > 1800) return super.error(message, message.language.get("COMMAND_EVENT_EDIT_LONG_MESSAGE"));
                            if (!event.eventMessage) event.eventMessage = "";
                            if (event.eventMessage.length > 500) {
                                cFrom = event.eventMessage.substring(0, 500) + "...";
                            } else {
                                cFrom = event.eventMessage;
                            }
                            cFrom = "\n" + cFrom + "\n";

                            if (newMsg.length > 500) {
                                cTo = newMsg.substring(0, 500) + "...";
                            } else {
                                cTo = newMsg;
                            }
                            cTo = "\n" + cTo;
                            event.eventMessage = newMsg;
                            break;
                        }
                        case "channel": {
                            // Check for name or id?
                            if (!changeTo.length) return super.error(message, message.language.get("COMMAAND_EVENT_EDIT_MISSING_CHANNEL"));
                            const check = changeTo[0];

                            // Try getting the channel by ID first
                            let checkChan = message.guild.channels.get(check.replace(/[^0-9]/g, ""));
                            // If it doesn't come up by ID, try it by name
                            if (!checkChan) {
                                checkChan = message.guild.channels.find(c => c.name === check.replace(/^#/, ""));
                            }
                            if (!checkChan && check === "null") {
                                checkChan = null;
                            } else if (!checkChan) {   // Make sure it"s a real channel
                                return super.error(message, message.language.get("COMMAND_EVENT_JSON_INVALID_CHANNEL", checkChan));
                            } else if (!checkChan.permissionsFor(message.guild.me).has(["SEND_MESSAGES", "VIEW_CHANNEL"])) {   // Make sure it can send messages there
                                return super.error(message, message.language.get("COMMAND_EVENT_JSON_MISSING_CHANNEL_PERMS", checkChan));
                            }
                            cFrom = event.eventChan ? "<#" + event.eventChan + ">" : "";
                            cTo   = checkChan ? "<#" + checkChan.id + ">" : "";
                            event.eventChan = checkChan ? checkChan.id.toString() : null;
                            break;
                        }
                        case "countdown": {
                            // Just true/ false
                            const yesOpts = ["true", "yes", "on"];
                            const  noOpts = ["false", "no", "off"];
                            if (!changeTo.length) return super.error(message, message.language.get("COMMAND_EVENT_EDIT_MISSING_COUNTDOWN"));
                            const choice = changeTo[0].toLowerCase();
                            cFrom = event.countdown;
                            if (yesOpts.includes(choice)) {
                                event.countdown = true;
                            } else if (noOpts.includes(choice)) {
                                event.countdown = false;
                            } else {
                                return super.error(message, message.language.get("COMMAND_EVENT_EDIT_INVALID_COUNTDOWN"));
                            }
                            cTo = choice;
                            break;
                        }
                        case "repeatday": {
                            // Check if not repeat
                            if (!changeTo.length) return super.error(message, message.language.get("COMMAND_EVENT_EDIT_MISSING_REPEATDAY"));
                            if (changeTo.length > 1) return super.error(message, message.language.get("COMMAND_EVENT_EDIT_SPACE_REPEATDAY"));
                            if (changeTo[0] === "null") {
                                cTo = "";
                                cFrom = event.repeatDays;
                                event.repeatDays = [];
                            } else {
                                const rep = event.repeat;
                                if (rep.repeatDay || rep.repeatHour || rep.repeatMin) {
                                    return super.error(message, message.language.get("COMMAND_EVENT_EDIT_BOTH_REPEATDAY"));
                                }
                                const repeatDays = changeTo[0];
                                const dayReg  = /^[0-9,]*$/gi;
                                let dayList;
                                if (repeatDays.match(dayReg)) {
                                    dayList = repeatDays.split(",");
                                    if (dayList.find(d => d <= 0)) {
                                        return super.error(message, message.language.get("COMMAND_EVENT_JSON_BAD_NUM"));
                                    }
                                } else {
                                    return super.error(message, message.language.get("COMMAND_EVENT_USE_COMMAS"));
                                }
                                cFrom = event.repeatDays;
                                cTo = dayList;
                                event.repeatDays = dayList;
                            }
                            break;
                        }
                        case "repeat": {
                            if (!changeTo.length) return super.error(message, message.language.get("COMMAND_EVENT_EDIT_MISSING_REPEAT"));
                            if (changeTo.length > 1) return super.error(message, message.language.get("COMMAND_EVENT_EDIT_SPACE_REPEATDAY"));
                            if (changeTo[0] === "null") {
                                cTo = "0d0h0m";
                                const rep = event.repeat;
                                cFrom = `${rep.repeatDay}d${rep.repeatHour}h${rep.repeatMin}m`;
                                event.repeat = {
                                    repeatDay: 0,
                                    repeatMin: 0,
                                    repeatHour: 0
                                };
                            } else {
                                if (event.repeatDays.length) {
                                    return super.error(message, message.language.get("COMMAND_EVENT_EDIT_BOTH_REPEAT"));
                                }
                                const outRep = {};
                                const timeReg = /^\d{1,2}d\d{1,2}h\d{1,2}m/i;
                                let repeatTime = changeTo[0];
                                if (repeatTime.match(timeReg)) {
                                    outRep.repeatDay = parseInt(repeatTime.substring(0, repeatTime.indexOf("d")));
                                    repeatTime = repeatTime.replace(/^\d{1,2}d/, "");
                                    outRep.repeatHour = parseInt(repeatTime.substring(0, repeatTime.indexOf("h")));
                                    repeatTime = repeatTime.replace(/^\d{1,2}h/, "");
                                    outRep.repeatMin = parseInt(repeatTime.substring(0, repeatTime.indexOf("m")));
                                } else {
                                    return super.error(message, message.language.get("COMMAND_EVENT_INVALID_REPEAT"));
                                }
                                cTo = changeTo[0];
                                const rep = event.repeat;
                                cFrom = `${rep.repeatDay}d${rep.repeatHour}h${rep.repeatMin}m`;
                                event.repeat = outRep;
                            }
                            break;
                        }
                    }
                    try {
                        const res = await updateEvent(oldId, event);
                        if (res) {
                            return super.error(message, message.language.get("COMMAND_EVENT_EDIT_UPDATED", target, cFrom, cTo), {title: "Success", color: 0x00ff00});
                        } else {
                            return super.error(message, message.language.get("COMMAND_EVENT_EDIT_BROKE"));
                        }
                    } catch (e) {
                        return super.error(message, e.message);
                    }
                }
            }
        }

        async function updateEvent(id, event) {
            await Bot.deleteEvent(id);
            Bot.scheduleEvent(event, guildConf.eventCountdown);
            const out = await Bot.database.models.eventDBs.create(event)
                .then(() => {
                    return true;
                })
                .catch(error => {
                    Bot.log("ERROR",`(Ev updateEvent)Broke trying to create new event \nMessage: ${message.content}\nError: ${error}`);
                    return false;
                });
            return out;
        }

        function removeTags(message, mess) {
            const userReg = /<@!?(1|\d{17,19})>/g;
            const roleReg = /<@&(1|\d{17,19})>/g;
            const chanReg = /<#(1|\d{17,19})>/g;

            const userResult = mess.match(userReg);
            const roleResult = mess.match(roleReg);
            const chanResult = mess.match(chanReg);
            if (userResult !== null) {
                userResult.forEach(user => {
                    const userID = user.replace(/\D/g,"");
                    const thisUser = message.guild.members.get(userID);
                    const userName = thisUser ? `${thisUser.displayName}` : `${message.client.users.cache.get(user) ? message.client.users.cache.get(user).username : "Unknown User"}`;
                    mess = mess.replace(user, userName);
                });
            }
            if (roleResult !== null) {
                roleResult.forEach(role => {
                    const roleID = role.replace(/\D/g,"");
                    // const roleName = message.guild.roles.find("id", roleID).name;
                    let roleName;
                    try {
                        roleName = message.guild.roles.get(roleID).name;
                    } catch (e) {
                        roleName = roleID;
                    }
                    mess = mess.replace(role, `@${roleName}`);
                });
            }
            if (chanResult !== null) {
                chanResult.forEach(chan => {
                    const chanID = chan.replace(/\D/g,"");
                    const chanName = message.guild.channels.get(chanID).name;
                    mess = mess.replace(chan, `#${chanName}`);
                });
            }
            mess = mess.replace(/`/g, "");
            return mess;
        }
    }
}

module.exports = Event;

