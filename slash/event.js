const momentTZ = require("moment-timezone");
require("moment-duration-format");
// const {inspect} = require("util");

const Command = require("../base/slashCommand");

// TODO Work out pagination with the fancy new buttons?
const EVENTS_PER_PAGE = 5;

class Event extends Command {
    constructor(Bot) {
        super(Bot, {
            name: "event",
            guildOnly: false,
            category: "Misc",
            aliases: ["events", "ev"],
            options: [
                {
                    name: "create",
                    description: "Make a new event",
                    type: "SUB_COMMAND",
                    options: [
                        {
                            name: "name",
                            description: "The name of the event, no spaces allowed.",
                            type: "STRING",
                            required: true
                        },
                        {
                            name: "day",
                            type: "STRING",
                            description: "The date (DD/MM/YYYY) that you want it to go off",
                            required: true
                        },
                        {
                            name: "time",
                            type: "STRING",
                            description: "The time (HH:MM) that you want it to go off. This needs to be in 24hr format",
                            required: true
                        },
                        {
                            name: "message",
                            type: "STRING",
                            description: "The message that you want the event to spit back out",
                        },
                        {
                            name: "repeat",
                            type: "STRING",
                            description: "Lets you set a duration with the format of 00d00h00m. It will repeat after that time has passed.",
                        },
                        {
                            name: "repeatday",
                            type: "STRING",
                            description: "Lets you set it to repeat on set days with the format of 0,0,0,0,0.",
                        },
                        {
                            name: "channel",
                            type: "CHANNEL",
                            description: "Set which channel the event will announce on",
                        },
                        {
                            name: "countdown",
                            type: "BOOLEAN",
                            description: "Set to use the countdown or not (Configured in setconf)",
                        },
                    ]
                },
                {
                    name: "createjson",
                    description: "Create new event(s), inputted as a json code block",
                    type: "SUB_COMMAND",
                    options: [
                        {
                            name: "json",
                            description: "The json formatted text.",
                            type: "STRING",
                            required: true
                        }
                    ]
                },
                {
                    name: "delete",
                    description: "Delete an event",
                    type: "SUB_COMMAND",
                    options: [
                        {
                            name: "name",
                            description: "The unique name of the event you want to delete",
                            type: "STRING",
                            required: true
                        }
                    ]
                },
                {
                    name: "edit",
                    description: "Create new event(s), inputted as a json code block",
                    type: "SUB_COMMAND",
                    options: [
                        {
                            name: "event_name",
                            description: "The name of the event you want to edit",
                            type: "STRING",
                            required: true
                        },
                        {
                            name: "name",
                            description: "The new name of the event, no spaces allowed.",
                            type: "STRING",
                        },
                        {
                            name: "day",
                            type: "STRING",
                            description: "The date (DD/MM/YYYY) that you want it to go off",
                        },
                        {
                            name: "time",
                            type: "STRING",
                            description: "The time (HH:MM) that you want it to go off. This needs to be in 24hr format",
                        },
                        {
                            name: "message",
                            type: "STRING",
                            description: "The message that you want the event to spit back out",
                        },
                        {
                            name: "repeat",
                            type: "STRING",
                            description: "Lets you set a duration with the format of 00d00h00m. (Not compatible with repeatday)",
                        },
                        {
                            name: "repeatday",
                            type: "STRING",
                            description: "Lets you set it to repeat on set days with the format of 0,0,0,0,0. (Not compatible with reapeat)",
                        },
                        {
                            name: "channel",
                            type: "CHANNEL",
                            description: "Set which channel the event will announce on",
                        },
                        {
                            name: "countdown",
                            type: "BOOLEAN",
                            description: "Set to use the countdown or not (Configured in setconf)",
                        }
                    ]
                },
                {
                    // TODO Possibly work this in to have the dropdowns?
                    name: "trigger",
                    description: "Trigger the selected event",
                    type: "SUB_COMMAND",
                    options: [
                        {
                            name: "name",
                            description: "The unique name of the event you want to trigger",
                            type: "STRING",
                            required: true
                        }
                    ]
                },
                {
                    name: "view",
                    description: "View your event(s)",
                    type: "SUB_COMMAND",
                    options: [
                        {
                            name: "name",
                            description: "The unique name of the event you want to see.",
                            type: "STRING",
                        },
                        {
                            name: "minimal",
                            description: "Show the event(s), but without the message.",
                            type: "BOOLEAN",
                        },
                        {
                            name: "page_num",
                            description: `Set it to paginate the events, showing ${EVENTS_PER_PAGE} events at a time.`,
                            type: "INTEGER",
                        },
                    ]
                },
            ]
        });
    }

    async run(Bot, interaction, options) {
        if (!interaction?.guild) {
            return super.error(interaction, "Sorry, but this command is not available in DMs.");
        }
        if (!interaction?.guild?.id) {
            return super.error(interaction, "Sorry, but I'm having trouble accessing your guild's info.");
        }
        const guildConf = await Bot.getGuildConf(interaction.guild.id);

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

        const action = interaction.options.getSubcommand();

        if (["create", "delete", "trigger"].includes(action)) {
            if (options.level < Bot.constants.permMap.GUILD_ADMIN) {
                return super.error(interaction, interaction.language.get("COMMAND_EVENT_INVALID_PERMS"));
            }
        }

        switch (action) {
            case "create": {
                const evName    = interaction.options.getString("name");
                const evDate    = interaction.options.getString("day");
                const evTime    = interaction.options.getString("time");
                const evMsg     = interaction.options.getString("message");
                const repeat    = interaction.options.getString("repeat");
                const repeatDay = interaction.options.getString("repeatday");
                const channel   = interaction.options.getChannel("channel");
                const countdown = interaction.options.getBoolean("countdown");

                const guildEvents = await Bot.database.models.eventDBs.findAll({where: {eventID: { [Bot.seqOps.like]: `${interaction.guild.id}-%`}}}, {attributes: [Object.keys(exampleEvent)]});
                const evCount = guildEvents.length;
                // If they have too many events, stop here
                if (evCount >= 50) {
                    // 50 should be fine, as at the time of making this, the most anyone has is 31
                    return super.error(interaction, interaction.language.get("COMMAND_EVENT_TOO_MANY_EVENTS"));
                }
                const eventID = `${interaction.guild.id}-${evName}`;

                // Check if that name/ event already exists
                const exists = await Bot.database.models.eventDBs.findOne({where: {eventID: eventID}})
                    .then(token => token !== null)
                    .then(isUnique => isUnique);
                if (exists) {
                    return super.error(interaction, interaction.language.get("COMMAND_EVENT_JSON_EXISTS"));
                }

                const newEv = {
                    name: evName,
                    time: evTime,
                    day: evDate,
                    message: evMsg?.length ? evMsg : null,
                    channelID: channel?.id ? channel.id : null,
                    countdown: countdown,
                    repeat: repeat,
                    repeatDay: repeatDay
                };

                const validEV = validateEvents([newEv])[0];
                if (!validEV) {
                    return super.error(interaction, "Something broke while trying to validate your event.");
                }
                if (!validEV?.valid) {
                    return super.error(interaction, validEV.str);
                }
                await Bot.socket.emit("addEvents", validEV.event, (res) => {
                    const ev = res[0];
                    const evName = ev.evID.split("-").slice(1).join("-");
                    if (ev.success) {
                        return interaction.reply({content: interaction.language.get("COMMAND_EVENT_CREATED", evName, momentTZ.tz(validEV.event.eventDT, guildConf.timezone).format("MMM Do YYYY [at] H:mm"))});
                    } else {
                        return interaction.reply({content: interaction.language.get("COMMAND_EVENT_NO_CREATE") + "\n\n**" + evName + "**\n" + ev.error});
                    }
                });
                break;
            }
            case "createjson": {
                // Using the json code block method of creating events
                const jsonIn = interaction.options.getString("json");
                const regex = new RegExp(/([`]{3})([^```]*)([`]{3})/g);
                const match = regex.exec(jsonIn);

                if (match) {
                    // Make sure the event objects are in an array
                    const matchWhole = match[2].replace(/\n/g, "");
                    if (!matchWhole.startsWith("[") || !matchWhole.endsWith("]")) {
                        return super.error(interaction, "Invalid json, please make sure the events are surrounded by square brackets (`[]`) at the beginning and end.");
                    }


                    let jsonWhole;
                    try {
                        jsonWhole = JSON.parse(match[2]);
                    } catch (e) {
                        return super.error(interaction, "**ERROR Parsing the json**" + Bot.codeBlock(e.message));
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
                    const result = validateEvents(jsonWhole);
                    if (result.filter(e => !e.valid).length) {
                        return interaction.reply({content: interaction.language.get("COMMAND_EVENT_JSON_ERR_NOT_ADDED", Bot.codeBlock(result.map(e => e.str).join("\n\n")))});
                    } else {
                        // If there were no errors in the setup, go ahead and add all the events in, then tell em as such
                        await Bot.socket.emit("addEvents", result.map(e => e.event), (res) => {
                            const evAddLog = [];
                            const evFailLog = [];

                            for (const ev of res) {
                                const evName = ev.evID.split("-").slice(1).join("-");
                                if (ev.success) {
                                    evAddLog.push(interaction.language.get("COMMAND_EVENT_CREATED", evName, momentTZ.tz(ev.eventDT, guildConf.timezone).format("MMM Do YYYY [at] H:mm")));
                                } else {
                                    evFailLog.push(interaction.language.get("COMMAND_EVENT_JSON_EV_ADD_ERROR", evName, ev.error));
                                }
                            }
                            return interaction.reply({embeds: [{
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
                            }]});
                        });
                    }
                } else {
                    return interaction.reply({content: interaction.language.get("COMMAND_EVENT_JSON_BAD_JSON")});
                }
                break;
            }
            case "view": {
                const array = [];
                const eventName = interaction.options.getString("name");
                const minimal = interaction.options.getBoolean("minimal");
                const page = interaction.options.getInteger("page_num");

                if (eventName) {
                    // If they are looking to show a specific event
                    const eventID = `${interaction.guild.id}-${eventName}`;

                    await Bot.socket.emit("getEventsByID", eventID, async function(event) {
                        // If it doesn't find the event, say so
                        if (Array.isArray(event) && !event.length) return interaction.reply({content: interaction.language.get("COMMAND_EVENT_UNFOUND_EVENT", eventName)});

                        // From here on, it should have the event found, so process for viewing
                        if (Array.isArray(event)) event = event[0];
                        const eventDate = momentTZ(parseInt(event.eventDT, 10)).tz(guildConf.timezone).format("MMM Do YYYY [at] H:mm");

                        let eventString = interaction.language.get("COMMAND_EVENT_TIME", eventName, eventDate);
                        eventString += interaction.language.get("COMMAND_EVENT_TIME_LEFT", momentTZ.duration(momentTZ().diff(momentTZ(parseInt(event.eventDT, 10)), "minutes") * -1, "minutes").format("d [days], h [hrs], m [min]"));
                        if (event.eventChan?.length) {
                            let chanName = "";
                            if (interaction.guild.channels.cache.has(event.eventChan)) {
                                chanName = `<#${interaction.guild.channels.cache.get(event.eventChan).id}>`;
                            } else {
                                chanName = event.eventChan;
                            }
                            eventString += interaction.language.get("COMMAND_EVENT_CHAN", chanName);
                        }
                        if (event["repeatDays"].length > 0) {
                            eventString += interaction.language.get("COMMAND_EVENT_SCHEDULE", event.repeatDays.join(", "));
                        } else if (event["repeat"] && (event.repeat["repeatDay"] !== 0 || event.repeat["repeatHour"] !== 0 || event.repeat["repeatMin"] !== 0)) { // At least one of em is more than 0
                            eventString += interaction.language.get("COMMAND_EVENT_REPEAT", event.repeat["repeatDay"], event.repeat["repeatHour"], event.repeat["repeatMin"]);
                        }
                        if (!minimal && event.eventMessage != "") {
                            // If they want to show all available events without the eventMessage showing
                            eventString += interaction.language.get("COMMAND_EVENT_MESSAGE", removeTags(interaction, event.eventMessage));
                        }
                        return interaction.reply({content: eventString});
                    });
                } else {
                    await Bot.socket.emit("getEventsByGuild", interaction.guild.id, async function(eventList) {
                        // If it doesn't find any events, say so
                        if (Array.isArray(eventList) && eventList.length === 0) return interaction.reply({content: "I could not find any events for this server"});

                        // Otherwise, process the events for viewing, and display em

                        // Sort the events by the time/ day
                        let sortedEvents = eventList.sort((p, c) => p.eventDT - c.eventDT);

                        // Grab the total # of events for later use
                        const eventCount = sortedEvents.length;

                        let PAGE_SELECTED = 1;
                        const PAGES_NEEDED = Math.floor(eventCount / EVENTS_PER_PAGE) + 1;
                        if (guildConf["useEventPages"]) {
                            PAGE_SELECTED = page || 0;
                            if (PAGE_SELECTED < 1) PAGE_SELECTED = 1;
                            if (PAGE_SELECTED > PAGES_NEEDED) PAGE_SELECTED = PAGES_NEEDED;

                            // If they have pages enabled, remove everything that isn"t within the selected page
                            if (PAGES_NEEDED > 1) {
                                sortedEvents = sortedEvents.slice(EVENTS_PER_PAGE * (PAGE_SELECTED-1), EVENTS_PER_PAGE * PAGE_SELECTED);
                            }
                        }
                        sortedEvents.forEach(event => {
                            let thisEventName = event.eventID.split("-");
                            thisEventName.splice(0, 1);
                            thisEventName = thisEventName.join("-");
                            const eventDate = momentTZ(parseInt(event.eventDT, 10)).tz(guildConf.timezone).format("MMM Do YYYY [at] H:mm");

                            let eventString = interaction.language.get("COMMAND_EVENT_TIME", thisEventName, eventDate);
                            eventString += interaction.language.get("COMMAND_EVENT_TIME_LEFT", momentTZ.duration(momentTZ().diff(momentTZ(parseInt(event.eventDT, 10)), "minutes") * -1, "minutes").format("d [days], h [hrs], m [min]"));
                            if (event.eventChan && event.eventChan !== "") {
                                let chanName = "";
                                if (interaction.guild.channels.cache.has(event.eventChan)) {
                                    chanName = `<#${interaction.guild.channels.cache.get(event.eventChan).id}>`;
                                } else {
                                    chanName = event.eventChan;
                                }
                                eventString += interaction.language.get("COMMAND_EVENT_CHAN", chanName);
                            }
                            if (event["repeatDays"].length > 0) {
                                eventString += interaction.language.get("COMMAND_EVENT_SCHEDULE", event.repeatDays.join(", "));
                            } else if (event["repeat"] && (event.repeat["repeatDay"] !== 0 || event.repeat["repeatHour"] !== 0 || event.repeat["repeatMin"] !== 0)) { // At least one of em is more than 0
                                eventString += interaction.language.get("COMMAND_EVENT_REPEAT", event.repeat["repeatDay"], event.repeat["repeatHour"], event.repeat["repeatMin"]);
                            }
                            if (!minimal && event.eventMessage != "") {
                                // If they want to show all available events with the eventMessage showing
                                const msg = removeTags(interaction, event.eventMessage);
                                eventString += interaction.language.get("COMMAND_EVENT_MESSAGE", msg);
                            }
                            array.push(eventString);
                        });
                        const evArray = Bot.msgArray(array, "\n\n");
                        try {
                            if (evArray.length === 0) {
                                return interaction.reply({content: interaction.language.get("COMMAND_EVENT_NO_EVENT")});
                            } else {
                                if (evArray.length > 1) {
                                    evArray.forEach((evMsg, ix) => {
                                        if (guildConf["useEventPages"]) {
                                            return interaction.reply({content: interaction.language.get("COMMAND_EVENT_SHOW_PAGED", eventCount, PAGE_SELECTED, PAGES_NEEDED, evMsg)});
                                            // TODO, {split: true});
                                        } else {
                                            if (ix === 0) {
                                                return interaction.reply({content: interaction.language.get("COMMAND_EVENT_SHOW", eventCount, evMsg)});
                                                // TODO , {split: true});
                                            } else {
                                                return interaction.reply({content: evMsg});
                                                // TODO, {split: true});
                                            }
                                        }
                                    });
                                } else {
                                    if (guildConf["useEventPages"]) {
                                        // TODO Figure out the split
                                        return interaction.reply({content: interaction.language.get("COMMAND_EVENT_SHOW_PAGED",eventCount, PAGE_SELECTED, PAGES_NEEDED, evArray[0])});
                                        //, {split: true});
                                    } else {
                                        // TODO Figure out the split
                                        return interaction.reply({content: interaction.language.get("COMMAND_EVENT_SHOW",eventCount, evArray[0])});
                                        //, {split: true});
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
                const eventName = interaction.options.getString("name");
                const eventID = `${interaction.guild.id}-${eventName}`;

                await Bot.socket.emit("delEvent", eventID, async (result) => {
                    if (result.success) {
                        return super.success(interaction, interaction.language.get("COMMAND_EVENT_DELETED", eventName));
                    } else {
                        return super.error(interaction, result.error);
                    }
                });
                break;
            } case "trigger": {
                const eventName = interaction.options.getString("name");
                const eventID = `${interaction.guild.id}-${eventName}`;

                const exists = await Bot.database.models.eventDBs.findOne({where: {eventID: eventID}})
                    .then(token => token !== null)
                    .then(isUnique => isUnique);

                // Check if that name/ event already exists
                if (!exists) {
                    return interaction.reply({content: interaction.language.get("COMMAND_EVENT_UNFOUND_EVENT", eventName)});
                } else {
                    // As long as it does exist, go ahead and try triggering it
                    await Bot.socket.emit("getEventsByID", eventID, async function(event) {
                        if (Array.isArray(event)) event = event[0];
                        var channel = null;
                        var announceMessage = `**${eventName}**\n${event.eventMessage}`;
                        if (event["eventChan"] && event.eventChan !== "") {  // If they"ve set a channel, try using it
                            channel = interaction.guild.channels.cache.get(event.eventChan);
                            if (!channel) {
                                channel = interaction.guild.channels.cache.find(c => c.name === event.eventChan || c.id === event.eventChan);
                            }
                        } else { // Else, use the default one from their settings
                            channel = interaction.guild.channels.cache.find(c => c.name === guildConf["announceChan"] || c.id === guildConf.announceChan);
                        }
                        if (channel && channel.permissionsFor(interaction.guild.me).has(["SEND_MESSAGES", "VIEW_CHANNEL"])) {
                            try {
                                channel.send({content: announceMessage});
                                return interaction.reply({content: "Successfully triggered " + eventName, ephemeral: true});
                            } catch (e) {
                                Bot.logger.error("Event trigger Broke! " + announceMessage);
                                return interaction.reply({content: `Broke when trying to trigger *${eventName}*.\nIf this continues, please report it.`, ephemeral: true});
                            }
                        }
                    });
                }
                break;
            } case "edit": {
                // Edit an event
                const evName = interaction.options.getString("event_name");
                const eventID = `${interaction.guild.id}-${evName}`;

                const newEventName = interaction.options.getString("name");

                const newEvDate    = interaction.options.getString("day");
                const newEvTime    = interaction.options.getString("time");
                const newEvMsg     = interaction.options.getString("message");
                const newRepeat    = interaction.options.getString("repeat");
                const newRepeatDay = interaction.options.getString("repeatday");
                const newChannel   = interaction.options.getChannel("channel");
                const newCountdown = interaction.options.getBoolean("countdown");

                const exists = await Bot.database.models.eventDBs.findOne({where: {eventID: eventID}});

                // Check if that name/ event already exists
                if (!exists) {
                    return interaction.reply({content: interaction.language.get("COMMAND_EVENT_UNFOUND_EVENT", evName)});
                } else {
                    const event = exists.dataValues;

                    const oldDate = momentTZ.tz(parseInt(event.eventDT, 10), interaction.guildSettings.timezone).format("DD/MM/YYYY");
                    const oldTime = momentTZ.tz(parseInt(event.eventDT, 10), interaction.guildSettings.timezone).format("HH:mm");

                    // Put any new bits into an event skeleton
                    const newEvent = {
                        name:      newEventName ? newEventName : evName,
                        day:       newEvDate ? newEvDate : oldDate,
                        time:      newEvTime ? newEvTime : oldTime,
                        message:   newEvMsg ? newEvMsg : event.eventMessage,
                        channelID: newChannel?.id ? newChannel.id : event.eventChan,
                        countdown: newCountdown ? newCountdown : event.countdown,
                    };
                    if (newRepeat) {
                        newEvent.repeat = newRepeat;
                    } else if (newRepeatDay) {
                        newEvent.repeatDay = newRepeatDay;
                    } else if (event.repeat?.repeatDay || event.repeat?.repeatHour || event.repeat?.repeatMin) {
                        newEvent.repeat = `${event.repeat.repeatDay}d${event.repeat.repeatHour}h${event.repeat.repeatMin}m`;
                    } else if (event.repeatDays?.length) {
                        newEvent.repeatDay = event.repeatDays.join(",");
                    }

                    const validEvent = validateEvents(newEvent)[0];
                    if (!validEvent.valid) {
                        console.log("Issue validating an event:");
                        console.log(validEvent);
                        return super.error(interaction, "There was an issue with that: " + validEvent.str);
                    }

                    try {
                        const res = await updateEvent(eventID, validEvent.event);
                        if (res.success) {
                            // Find all the fields that were updated
                            const outLog = [];
                            for (let field of Object.keys(validEvent.event)) {
                                if (validEvent.event[field].toString() !== event[field].toString()) {
                                    let from = "N/A", to = "N/A";    // Default if there's nothing to show
                                    let code = true;    // Show in inline code blocks
                                    if (field === "eventID") {
                                        field = "Name";
                                        from = evName;
                                        to = newEventName;
                                    } else if (field === "eventChan") {
                                        if (event.eventChan) {
                                            if (Bot.isChannelId(event.eventChan)) {
                                                from = `<#${event.eventChan}>`;
                                            } else {
                                                from = event.eventChan;
                                            }
                                        }
                                        if (validEvent.event.eventChan) {
                                            to = `<#${validEvent.event.eventChan}>`;
                                        }
                                        code = false;
                                    } else {
                                        from = event[field].toString().length ? event[field].toString() : "N/A";
                                        to = validEvent.event[field].toString().length ? validEvent.event[field].toString() : "N/A";
                                    }
                                    if (code) {
                                        outLog.push(`Updated **${Bot.toProperCase(field)}** from \`${from}\` to \`${to}\``);
                                    } else {
                                        outLog.push(`Updated **${Bot.toProperCase(field)}** from ${from} to ${to}`);
                                    }
                                }
                            }
                            return super.error(interaction,
                                "**__UPDATED:__**\n" + outLog.map(e => `- ${e}`).join("\n"),
                                // `Updated event from ${Bot.codeBlock(JSON.stringify(event, null, 2))}to ${Bot.codeBlock(JSON.stringify(validEvent.event, null, 2))}`,
                                {title: "Success", color: "#00ff00"}
                            );
                        } else {
                            return super.error(interaction, interaction.language.get("COMMAND_EVENT_EDIT_BROKE") + "\n" + res.error);
                        }
                    } catch (e) {
                        return super.error(interaction, e.message);
                    }
                }
            }
        }

        async function updateEvent(id, event) {
            const out = await Bot.database.models.eventDBs.update(event, {where: {eventID: id}})
                .then(() => {
                    return { success: true, error: null };
                })
                .catch(error => {
                    Bot.logger.error(`(Ev updateEvent)Broke trying to create new event \ninteraction: ${interaction.content}\nError: ${error}`);
                    return { success: false, error: error };
                });
            return out;
        }

        function removeTags(interaction, mess) {
            const userReg = /<@!?(1|\d{17,19})>/g;
            const roleReg = /<@&(1|\d{17,19})>/g;
            const chanReg = /<#(1|\d{17,19})>/g;

            const userResult = mess.match(userReg);
            const roleResult = mess.match(roleReg);
            const chanResult = mess.match(chanReg);
            if (userResult !== null) {
                userResult.forEach(user => {
                    const userID = user.replace(/\D/g,"");
                    const thisUser = interaction.guild.members.cache.get(userID);
                    const userName = thisUser ? `${thisUser.displayName}` : `${interaction.client.users.cache.get(user) ? interaction.client.users.cache.get(user).username : "Unknown User"}`;
                    mess = mess.replace(user, userName);
                });
            }
            if (roleResult !== null) {
                roleResult.forEach(role => {
                    const roleID = role.replace(/\D/g,"");
                    let roleName;
                    try {
                        roleName = interaction.guild.roles.cache.get(roleID).name;
                    } catch (e) {
                        roleName = roleID;
                    }
                    mess = mess.replace(role, `@${roleName}`);
                });
            }
            if (chanResult !== null) {
                chanResult.forEach(chan => {
                    const chanID = chan.replace(/\D/g,"");
                    const chanName = interaction.guild.channels.cache.get(chanID).name;
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

                if (!event.name || !event.name.length) {
                    err.push(interaction.language.get("COMMAND_EVENT_JSON_INVALID_NAME"));
                } else {
                    if (nameArr.includes(event.name)) {
                        err.push(interaction.language.get("COMMAND_EVENT_JSON_DUPLICATE"));
                    } else {
                        nameArr.push(event.name);
                    }
                    newEvent.eventID = `${interaction.guild.id}-${event.name}`;
                }
                if (!event.day) {
                    err.push(interaction.language.get("COMMAND_EVENT_JSON_MISSING_DAY"));
                } else if (!event.day.match(/\d{1,2}\/\d{1,2}\/\d{2,4}/) || !momentTZ(event.day, "D/M/YYYY").isValid()) {
                    err.push(interaction.language.get("COMMAND_EVENT_JSON_INVALID_DAY", event.day));
                }
                if (!event.time) {
                    err.push(interaction.language.get("COMMAND_EVENT_JSON_MISSING_TIME"));
                } else if (!event.time.match(/^\d{1,2}:\d{2}$/) || !momentTZ(event.time, "H:mm").isValid()) {
                    err.push(interaction.language.get("COMMAND_EVENT_JSON_INVALID_TIME", event.time));
                }
                newEvent.eventDT = momentTZ.tz(`${event.day} ${event.time}`, "DD/MM/YYYY H:mm", guildConf.timezone).unix() * 1000;
                if (momentTZ(newEvent.eventDT).isBefore(momentTZ())) {
                    const eventDATE = momentTZ.tz(newEvent.eventDT, guildConf.timezone).format("D/M/YYYY H:mm");
                    const nowDATE = momentTZ().tz(guildConf["timezone"]).format("D/M/YYYY H:mm");

                    err.push(interaction.language.get("COMMAND_EVENT_PAST_DATE", eventDATE, nowDATE));
                }

                if (event.message?.length) {
                    if (event.message.length > MAX_MSG_SIZE) {
                        err.push(`Events have a maximum message length of ${MAX_MSG_SIZE} characters, this one is ${event.message.length} characters long`);
                    } else {
                        newEvent.eventMessage = event.message;
                    }
                }
                if (event.channel && !event.channelID) {
                    event.channelID = event.channel;
                }
                if (event.channelID) {
                    newEvent.eventChan = event.channelID;
                } else {
                    const announceChannel = interaction.guild.channels.cache.find(c => c.name === guildConf["announceChan"] || c.id === guildConf["announceChan"]);
                    if (!announceChannel) {
                        err.push(interaction.language.get("COMMAND_EVENT_NEED_CHAN"));
                    }
                }
                if (event.repeat && event.repeatDay) {
                    err.push(interaction.language.get("COMMAND_EVENT_JSON_NO_2X_REPEAT"));
                } else {
                    // If the repeat is set, try to parse it
                    const timeReg = /^\d{1,2}d\d{1,2}h\d{1,2}m/i;
                    if (event.repeat?.length) {
                        let repeat = event.repeat;
                        if (repeat.match(timeReg)) {
                            newEvent.repeat.repeatDay = parseInt(repeat.substring(0, repeat.indexOf("d")),  10);
                            repeat = repeat.replace(/^\d{1,2}d/, "");
                            newEvent.repeat.repeatHour = parseInt(repeat.substring(0, repeat.indexOf("h")), 10);
                            repeat = repeat.replace(/^\d{1,2}h/, "");
                            newEvent.repeat.repeatMin = parseInt(repeat.substring(0, repeat.indexOf("m")),  10);
                        } else {
                            err.push(interaction.language.get("COMMAND_EVENT_INVALID_REPEAT"));
                        }
                    } else if (event.repeatDay?.length) {
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
                                    err.push(interaction.language.get("COMMAND_EVENT_JSON_BAD_NUM"));
                                    return false;
                                }
                            });
                            if (!breaker) {
                                newEvent.repeatDays = jsonRepDay;
                            }
                        } else if (event.repeatDay.toString().match(dayReg)) {
                            const dayList = event.repeatDay.toString().split(",");
                            if (dayList.find(d => d <= 0)) {
                                err.push(interaction.language.get("COMMAND_EVENT_JSON_BAD_NUM"));
                            }
                            newEvent.repeatDays = dayList.map(d => parseInt(d, 10));
                        } else {
                            err.push(interaction.language.get("COMMAND_EVENT_JSON_BAD_FORMAT"));
                        }
                    }
                    if (!event.countdown || event.countdown === "false" || event.countdown === "no") {
                        newEvent.countdown = false;
                    } else if (event.countdown === true || event.countdown === "true" || event.countdown === "yes") {
                        newEvent.countdown = true;
                    } else {
                        err.push(interaction.language.get("COMMAND_EVENT_JSON_COUNTDOWN_BOOL"));
                    }
                }
                let outStr;
                if (err.length) {
                    outStr = interaction.language.get("COMMAND_EVENT_JSON_ERROR_LIST", (ix+1), err.map(e => `* ${e}`).join("\n"));
                } else {
                    outStr = interaction.language.get("COMMAND_EVENT_JSON_EVENT_VALID", (ix+1), event.name, event.time, event.day);
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
