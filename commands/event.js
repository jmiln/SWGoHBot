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

        const guildConf = await Bot.getGuildConf(message.guild.id);

        const EVENTS_PER_PAGE = 5;

        const overallExample = `event create name 8/10/2018 15:45\n${message.guildSettings.prefix}event view\n${message.guildSettings.prefix}event delete name`;

        const actions = ["create", "view", "delete", "help", "trigger", "edit"];
        const exampleEvent = {
            "eventID": "guildID-eventName",
            "eventDT": 1545299520000,
            "eventMessage": "eventMsg",
            "eventChan": "",
            "countdown": false,
            "repeat": {
                "repeatDay": 0,
                "repeatHour": 0,
                "repeatMin": 0
            },
            "repeatDays": 0
        };

        let action = "";
        let eventName = "";

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
                    const [evName, evDate, evTime, ...evMsg] = args;

                    if (!evName || !evName.length) {
                        err.push(message.language.get("COMMAND_EVENT_NEED_NAME"));
                    }

                    const eventID = `${message.guild.id}-${evName}`;

                    // Check if that name/ event already exists
                    const exists = await Bot.database.models.eventDBs.findOne({where: {eventID: eventID}})
                        .then(token => token !== null)
                        .then(isUnique => isUnique);
                    if (exists) {
                        return super.error(message, message.language.get("COMMAND_EVENT_JSON_EXISTS"));
                    }

                    const newEv = {
                        name: evName,
                        time: evTime,
                        day: evDate,
                        message: Array.isArray(evMsg) && evMsg.length ? evMsg.join(" ") : evMsg,
                        channel: options.subArgs?.channel,
                        countdown: options.flags?.countdown,
                        repeat: options.subArgs?.repeat,
                        repeatDay: options.subArgs?.repeatDay
                    };

                    let validEV = await validateEvents([newEv]);
                    if (Array.isArray(validEV)) validEV = validEV[0];
                    if (!validEV.valid) {
                        return super.error(message, validEV.str);
                    }
                    await Bot.socket.emit("addEvents", validEV.event, (res) => {
                        const ev = res[0];
                        const evName = ev.evID.split("-").slice(1).join("-");
                        if (ev.success) {
                            return message.channel.send(message.language.get("COMMAND_EVENT_CREATED", evName, momentTZ.tz(validEV.event.eventDT, guildConf.timezone).format("MMM Do YYYY [at] H:mm")));
                        } else {
                            return message.channel.send(message.language.get("COMMAND_EVENT_NO_CREATE") + "\n\n**" + evName + "**\n" + ev.error);
                        }
                    });
                } else {
                    // Using the json code block method of creating events
                    const regex = new RegExp(/([`]{3})([^```]*)([`]{3})/g);
                    const match = regex.exec(message.content);
                    if (match) {
                        // Make sure the event objects are in an array
                        const matchWhole = match[2].replace(/\n/g, "");
                        if (!matchWhole.startsWith("[") || !matchWhole.endsWith("]")) {
                            return super.error(message, "Invalid json, please make sure the events are surrounded by square brackets (`[]`) at the beginning and end.");
                        }
                        let jsonWhole;
                        try {
                            jsonWhole = JSON.parse(match[2]);
                        } catch (e) {
                            return super.error(message, "**ERROR Parsing the json**" + Bot.codeBlock(e.message));
                        }

                        // ```[{
                        //     "name":      "Example",               // No spaces ?
                        //     "time":      "12:36",                 // hh:mm    (24hr format)
                        //     "day":       "28/09/18",              // dd/mm/yy
                        //     "message":   "Example message here",  // If you need a line break, put \n in the spot you want it
                        //     "repeatDay": [0, 0, 0],               // Only need one of these, if
                        //     "repeat":    "0d0h0m",                // you have both, it won't work
                        //     "countdown": false,                   // true if you want a countdown, false if not
                        //     "channel":   "327974285563920387"     // Channel ID, not name anymore
                        // }]```

                        // TODO Maybe add in a special help for -json  ";ev -jsonHelp" since it'll need more of a description
                        const result = await validateEvents(jsonWhole);
                        if (result.filter(e => !e.valid).length) {
                            return message.channel.send(message.language.get("COMMAND_EVENT_JSON_ERR_NOT_ADDED", Bot.codeBlock(result.map(e => e.str).join("\n\n"))));
                        } else {
                            // If there were no errors in the setup, go ahead and add all the events in, then tell em as such
                            await Bot.socket.emit("addEvents", result.map(e => e.event), (res) => {
                                const evAddLog = [];
                                const evFailLog = [];

                                for (const ev of res) {
                                    const evName = ev.evID.split("-").slice(1).join("-");
                                    if (ev.success) {
                                        evAddLog.push(message.language.get("COMMAND_EVENT_CREATED", evName, momentTZ.tz(ev.eventDT, guildConf.timezone).format("MMM Do YYYY [at] H:mm")));
                                    } else {
                                        evFailLog.push(message.language.get("COMMAND_EVENT_JSON_EV_ADD_ERROR", evName, ev.error));
                                    }
                                }
                                return message.channel.send({embed: {
                                    title: "Event(s) add log",
                                    fields: [
                                        {
                                            name: "Success",
                                            value: evAddLog.join("\n") || "N/A"
                                        },
                                        {
                                            name: "Failures",
                                            value: evFailLog.join("\n") || "N/A"
                                        }
                                    ]
                                }});
                            });
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
                    const eventName = args[0];
                    const eventID = `${message.guild.id}-${eventName}`;

                    await Bot.socket.emit("getEventsByID", eventID, async function(event) {
                        // If it doesn't find the event, say so
                        if (Array.isArray(event) && !event.length) return message.channel.send(message.language.get("COMMAND_EVENT_UNFOUND_EVENT", eventName));

                        // From here on, it should have the event found, so process for viewing
                        if (Array.isArray(event)) event = event[0];
                        const eventDate = momentTZ(parseInt(event.eventDT, 10)).tz(guildConf.timezone).format("MMM Do YYYY [at] H:mm");

                        let eventString = message.language.get("COMMAND_EVENT_TIME", eventName, eventDate);
                        eventString += message.language.get("COMMAND_EVENT_TIME_LEFT", momentTZ.duration(momentTZ().diff(momentTZ(parseInt(event.eventDT, 10)), "minutes") * -1, "minutes").format("d [days], h [hrs], m [min]"));
                        if (event.eventChan && event.eventChan !== "") {
                            let chanName = "";
                            if (message.guild.channels.cache.has(event.eventChan)) {
                                chanName = message.guild.channels.cache.get(event.eventChan).name;
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
                            // If they want to show all available events without the eventMessage showing
                            eventString += message.language.get("COMMAND_EVENT_MESSAGE", removeTags(message, event.eventMessage));
                        }
                        return message.channel.send(eventString);
                    });
                } else {
                    await Bot.socket.emit("getEventsByGuild", message.guild.id, async function(eventList) {
                        // If it doesn't find any events, say so
                        if (Array.isArray(eventList) && eventList.length === 0) return message.channel.send("I could not find any events for this server");

                        // Otherwise, process the events for viewing, and display em

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
                            const eventDate = momentTZ(parseInt(event.eventDT, 10)).tz(guildConf.timezone).format("MMM Do YYYY [at] H:mm");

                            let eventString = message.language.get("COMMAND_EVENT_TIME", eventName, eventDate);
                            eventString += message.language.get("COMMAND_EVENT_TIME_LEFT", momentTZ.duration(momentTZ().diff(momentTZ(parseInt(event.eventDT, 10)), "minutes") * -1, "minutes").format("d [days], h [hrs], m [min]"));
                            if (event.eventChan && event.eventChan !== "") {
                                let chanName = "";
                                if (message.guild.channels.cache.has(event.eventChan)) {
                                    chanName = message.guild.channels.cache.get(event.eventChan).name;
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
                            Bot.logger.error("Event View Broke! " + evArray);
                        }
                    });
                }
                break;
            } case "delete": {
                if (!args[0]) return message.channel.send(message.language.get("COMMAND_EVENT_DELETE_NEED_NAME"));
                eventName = args[0];
                const eventID = `${message.guild.id}-${eventName}`;

                await Bot.socket.emit("delEvent", eventID, async (result) => {
                    if (result.success) {
                        return super.success(message, message.language.get("COMMAND_EVENT_DELETED", eventName));
                    } else {
                        return super.error(message, result.error);
                    }
                });
                break;
            } case "trigger": {
                if (!args[0]) return message.channel.send(message.language.get("COMMAND_EVENT_TRIGGER_NEED_NAME"));
                eventName = args[0];
                const eventID =  `${message.guild.id}-${eventName}`;

                const exists = await Bot.database.models.eventDBs.findOne({where: {eventID: eventID}})
                    .then(token => token !== null)
                    .then(isUnique => isUnique);

                // Check if that name/ event already exists
                if (!exists) {
                    return message.channel.send(message.language.get("COMMAND_EVENT_UNFOUND_EVENT", eventName));
                } else {
                    // As long as it does exist, go ahead and try triggering it
                    await Bot.socket.emit("getEventsByID", eventID, async function(event) {
                        if (Array.isArray(event)) event = event[0];
                        var channel = "";
                        var announceMessage = `**${eventName}**\n${event.eventMessage}`;
                        if (event["eventChan"] && event.eventChan !== "") {  // If they"ve set a channel, try using it
                            channel = message.guild.channels.cache.get(event.eventChan);
                            if (!channel) {
                                channel = message.guild.channels.cache.find(c => c.name === event.eventChan);
                            }
                        } else { // Else, use the default one from their settings
                            channel = message.guild.channels.cache.find(c => c.name === guildConf["announceChan"]);
                        }
                        if (channel && channel.permissionsFor(message.guild.me).has(["SEND_MESSAGES", "VIEW_CHANNEL"])) {
                            try {
                                return channel.send(announceMessage);
                            } catch (e) {
                                Bot.logger.error("Event trigger Broke! " + announceMessage);
                            }
                        }
                    });
                }
                break;
            } case "edit": {
                // Edit an event
                if (!args[0]) return message.channel.send(message.language.get("COMMAND_EVENT_TRIGGER_NEED_NAME"));
                eventName = args.splice(0,1);
                eventName = eventName.join("-");

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
                    const oldDate = momentTZ.tz(parseInt(event.eventDT, 10), message.guildSettings.timezone).format("DD/MM/YYYY");
                    const oldTime = momentTZ.tz(parseInt(event.eventDT, 10), message.guildSettings.timezone).format("HH:mm");
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
                            let newMsg = "";
                            if (changeTo.length) {
                                newMsg = changeTo.join(" ");
                                if (newMsg.length > 1800) return super.error(message, message.language.get("COMMAND_EVENT_EDIT_LONG_MESSAGE"));
                            }
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
                            let checkChan = message.guild.channels.cache.get(check.replace(/[^0-9]/g, ""));
                            // If it doesn't come up by ID, try it by name
                            if (!checkChan) {
                                checkChan = message.guild.channels.cache.find(c => c.name === check.replace(/^#/, ""));
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
                                    outRep.repeatDay = parseInt(repeatTime.substring(0, repeatTime.indexOf("d")),  10);
                                    repeatTime = repeatTime.replace(/^\d{1,2}d/, "");
                                    outRep.repeatHour = parseInt(repeatTime.substring(0, repeatTime.indexOf("h")), 10);
                                    repeatTime = repeatTime.replace(/^\d{1,2}h/, "");
                                    outRep.repeatMin = parseInt(repeatTime.substring(0, repeatTime.indexOf("m")),  10);
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
                        if (res.success) {
                            return super.error(message, removeTags(message, message.language.get("COMMAND_EVENT_EDIT_UPDATED", target, cFrom, cTo)), {title: "Success", color: "#00ff00"});
                        } else {
                            return super.error(message, message.language.get("COMMAND_EVENT_EDIT_BROKE") + "\n" + res.error);
                        }
                    } catch (e) {
                        return super.error(message, e.message);
                    }
                }
            }
        }

        async function updateEvent(id, event) {
            const out = await Bot.database.models.eventDBs.update(event, {where: {eventID: event.eventID}})
                .then(() => {
                    return { success: true, error: null };
                })
                .catch(error => {
                    Bot.logger.error(`(Ev updateEvent)Broke trying to create new event \nMessage: ${message.content}\nError: ${error}`);
                    return { success: false, error: error };
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
                    const thisUser = message.guild.members.cache.get(userID);
                    const userName = thisUser ? `${thisUser.displayName}` : `${message.client.users.cache.get(user) ? message.client.users.cache.get(user).username : "Unknown User"}`;
                    mess = mess.replace(user, userName);
                });
            }
            if (roleResult !== null) {
                roleResult.forEach(role => {
                    const roleID = role.replace(/\D/g,"");
                    let roleName;
                    try {
                        roleName = message.guild.roles.cache.get(roleID).name;
                    } catch (e) {
                        roleName = roleID;
                    }
                    mess = mess.replace(role, `@${roleName}`);
                });
            }
            if (chanResult !== null) {
                chanResult.forEach(chan => {
                    const chanID = chan.replace(/\D/g,"");
                    const chanName = message.guild.channels.cache.get(chanID).name;
                    mess = mess.replace(chan, `#${chanName}`);
                });
            }
            mess = mess.replace(/`/g, "");
            return mess;
        }
        function validateEvents(eventArray) {
            const MAX_MSG_SIZE = 1000;
            const outEvents = [];
            const nameArr = [];
            if (!Array.isArray(eventArray)) eventArray = [eventArray];

            eventArray.forEach((event, ix) => {
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
                // In case they lowercase the D in repeatDay
                if (!event.repeatDay) {
                    const rd = event[Object.keys(event).find(key => key.toLowerCase() === "repeatday")];
                    if (rd) event.repeatDay = rd;
                }

                if (!event.name || !event.name.length) {
                    err.push(message.language.get("COMMAND_EVENT_JSON_INVALID_NAME"));
                } else if (event.name.indexOf(" ") > -1) {
                    err.push(message.language.get("COMMAND_EVENT_JSON_NO_SPACES"));
                } else {
                    if (nameArr.includes(event.name)) {
                        err.push(message.language.get("COMMAND_EVENT_JSON_DUPLICATE"));
                    } else {
                        nameArr.push(event.name);
                    }
                    newEvent.eventID = `${message.guild.id}-${event.name}`;
                }
                if (!event.day) {
                    err.push(message.language.get("COMMAND_EVENT_JSON_MISSING_DAY"));
                } else if (!event.day.match(/\d{1,2}\/\d{1,2}\/\d{2,4}/) || !momentTZ(event.day, "D/M/YYYY").isValid()) {
                    err.push(message.language.get("COMMAND_EVENT_JSON_INVALID_DAY", event.day));
                }
                if (!event.time) {
                    err.push(message.language.get("COMMAND_EVENT_JSON_MISSING_TIME"));
                } else if (!event.time.match(/^\d{1,2}:\d{2}$/) || !momentTZ(event.time, "H:mm").isValid()) {
                    err.push(message.language.get("COMMAND_EVENT_JSON_INVALID_TIME", event.time));
                }
                newEvent.eventDT = momentTZ.tz(`${event.day} ${event.time}`, "DD/MM/YYYY H:mm", guildConf.timezone).unix() * 1000;
                if (momentTZ(newEvent.eventDT).isBefore(momentTZ())) {
                    const eventDATE = momentTZ.tz(newEvent.eventDT, guildConf.timezone).format("D/M/YYYY H:mm");
                    const nowDATE = momentTZ().tz(guildConf["timezone"]).format("D/M/YYYY H:mm");

                    err.push(message.language.get("COMMAND_EVENT_PAST_DATE", eventDATE, nowDATE));
                }

                if (event.message?.length) {
                    if (event.message.length > MAX_MSG_SIZE) {
                        err.push(`Events have a maximum message length of ${MAX_MSG_SIZE} characters, this one is ${event.message.length} characters long`);
                    } else {
                        newEvent.eventMessage = event.message;
                    }
                }
                if (event.channel) {
                    event.channel = event.channel.toString();
                    let channel = message.guild.channels.cache.get(event.channel);
                    if (!channel) {
                        channel = message.guild.channels.cache.find(c => c.name === event.channel);
                    }
                    if (!channel) {
                        err.push(message.language.get("COMMAND_EVENT_JSON_INVALID_CHANNEL", event.channel));
                    } else if (!channel.permissionsFor(message.guild.me).has(["SEND_MESSAGES", "VIEW_CHANNEL"])) {
                        err.push(message.language.get("COMMAND_EVENT_JSON_MISSING_CHANNEL_PERMS", event.channel));
                    } else {
                        newEvent.eventChan = channel.id;
                    }
                } else {
                    const announceChannel = message.guild.channels.cache.find(c => c.name === guildConf["announceChan"]);
                    if (!announceChannel) {
                        err.push(message.language.get("COMMAND_EVENT_NEED_CHAN"));
                    }
                }
                if (event.repeat && event.repeatDay) {
                    err.push(message.language.get("COMMAND_EVENT_JSON_NO_2X_REPEAT"));
                } else {
                    // If the repeat is set, try to parse it
                    const timeReg = /^\d{1,2}d\d{1,2}h\d{1,2}m/i;
                    if (event.repeat) {
                        let repeat = event.repeat;
                        if (repeat.match(timeReg)) {
                            newEvent.repeat.repeatDay = parseInt(repeat.substring(0, repeat.indexOf("d")),  10);
                            repeat = repeat.replace(/^\d{1,2}d/, "");
                            newEvent.repeat.repeatHour = parseInt(repeat.substring(0, repeat.indexOf("h")), 10);
                            repeat = repeat.replace(/^\d{1,2}h/, "");
                            newEvent.repeat.repeatMin = parseInt(repeat.substring(0, repeat.indexOf("m")),  10);
                        } else {
                            err.push(message.language.get("COMMAND_EVENT_INVALID_REPEAT"));
                        }
                    } else if (event.repeatDay) {
                        const dayReg = /^[0-9,]*$/gi;
                        let jsonRepDay = null;
                        try {
                            jsonRepDay = JSON.parse(event.repeatDay);
                        } catch (e) {
                            // Don't bother since it's just gonna be a parse error, and it's already null
                        }
                        if (Array.isArray(jsonRepDay)) {
                            const breaker = jsonRepDay.forEach(r => {
                                if (r <= 0) {
                                    err.push(message.language.get("COMMAND_EVENT_JSON_BAD_NUM"));
                                    return false;
                                }
                            });
                            if (!breaker) {
                                newEvent.repeatDays = jsonRepDay;
                            }
                        } else if (event.repeatDay.toString().match(dayReg)) {
                            const dayList = event.repeatDay.toString().split(",");
                            if (dayList.find(d => d <= 0)) {
                                return err.push(message.language.get("COMMAND_EVENT_JSON_BAD_NUM"));
                            }
                            newEvent.repeatDays = dayList.map(d => parseInt(d, 10));
                        } else {
                            err.push(message.language.get("COMMAND_EVENT_JSON_BAD_FORMAT"));
                        }
                    }
                    if (!event.countdown || event.countdown === "false" || event.countdown === "no") {
                        newEvent.countdown = false;
                    } else if (event.countdown === true || event.countdown === "true" || event.countdown === "yes") {
                        newEvent.countdown = true;
                    } else {
                        err.push(message.language.get("COMMAND_EVENT_JSON_COUNTDOWN_BOOL"));
                    }
                }
                let outStr;
                if (err.length) {
                    outStr = message.language.get("COMMAND_EVENT_JSON_ERROR_LIST", (ix+1), err.map(e => `* ${e}`).join("\n"));
                } else {
                    outStr = message.language.get("COMMAND_EVENT_JSON_EVENT_VALID", (ix+1), event.name, event.time, event.day);
                }
                const result = {
                    event: newEvent,
                    str:   outStr,
                    valid: err.length ? false : true
                };
                outEvents.push(result);
            });
            return outEvents;
        }
    }
}

module.exports = Event;
