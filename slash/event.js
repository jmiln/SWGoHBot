const { ApplicationCommandOptionType, codeBlock } = require("discord.js");

const Command = require("../base/slashCommand");
const {getGuildEvents, updateGuildEvent} = require("../modules/guildConfig/events.js");
const {getGuildSettings} = require("../modules/guildConfig/settings.js");

// TODO Work out pagination with the fancy new buttons?
const EVENTS_PER_PAGE = 5;

class Event extends Command {
    constructor(Bot) {
        super(Bot, {
            name: "event",
            guildOnly: false,
            options: [
                {
                    name: "create",
                    description: "Make a new event",
                    type: ApplicationCommandOptionType.Subcommand,
                    options: [
                        {
                            name: "name",
                            description: "The name of the event, no spaces allowed.",
                            type: ApplicationCommandOptionType.String,
                            required: true
                        },
                        {
                            name: "day",
                            type: ApplicationCommandOptionType.String,
                            description: "The date (DD/MM/YYYY) that you want it to go off",
                            required: true
                        },
                        {
                            name: "time",
                            type: ApplicationCommandOptionType.String,
                            description: "The time (HH:MM) that you want it to go off. This needs to be in 24hr format",
                            required: true
                        },
                        {
                            name: "message",
                            type: ApplicationCommandOptionType.String,
                            description: "The message that you want the event to spit back out",
                        },
                        {
                            name: "repeat",
                            type: ApplicationCommandOptionType.String,
                            description: "Lets you set a duration with the format of 00d00h00m. It will repeat after that time has passed.",
                        },
                        {
                            name: "repeatday",
                            type: ApplicationCommandOptionType.String,
                            description: "Lets you set it to repeat on set days with the format of 0,0,0,0,0.",
                        },
                        {
                            name: "channel",
                            type: ApplicationCommandOptionType.Channel,
                            description: "Set which channel the event will announce on",
                        },
                        {
                            name: "countdown",
                            type: ApplicationCommandOptionType.Boolean,
                            description: "Set to use the countdown or not (Configured in setconf)",
                        },
                    ]
                },
                {
                    name: "createjson",
                    description: "Create new event(s), inputted as a json code block",
                    type: ApplicationCommandOptionType.Subcommand,
                    options: [
                        {
                            name: "json",
                            description: "The json formatted text.",
                            type: ApplicationCommandOptionType.String,
                            required: true
                        }
                    ]
                },
                {
                    name: "delete",
                    description: "Delete an event",
                    type: ApplicationCommandOptionType.Subcommand,
                    options: [
                        {
                            name: "name",
                            description: "The unique name of the event you want to delete",
                            type: ApplicationCommandOptionType.String,
                            required: true
                        }
                    ]
                },
                {
                    name: "edit",
                    description: "Create new event(s), inputted as a json code block",
                    type: ApplicationCommandOptionType.Subcommand,
                    options: [
                        {
                            name: "event_name",
                            description: "The name of the event you want to edit",
                            type: ApplicationCommandOptionType.String,
                            required: true
                        },
                        {
                            name: "name",
                            description: "The new name of the event, no spaces allowed.",
                            type: ApplicationCommandOptionType.String,
                        },
                        {
                            name: "day",
                            type: ApplicationCommandOptionType.String,
                            description: "The date (DD/MM/YYYY) that you want it to go off",
                        },
                        {
                            name: "time",
                            type: ApplicationCommandOptionType.String,
                            description: "The time (HH:MM) that you want it to go off. This needs to be in 24hr format",
                        },
                        {
                            name: "message",
                            type: ApplicationCommandOptionType.String,
                            description: "The message that you want the event to spit back out",
                        },
                        {
                            name: "repeat",
                            type: ApplicationCommandOptionType.String,
                            description: "Lets you set a duration with the format of 00d00h00m. (Not compatible with repeatday)",
                        },
                        {
                            name: "repeatday",
                            type: ApplicationCommandOptionType.String,
                            description: "Lets you set it to repeat on set days with the format of 0,0,0,0,0. (Not compatible with reapeat)",
                        },
                        {
                            name: "channel",
                            type: ApplicationCommandOptionType.Channel,
                            description: "Set which channel the event will announce on",
                        },
                        {
                            name: "countdown",
                            type: ApplicationCommandOptionType.Boolean,
                            description: "Set to use the countdown or not (Configured in setconf)",
                        }
                    ]
                },
                {
                    // TODO Possibly work this in to have the dropdowns / autocomplete?
                    //  - This should be doable since we get the guild's config for each interaction
                    //  - Should do so for view, delete, and any others that reference a specific event
                    name: "trigger",
                    description: "Trigger the selected event",
                    type: ApplicationCommandOptionType.Subcommand,
                    options: [
                        {
                            name: "name",
                            description: "The unique name of the event you want to trigger",
                            type: ApplicationCommandOptionType.String,
                            required: true
                        }
                    ]
                },
                {
                    name: "view",
                    description: "View your event(s)",
                    type: ApplicationCommandOptionType.Subcommand,
                    options: [
                        {
                            name: "name",
                            description: "The unique name of the event you want to see.",
                            type: ApplicationCommandOptionType.String,
                        },
                        {
                            name: "minimal",
                            description: "Show the event(s), but without the message.",
                            type: ApplicationCommandOptionType.Boolean,
                        },
                        {
                            name: "page_num",
                            description: `Set it to paginate the events, showing ${EVENTS_PER_PAGE} events at a time.`,
                            type: ApplicationCommandOptionType.Integer,
                        },
                        {
                            name: "filter",
                            description: "Show only events that match the filter",
                            type: ApplicationCommandOptionType.String
                        }
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
        const guildConf = await getGuildSettings({cache: Bot.cache, guildId: interaction.guild.id});

        // const exampleEvent = {
        //     "name": "eventName",
        //     "eventDT": 1545299520000,
        //     "message": "eventMsg",
        //     "channel": null,
        //     "countdown": false,
        //     "repeat": {
        //         "repeatDay": 0,
        //         "repeatHour": 0,
        //         "repeatMin": 0
        //     },
        //     "repeatDays": 0
        // };

        const action = interaction.options.getSubcommand();

        if (["create", "createjson", "delete", "edit", "trigger"].includes(action.toLowerCase()) && options.level < Bot.constants.permMap.GUILD_ADMIN) {
            return super.error(interaction, interaction.language.get("COMMAND_EVENT_INVALID_PERMS"));
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

                const guildEvents = await getGuildEvents({cache: Bot.cache, guildId: interaction.guild.id});
                const evCount = guildEvents.length;
                // If they have too many events, stop here
                if (evCount >= 50) {
                    // 50 should be fine, as at the time of making this, the most anyone has is 31
                    return super.error(interaction, interaction.language.get("COMMAND_EVENT_TOO_MANY_EVENTS"));
                }

                // Check if that name/ event already exists
                const exists = guildEvents.findIndex(ev => ev.name === evName);
                if (exists > -1) {
                    return super.error(interaction, interaction.language.get("COMMAND_EVENT_JSON_EXISTS"));
                }

                const newEv = {
                    name: evName,
                    time: evTime,
                    day: evDate,
                    message: evMsg?.length ? evMsg : "",
                    channel: channel?.id ? channel.id : null,
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
                await Bot.socket.emit("addEvents", {guildId: interaction.guild.id, events: [validEV.event]}, (res) => {
                    const ev = res[0];
                    if (!ev.success) {
                        return interaction.reply({content: interaction.language.get("COMMAND_EVENT_NO_CREATE") + "\n\n**" + evName + "**\n" + ev.error});
                    }
                    return interaction.reply({content: interaction.language.get("COMMAND_EVENT_CREATED", evName, getDateTimeStr(validEV.event.eventDT, guildConf.timezone))});
                });
                break;
            }
            case "createjson": {
                // Using the json code block method of creating events
                const jsonIn = interaction.options.getString("json");
                // const regex = new RegExp(/([`]{3}\s*)([^```]*)(\s*[`]{3})/);     // This is flawed since it breaks as soon as it finds any backticks (`)

                // Grab anything within the triple backticks
                // const regex = /(?<=[`]{3})(.*)(?=[`]{3})/;

                // Grab anything within backticks,        or array    or object
                const regex = /(?<=[`]{3})(.*)(?=[`]{3})|(\[.*]$)|(\{[^}]*}$)/;
                const match = jsonIn.match(regex);

                if (!match) return super.error(interaction, interaction.language.get("COMMAND_EVENT_JSON_BAD_JSON"));

                // Make sure the event objects are in an array
                const matchWhole = match[0].replace(/\n/g, "");
                if ((!matchWhole.startsWith("[") || !matchWhole.endsWith("]")) && (!matchWhole.startsWith("{") || !matchWhole.endsWith("}"))) {
                    return super.error(interaction, "Invalid json, please make sure the event(s) are surrounded by square brackets (`[]`) at the beginning and end, OR it's a proper json object inside curly brackets (`{}`).");
                }

                let jsonWhole;
                try {
                    jsonWhole = JSON.parse(match[0]);
                } catch (e) {
                    return super.error(interaction, "**ERROR Parsing the json**" + codeBlock(e.message));
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
                const guildEvents = await getGuildEvents({cache: Bot.cache, guildId: interaction.guild.id});
                const result = validateEvents(jsonWhole, guildEvents);
                if (result.filter(e => !e.valid).length) {
                    return interaction.reply({content: interaction.language.get("COMMAND_EVENT_JSON_ERR_NOT_ADDED", codeBlock(result.map(e => e.str).join("\n\n")))});
                }

                // If there were no errors in the setup, go ahead and add all the events in, then tell em as such
                await Bot.socket.emit("addEvents", {guildId: interaction.guild.id, events: result.map(e => e.event)}, (res) => {
                    const evAddLog = [];
                    const evFailLog = [];

                    for (const ev of res) {
                        const thisEvent = ev.event;
                        if (ev.success) {
                            evAddLog.push(interaction.language.get("COMMAND_EVENT_CREATED", thisEvent.name, getDateTimeStr(thisEvent.eventDT, guildConf.timezone)));
                        } else {
                            evFailLog.push(interaction.language.get("COMMAND_EVENT_JSON_EV_ADD_ERROR", thisEvent.name, ev.error));
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
                break;
            }
            case "view": {
                const array = [];
                const eventName = interaction.options.getString("name");
                const minimal = interaction.options.getBoolean("minimal");
                const page = interaction.options.getInteger("page_num");
                const evFilter = interaction.options.getString("filter");

                if (eventName && evFilter) {
                    return super.error(interaction, "Sorry, but you cannot use both name and filter. Please try again with just one of those options.");
                }

                if (eventName) {
                    // If they are looking to show a specific event
                    await Bot.socket.emit("getEventByName", {guildId: interaction.guild.id, evName: eventName}, async function(event) {
                        // If it doesn't find the event, say so
                        if (Array.isArray(event) && !event.length) return interaction.reply({content: interaction.language.get("COMMAND_EVENT_UNFOUND_EVENT", eventName)});

                        // From here on, it should have the event found, so process for viewing
                        if (Array.isArray(event)) event = event[0];

                        let eventString = interaction.language.get("COMMAND_EVENT_TIME", event.name, `<t:${Math.floor(event.eventDT/1000)}:f>`);
                        eventString += interaction.language.get("COMMAND_EVENT_TIME_LEFT", `<t:${Math.floor(event.eventDT/1000)}:R>`);
                        if (event.channel?.length) {
                            let chanName = null;
                            if (interaction.guild.channels.cache.has(event.channel)) {
                                chanName = `<#${interaction.guild.channels.cache.get(event.channel).id}>`;
                            } else {
                                chanName = event.channel;
                            }
                            eventString += interaction.language.get("COMMAND_EVENT_CHAN", chanName);
                        }
                        if (event.repeatDays.length > 0) {
                            eventString += interaction.language.get("COMMAND_EVENT_SCHEDULE", event.repeatDays.join(", "));
                        } else if (event["repeat"] && (event.repeat["repeatDay"] !== 0 || event.repeat["repeatHour"] !== 0 || event.repeat["repeatMin"] !== 0)) { // At least one of em is more than 0
                            eventString += interaction.language.get("COMMAND_EVENT_REPEAT", event.repeat["repeatDay"], event.repeat["repeatHour"], event.repeat["repeatMin"]);
                        }
                        if (!minimal && event.message?.length) {
                            // If they want to show all available events without the message showing
                            eventString += interaction.language.get("COMMAND_EVENT_MESSAGE", removeTags(interaction, event.message));
                        }
                        return interaction.reply({content: eventString});
                    });
                } else if (evFilter?.length) {
                    const filterArr = evFilter.split(" ");
                    return await Bot.socket.emit("getEventsByFilter", interaction.guild.id, filterArr, async function(eventList) {
                        await sendPaged({eventList, minimal, page});
                    });
                } else {
                    return await Bot.socket.emit("getEventsByGuild", interaction.guild.id, async function(eventList) {
                        // If it doesn't find any events, say so
                        await sendPaged({eventList, minimal, page});
                    });
                }
                break;
            } case "delete": {
                const eventName = interaction.options.getString("name");
                await Bot.socket.emit("delEvent", {guildId: interaction.guild.id, eventName: eventName}, async (result) => {
                    if (result.success) {
                        return super.success(interaction, interaction.language.get("COMMAND_EVENT_DELETED", eventName));
                    } else {
                        return super.error(interaction, result.error);
                    }
                });
                break;
            } case "trigger": {
                const eventName = interaction.options.getString("name");

                // As long as it does exist, go ahead and try triggering it
                await Bot.socket.emit("getEventByName", {guildId: interaction.guild.id, evName: eventName}, async function(event) {
                    if (Array.isArray(event)) event = event[0];
                    var channel = null;
                    var announceMessage = `**${event?.name || eventName}**\n${event?.message || ""}`;
                    if (event["channel"] && event.channel !== "") {  // If they"ve set a channel, try using it
                        channel = interaction.guild.channels.cache.get(event.channel);
                        if (!channel) {
                            channel = interaction.guild.channels.cache.find(c => c.name === event.channel || c.id === event.channel);
                        }
                    } else { // Else, use the default one from their settings
                        channel = interaction.guild.channels.cache.find(c => c.name === guildConf["announceChan"] || c.id === guildConf.announceChan);
                    }
                    if (channel && Bot.hasViewAndSend(channel, interaction.guild.members.me)) {
                        try {
                            channel.send({content: announceMessage});
                            return interaction.reply({content: "Successfully triggered " + event.name, ephemeral: true});
                        } catch (e) {
                            Bot.logger.error("Event trigger Broke! " + announceMessage);
                            return interaction.reply({content: `Broke when trying to trigger *${event.name}*.\nIf this continues, please report it.`, ephemeral: true});
                        }
                    }
                });
                break;
            } case "edit": {
                // Edit an event
                const eventName = interaction.options.getString("event_name");

                const newEventName = interaction.options.getString("name");

                const newEvDate    = interaction.options.getString("day");
                const newEvTime    = interaction.options.getString("time");
                const newEvMsg     = interaction.options.getString("message");
                const newRepeat    = interaction.options.getString("repeat");
                const newRepeatDay = interaction.options.getString("repeatday");
                const newChannel   = interaction.options.getChannel("channel");
                const newCountdown = interaction.options.getBoolean("countdown");

                const eventRes = await getGuildEvents({cache: Bot.cache, guildId: interaction.guild.id});
                const event = eventRes?.find(ev => ev.name === eventName);

                // Check if that name/ event already exists
                if (!event) {
                    return interaction.reply({content: interaction.language.get("COMMAND_EVENT_UNFOUND_EVENT", eventName)});
                } else {
                    const [oldDate, oldTime] = new Date(event.eventDT).toLocaleString("en-GB", {timeZone: "us/pacific", hour12: false, month: "numeric", year: "numeric", day: "numeric", hour: "numeric", minute: "numeric"}).split(", ");

                    // Put any new bits into an event skeleton
                    const newEvent = {
                        name:      newEventName ? newEventName : event.name,
                        day:       newEvDate ? newEvDate : oldDate,
                        time:      newEvTime ? newEvTime : oldTime,
                        message:   newEvMsg ? newEvMsg : event.message,
                        channelID: newChannel?.id ? newChannel.id : event.channel,
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
                        // console.log("Issue validating an event:");
                        // console.log(validEvent);
                        return super.error(interaction, "There was an issue with that: " + validEvent.str);
                    }

                    try {
                        const res = await updateGuildEvent({cache: Bot.cache, guildId: interaction.guild.id, evName: eventName, event: validEvent.event});
                        if (res.success) {
                            // Find all the fields that were updated
                            const outLog = [];
                            for (const field of Object.keys(validEvent.event)) {
                                if (["updated", "updatedAt", "createdAt"].includes(field)) continue;
                                if (validEvent.event[field].toString() !== event[field]?.toString()) {
                                    let from = "N/A", to = "N/A";    // Default if there's nothing to show
                                    let code = true;    // Show in inline code blocks
                                    if (field !== "channel") {
                                        if (event.channel) {
                                            if (Bot.isChannelId(event.channel)) {
                                                from = `<#${event.channel}>`;
                                            } else {
                                                from = event.channel;
                                            }
                                        }
                                        if (validEvent.event.channel) {
                                            to = `<#${validEvent.event.channel}>`;
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
                                // `Updated event from ${codeBlock(JSON.stringify(event, null, 2))}to ${codeBlock(JSON.stringify(validEvent.event, null, 2))}`,
                                {title: "Success", color: Bot.constants.colors.green}
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

        function removeTags(interaction, mess) {
            if (!mess) return mess;
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

        // TODO When running validateEvents, check against the guild's other events as well as the ones being entered now
        function validateEvents(eventArray, guildEvArray) {
            const now = new Date().getTime();
            const MAX_MSG_SIZE = 1000;
            const outEvents = [];
            const nameArr = [];
            if (!Array.isArray(eventArray)) eventArray = [eventArray];

            eventArray.forEach((event, ix) => {
                const err = [];
                const newEvent = {
                    name: "",
                    eventDT: 0,
                    message: "",
                    channel: null,
                    countdown: false,
                    repeat: {
                        "repeatDay": 0,
                        "repeatHour": 0,
                        "repeatMin": 0
                    },
                    repeatDays: []
                };

                if (!event?.name?.length) {
                    err.push(interaction.language.get("COMMAND_EVENT_JSON_INVALID_NAME"));
                } else {
                    if (nameArr.includes(event.name) || guildEvArray?.map(ev => ev.name).includes(event.name)) {
                        err.push(interaction.language.get("COMMAND_EVENT_JSON_DUPLICATE"));
                    } else {
                        nameArr.push(event.name);
                    }
                    newEvent.name = event.name;
                }
                const dateSplit = event.day?.split("/");
                const mmddyyyDate = `${dateSplit?.[1]}/${dateSplit?.[0]}/${dateSplit?.[2]}`;
                if (!event.day) {
                    err.push(interaction.language.get("COMMAND_EVENT_JSON_MISSING_DAY"));
                } else if (!event.day?.match(/\d{1,2}\/\d{1,2}\/\d{4}/) || !Date.parse(mmddyyyDate)) {
                    err.push(interaction.language.get("COMMAND_EVENT_JSON_INVALID_DAY", event.day));
                }
                if (!event.time) {
                    err.push(interaction.language.get("COMMAND_EVENT_JSON_MISSING_TIME"));
                } else if (!event.time.match(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)) {
                    err.push(interaction.language.get("COMMAND_EVENT_JSON_INVALID_TIME", event.time));
                }

                if (event.day && event.time) {
                    newEvent.eventDT = Bot.getSetTimeForTimezone(`${mmddyyyDate} ${event.time}`, guildConf.timezone);
                    if (newEvent.eventDT < now) {
                        const eventDATE = new Date(newEvent.eventDT).toLocaleString("en-GB", {timeZone: guildConf.timezone, hour12: false, month: "numeric", year: "numeric", day: "numeric", hour: "numeric", minute: "numeric"});
                        const nowDATE = new Date().toLocaleString("en-GB", {timeZone: guildConf.timezone, hour12: false, month: "numeric", year: "numeric", day: "numeric", hour: "numeric", minute: "numeric"});

                        err.push(interaction.language.get("COMMAND_EVENT_PAST_DATE", eventDATE, nowDATE));
                    }
                }

                if (event.message?.length) {
                    if (event.message.length > MAX_MSG_SIZE) {
                        err.push(`Events have a maximum message length of ${MAX_MSG_SIZE} characters, this one is ${event.message.length} characters long`);
                    } else {
                        newEvent.message = event.message;
                    }
                }
                if (event.channel && !event.channelID) {
                    newEvent.channel = event.channel;
                } else if (event.channelID?.length) {
                    newEvent.channel = event.channelID;
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
                            jsonRepDay.forEach(r => {
                                if (r <= 0) {
                                    err.push(interaction.language.get("COMMAND_EVENT_JSON_BAD_NUM"));
                                    return false;
                                }
                            });
                            if (!err?.length) {
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
                    outStr = interaction.language.get("COMMAND_EVENT_JSON_EVENT_VALID", (ix+1), newEvent.name, event.time, event.day);
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

        function getDateTimeStr(timeNum, zone) {
            if (!Bot.isValidZone(zone)) return "Invalid Zone";
            const outStr = new Date(timeNum).toLocaleString("en-US", {timeZone: zone, hour12: false, month: "long", year: "numeric", day: "numeric", hour: "numeric", minute: "numeric"});
            return outStr;
        }

        function sendPaged({eventList, minimal, page}) {
            if (Array.isArray(eventList) && eventList.length === 0) return interaction.reply({content: "I could not find any events for this server"});
            const evOutArr = [];

            // Otherwise, process the events for viewing, and display em

            // Sort the events by the time/ day
            let sortedEvents = eventList.sort((p, c) => p.eventDT - c.eventDT);

            // Grab the total # of events for later use
            const eventCount = sortedEvents.length;

            let PAGE_SELECTED = 1;
            const PAGES_NEEDED = Math.floor(eventCount / EVENTS_PER_PAGE) + 1;
            if (guildConf["useEventPages"] || page) {
                PAGE_SELECTED = page || 0;
                if (PAGE_SELECTED < 1) PAGE_SELECTED = 1;
                if (PAGE_SELECTED > PAGES_NEEDED) PAGE_SELECTED = PAGES_NEEDED;

                // If they have pages enabled, remove everything that isn"t within the selected page
                if (PAGES_NEEDED > 1) {
                    sortedEvents = sortedEvents.slice(EVENTS_PER_PAGE * (PAGE_SELECTED-1), EVENTS_PER_PAGE * PAGE_SELECTED);
                }
            }
            sortedEvents.forEach(event => {
                let eventString = interaction.language.get("COMMAND_EVENT_TIME", event.name, `<t:${Math.floor(event.eventDT/1000)}:f>`);
                eventString += interaction.language.get("COMMAND_EVENT_TIME_LEFT", `<t:${Math.floor(event.eventDT/1000)}:R>`);
                if (event.channel && event.channel !== "") {
                    let chanName = "";
                    if (interaction.guild.channels.cache.has(event.channel)) {
                        chanName = `<#${interaction.guild.channels.cache.get(event.channel).id}>`;
                    } else {
                        chanName = event.channel;
                    }
                    eventString += interaction.language.get("COMMAND_EVENT_CHAN", chanName);
                }
                if (event["repeatDays"]?.length > 0) {
                    eventString += interaction.language.get("COMMAND_EVENT_SCHEDULE", event.repeatDays.join(", "));
                } else if (event["repeat"] && (event.repeat["repeatDay"] !== 0 || event.repeat["repeatHour"] !== 0 || event.repeat["repeatMin"] !== 0)) { // At least one of em is more than 0
                    eventString += interaction.language.get("COMMAND_EVENT_REPEAT", event.repeat["repeatDay"], event.repeat["repeatHour"], event.repeat["repeatMin"]);
                }
                if (!minimal && event.message?.length) {
                    // If they want to show all available events with the message showing
                    const msg = removeTags(interaction, event.message);
                    eventString += interaction.language.get("COMMAND_EVENT_MESSAGE", msg);
                }
                evOutArr.push(eventString);
            });
            const evArray = Bot.msgArray(evOutArr, "\n\n");
            try {
                if (evArray.length === 0) {
                    return interaction.reply({content: interaction.language.get("COMMAND_EVENT_NO_EVENT")});
                } else {
                    if (!evArray.length) {
                        if (guildConf["useEventPages"]) {
                            return interaction.reply({content: interaction.language.get("COMMAND_EVENT_SHOW_PAGED", eventCount, PAGE_SELECTED, PAGES_NEEDED, evArray[0])});
                        }
                        return interaction.reply({content: interaction.language.get("COMMAND_EVENT_SHOW", eventCount, evArray[0])});
                    }
                    // TODO Figure out splitting these up to multiple message as needed
                    evArray.forEach((evMsg, ix) => {
                        if (guildConf["useEventPages"]) {
                            return interaction.reply({content: interaction.language.get("COMMAND_EVENT_SHOW_PAGED", eventCount, PAGE_SELECTED, PAGES_NEEDED, evMsg)});
                        }
                        if (ix === 0) {
                            // If it's the first one, reply to the interaction
                            return interaction.reply({content: interaction.language.get("COMMAND_EVENT_SHOW", eventCount, evMsg)});
                        }
                        // After the first one, just send to the channel instead of replying
                        return interaction.channel.send({content: evMsg});
                    });
                }
            } catch (err) {
                Bot.logger.error("Event View Broke! " + evArray);
            }
        }
    }
}

module.exports = Event;
