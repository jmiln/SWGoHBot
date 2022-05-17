import momentTZ from "moment-timezone";
import "moment-duration-format";
import Discord, { TextChannel } from "discord.js";

// const {inspect} = require("util");

import SlashCommand from "../base/slashCommand";
import { BotInteraction, BotType, CommandOptions, SavedEvent, ValidateEvent } from "../modules/types";

// TODO Work out pagination with the fancy new buttons?
const EVENTS_PER_PAGE = 5;

class Event extends SlashCommand {
    constructor(Bot: BotType) {
        super(Bot, {
            name: "event",
            guildOnly: false,
            category: "Misc",
            options: [
                {
                    name: "create",
                    description: "Make a new event",
                    type: Bot.constants.optionType.SUB_COMMAND,
                    options: [
                        {
                            name: "name",
                            description: "The name of the event, no spaces allowed.",
                            type: Bot.constants.optionType.STRING,
                            required: true
                        },
                        {
                            name: "day",
                            type: Bot.constants.optionType.STRING,
                            description: "The date (DD/MM/YYYY) that you want it to go off",
                            required: true
                        },
                        {
                            name: "time",
                            type: Bot.constants.optionType.STRING,
                            description: "The time (HH:MM) that you want it to go off. This needs to be in 24hr format",
                            required: true
                        },
                        {
                            name: "message",
                            type: Bot.constants.optionType.STRING,
                            description: "The message that you want the event to spit back out",
                        },
                        {
                            name: "repeat",
                            type: Bot.constants.optionType.STRING,
                            description: "Lets you set a duration with the format of 00d00h00m. It will repeat after that time has passed.",
                        },
                        {
                            name: "repeatday",
                            type: Bot.constants.optionType.STRING,
                            description: "Lets you set it to repeat on set days with the format of 0,0,0,0,0.",
                        },
                        {
                            name: "channel",
                            type: Bot.constants.optionType.CHANNEL,
                            description: "Set which channel the event will announce on",
                        },
                        {
                            name: "countdown",
                            type: Bot.constants.optionType.BOOLEAN,
                            description: "Set to use the countdown or not (Configured in setconf)",
                        },
                    ]
                },
                {
                    name: "createjson",
                    description: "Create new event(s), inputted as a json code block",
                    type: Bot.constants.optionType.SUB_COMMAND,
                    options: [
                        {
                            name: "json",
                            description: "The json formatted text.",
                            type: Bot.constants.optionType.STRING,
                            required: true
                        }
                    ]
                },
                {
                    name: "delete",
                    description: "Delete an event",
                    type: Bot.constants.optionType.SUB_COMMAND,
                    options: [
                        {
                            name: "name",
                            description: "The unique name of the event you want to delete",
                            type: Bot.constants.optionType.STRING,
                            required: true
                        }
                    ]
                },
                {
                    name: "edit",
                    description: "Create new event(s), inputted as a json code block",
                    type: Bot.constants.optionType.SUB_COMMAND,
                    options: [
                        {
                            name: "event_name",
                            description: "The name of the event you want to edit",
                            type: Bot.constants.optionType.STRING,
                            required: true
                        },
                        {
                            name: "name",
                            description: "The new name of the event, no spaces allowed.",
                            type: Bot.constants.optionType.STRING,
                        },
                        {
                            name: "day",
                            type: Bot.constants.optionType.STRING,
                            description: "The date (DD/MM/YYYY) that you want it to go off",
                        },
                        {
                            name: "time",
                            type: Bot.constants.optionType.STRING,
                            description: "The time (HH:MM) that you want it to go off. This needs to be in 24hr format",
                        },
                        {
                            name: "message",
                            type: Bot.constants.optionType.STRING,
                            description: "The message that you want the event to spit back out",
                        },
                        {
                            name: "repeat",
                            type: Bot.constants.optionType.STRING,
                            description: "Lets you set a duration with the format of 00d00h00m. (Not compatible with repeatday)",
                        },
                        {
                            name: "repeatday",
                            type: Bot.constants.optionType.STRING,
                            description: "Lets you set it to repeat on set days with the format of 0,0,0,0,0. (Not compatible with reapeat)",
                        },
                        {
                            name: "channel",
                            type: Bot.constants.optionType.CHANNEL,
                            description: "Set which channel the event will announce on",
                        },
                        {
                            name: "countdown",
                            type: Bot.constants.optionType.BOOLEAN,
                            description: "Set to use the countdown or not (Configured in setconf)",
                        }
                    ]
                },
                {
                    // TODO Possibly work this in to have the dropdowns?
                    name: "trigger",
                    description: "Trigger the selected event",
                    type: Bot.constants.optionType.SUB_COMMAND,
                    options: [
                        {
                            name: "name",
                            description: "The unique name of the event you want to trigger",
                            type: Bot.constants.optionType.STRING,
                            required: true
                        }
                    ]
                },
                {
                    name: "view",
                    description: "View your event(s)",
                    type: Bot.constants.optionType.SUB_COMMAND,
                    options: [
                        {
                            name: "name",
                            description: "The unique name of the event you want to see.",
                            type: Bot.constants.optionType.STRING,
                        },
                        {
                            name: "minimal",
                            description: "Show the event(s), but without the message.",
                            type: Bot.constants.optionType.BOOLEAN,
                        },
                        {
                            name: "page_num",
                            description: `Set it to paginate the events, showing ${EVENTS_PER_PAGE} events at a time.`,
                            type: Bot.constants.optionType.INTEGER,
                        },
                    ]
                },
            ]
        });
    }

    async run(Bot: BotType, interaction: BotInteraction, options?: CommandOptions) {
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
            "repeatDays": []
        };

        const action = interaction.options.getSubcommand();
        const eventName = "";

        if (["create", "delete", "trigger"].includes(action)) {
            if (options.level < 3) {  // Permlevel 3 is the adminRole of the server, so anyone under that shouldn"t be able to use these
                return super.error(interaction, interaction.language.get("COMMAND_EVENT_INVALID_PERMS"));
            }
        }
        switch (action) {
            case "create": {
                const evName = interaction.options.getString("name");
                const evDate = interaction.options.getString("day");
                const evTime = interaction.options.getString("time");
                const evMsg = interaction.options.getString("message");
                const repeat = interaction.options.getString("repeat");
                const repeatDay = interaction.options.getString("repeatday");
                const channel = interaction.options.getChannel("channel");
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
                    .then((token: any) => token !== null)
                    .then((isUnique: any) => isUnique);
                if (exists) {
                    return super.error(interaction, interaction.language.get("COMMAND_EVENT_JSON_EXISTS"));
                }

                const newEv: ValidateEvent = {
                    name: evName,
                    time: evTime,
                    day: evDate,
                    message: evMsg?.length ? evMsg : null,
                    channelID: channel?.id ? channel.id : null,
                    countdown: countdown,
                    repeat: repeat,
                    repeatDay: repeatDay
                };

                let validEV = validateEvents([newEv])[0];
                if (!validEV) {
                    return super.error(interaction, "Something broke while trying to validate your event.");
                }
                if (!validEV?.valid) {
                    return super.error(interaction, validEV.str);
                }
                await Bot.socket.emit("addEvents", validEV.event, (res: any[]) => {
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


                    let jsonWhole: any[];
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
                        await Bot.socket.emit("addEvents", result.map(e => e.event), (res: any[]) => {
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

                    await Bot.socket.emit("getEventsByID", eventID, async function(event: SavedEvent) {
                        // If it doesn't find the event, say so
                        if (Array.isArray(event) && !event.length) return interaction.reply({content: interaction.language.get("COMMAND_EVENT_UNFOUND_EVENT", eventName)});

                        // From here on, it should have the event found, so process for viewing
                        if (Array.isArray(event)) event = event[0];
                        const eventDate = momentTZ(event.eventDT).tz(guildConf.timezone).format("MMM Do YYYY [at] H:mm");

                        let eventString = interaction.language.get("COMMAND_EVENT_TIME", eventName, eventDate);
                        eventString += interaction.language.get("COMMAND_EVENT_TIME_LEFT", momentTZ.utc(momentTZ.duration(momentTZ().diff(momentTZ(event.eventDT), "minutes") * -1, "minutes").asMilliseconds()).format("d [days], h [hrs], m [min]"));
                        if (event.eventChan && event.eventChan !== "") {
                            let chanName = "";
                            if (interaction.guild.channels.cache.has(event.eventChan)) {
                                chanName = interaction.guild.channels.cache.get(event.eventChan).name;
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
                    await Bot.socket.emit("getEventsByGuild", interaction.guild.id, async function(eventList: SavedEvent[]) {
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
                            let thisEventName = event.eventID.split("-").slice(0, 1).join("-");
                            const eventDate = momentTZ(event.eventDT).tz(guildConf.timezone).format("MMM Do YYYY [at] H:mm");

                            let eventString = interaction.language.get("COMMAND_EVENT_TIME", thisEventName, eventDate);
                            eventString += interaction.language.get("COMMAND_EVENT_TIME_LEFT", momentTZ.utc(momentTZ.duration(momentTZ().diff(momentTZ(event.eventDT), "minutes") * -1, "minutes").asMilliseconds()).format("d [days], h [hrs], m [min]"));
                            if (event.eventChan && event.eventChan !== "") {
                                let chanName = "";
                                if (interaction.guild.channels.cache.has(event.eventChan)) {
                                    chanName = interaction.guild.channels.cache.get(event.eventChan).name;
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
                                    evArray.forEach((evMsg: string, ix: number) => {
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
                const evName = interaction.options.getString("name");
                const eventID = `${interaction.guild.id}-${evName}`;

                await Bot.socket.emit("delEvent", eventID, async (result: {success: boolean, error: string}) => {
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
                    .then((token: any) => token !== null)
                    .then((isUnique: any) => isUnique);

                // Check if that name/ event already exists
                if (!exists) {
                    return interaction.reply({content: interaction.language.get("COMMAND_EVENT_UNFOUND_EVENT", eventName)});
                } else {
                    // As long as it does exist, go ahead and try triggering it
                    await Bot.socket.emit("getEventsByID", eventID, async function(event: SavedEvent) {
                        if (Array.isArray(event)) event = event[0];
                        var channel = null;
                        var announceMessage = `**${eventName}**\n${event.eventMessage}`;
                        if (event["eventChan"] && event.eventChan !== "") {  // If they"ve set a channel, try using it
                            channel = interaction.guild.channels.cache.get(event.eventChan) as TextChannel;
                            if (!channel) {
                                channel = interaction.guild.channels.cache.find(c => c.name === event.eventChan);
                            }
                        } else { // Else, use the default one from their settings
                            channel = interaction.guild.channels.cache.find(c => c.name === guildConf["announceChan"]) as TextChannel;
                        }
                        if (channel && channel.permissionsFor(interaction.guild.me).has(["SEND_MESSAGES", "VIEW_CHANNEL"])) {
                            try {
                                return channel.send({content: announceMessage});
                            } catch (e) {
                                Bot.logger.error("Event trigger Broke! " + announceMessage);
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

                const newEvDate = interaction.options.getString("day");
                const newEvTime = interaction.options.getString("time");
                const newEvMsg = interaction.options.getString("message");
                const newRepeat = interaction.options.getString("repeat");
                const newRepeatDay = interaction.options.getString("repeatday");
                const newChannel = interaction.options.getChannel("channel");
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
                        name: newEventName ? newEventName : evName,
                        day: newEvDate ? newEvDate : oldDate,
                        time: newEvTime ? newEvTime : oldTime,
                        message: newEvMsg ? newEvMsg : event.eventMessage,
                        channelID: newChannel?.id ? newChannel.id : event.channel,
                        countdown: newCountdown ? newCountdown : event.countdown,
                        repeat: null,
                        repeatDay: null
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

                    const validEvent = validateEvents([newEvent])[0];
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
                                if (validEvent.event[field].toString().length !== event[field].toString().length) {
                                    let from = "N/A", to = "N/A";    // Default if there's nothing to show
                                    let code = true;    // Show in inline code blocks
                                    if (field === "eventID") {
                                        field = "Name";
                                        from = evName;
                                        to = newEventName;
                                    } else if (field === "eventChan") {
                                        if (event.eventChan) {
                                            from = `<#${event.eventChan}>`;
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

        async function updateEvent(id: string, event: SavedEvent) {
            const out = await Bot.database.models.eventDBs.update(event, {where: {eventID: id}})
                .then(() => {
                    return { success: true, error: null };
                })
                .catch((error: Error) => {
                    Bot.logger.error(`(Ev updateEvent)Broke trying to create new event \ninteraction: ${interaction.options}\nError: ${error}`);
                    return { success: false, error: error };
                });
            return out;
        }

        function removeTags(interaction: Discord.Interaction, message: string) {
            const userReg = /<@!?(1|\d{17,19})>/g;
            const roleReg = /<@&(1|\d{17,19})>/g;
            const chanReg = /<#(1|\d{17,19})>/g;

            const userResult = message.match(userReg);
            const roleResult = message.match(roleReg);
            const chanResult = message.match(chanReg);
            if (userResult !== null) {
                userResult.forEach(user => {
                    const userID = user.replace(/\D/g,"");
                    const thisUser = interaction.guild.members.cache.get(userID);
                    const userName = thisUser ? `${thisUser.displayName}` : `${interaction.client.users.cache.get(user) ? interaction.client.users.cache.get(user).username : "Unknown User"}`;
                    message = message.replace(user, userName);
                });
            }
            if (roleResult !== null) {
                roleResult.forEach(role => {
                    const roleID = role.replace(/\D/g,"");
                    let roleName: string;
                    try {
                        roleName = interaction.guild.roles.cache.get(roleID).name;
                    } catch (e) {
                        roleName = roleID;
                    }
                    message = message.replace(role, `@${roleName}`);
                });
            }
            if (chanResult !== null) {
                chanResult.forEach(chan => {
                    const chanID = chan.replace(/\D/g,"");
                    const chanName = interaction.guild.channels.cache.get(chanID).name;
                    message = message.replace(chan, `#${chanName}`);
                });
            }
            message = message.replace(/`/g, "");
            return message;
        }
        function validateEvents(eventArray: ValidateEvent[]): {event: SavedEvent, str: string, valid: boolean}[] {
            const MAX_MSG_SIZE = 1000;
            const outEvents = [];
            const nameArr = [];
            if (!Array.isArray(eventArray)) eventArray = [eventArray];

            eventArray.forEach((event, ix) => {
                const err = [];
                const newEvent = {
                    eventID: "",
                    eventDT: 0,
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
                } else if (event.name.indexOf(" ") > -1) {
                    err.push(interaction.language.get("COMMAND_EVENT_JSON_NO_SPACES"));
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
                if (event.channelID) {
                    newEvent.eventChan = event.channelID;
                } else {
                    // TODO Make this work with channel ID as well so we can save those and make it more accurate and such
                    const announceChannel = interaction.guild.channels.cache.find(c => c.name === guildConf.announceChan || c.id === guildConf.announceChan);
                    if (!announceChannel) {
                        err.push(interaction.language.get("COMMAND_EVENT_NEED_CHAN"));
                    }
                }
                if (event.repeat && event.repeatDay?.length) {
                    err.push(interaction.language.get("COMMAND_EVENT_JSON_NO_2X_REPEAT"));
                } else {
                    // If the repeat is set, try to parse it
                    const timeReg = /^\d{1,2}d\d{1,2}h\d{1,2}m/i;
                    if (event.repeat?.length) {
                        let repeat: string = event.repeat.toString();
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
                            jsonRepDay = JSON.parse(event.repeatDay.toString());
                        } catch (e) {
                            // Don't bother since it's just gonna be a parse error, and it's already null
                        }
                        if (Array.isArray(jsonRepDay)) {
                            const breaker: any = jsonRepDay.forEach(r => {
                                if (r <= 0) {
                                    err.push(interaction.language.get("COMMAND_EVENT_JSON_BAD_NUM"));
                                    return false;
                                }
                            });
                            if (!breaker) {
                                newEvent.repeatDays = jsonRepDay;
                            }
                        } else if (event.repeatDay.toString().match(dayReg)) {
                            const dayList = event.repeatDay.toString().split(",").map((rd: string) => parseInt(rd, 10));
                            if (dayList.find((d) => d <= 0)) {
                                err.push(interaction.language.get("COMMAND_EVENT_JSON_BAD_NUM"));
                            }
                            newEvent.repeatDays = dayList.map(d => d);
                        } else {
                            err.push(interaction.language.get("COMMAND_EVENT_JSON_BAD_FORMAT"));
                        }
                    }
                    if (!event.countdown) {
                        newEvent.countdown = false;
                    } else if (event.countdown === true) {
                        newEvent.countdown = true;
                    } else {
                        err.push(interaction.language.get("COMMAND_EVENT_JSON_COUNTDOWN_BOOL"));
                    }
                }
                let outStr: string;
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
