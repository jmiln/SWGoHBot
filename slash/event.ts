import {
    ApplicationCommandOptionType,
    type AutocompleteFocusedOption,
    type AutocompleteInteraction,
    type ChatInputCommandInteraction,
    codeBlock,
    type Guild,
    type GuildBasedChannel,
    InteractionContextType,
    MessageFlags,
    type MessageMentionOptions,
} from "discord.js";

import type Language from "../base/Language.ts";
import Command from "../base/slashCommand.ts";
import constants from "../data/constants/constants.ts";
import eventSocket from "../modules/eventSocket.ts";
import { getSetTimeForTimezone, hasViewAndSend, isChannelId, isValidZone, msgArray } from "../modules/functions.ts";
import { getGuildEvents, updateGuildEvent } from "../modules/guildConfig/events.ts";
import { getGuildSettings } from "../modules/guildConfig/settings.ts";
import logger from "../modules/Logger.ts";
import { toProperCase } from "../modules/utils/text.ts";
import type { GuildConfigSettings } from "../schemas/guildConfigs.schema.ts";
import type { GuildConfigEvent } from "../types/guildConfig_types.ts";
import type { CommandContext } from "../types/types.ts";

// The loosely-typed event shape that users/JSON provide before validation. validateEvents reads
// these defensively and produces a fully-formed GuildConfigEvent (with eventDT/repeat/repeatDays).
interface EventInput {
    name?: string | null;
    day?: string | null;
    time?: string | null;
    message?: string | null;
    channel?: string | null;
    channelID?: string | null;
    countdown?: boolean | null;
    repeat?: GuildConfigEvent["repeat"] | string;
    repeatStr?: string | null;
    repeatDay?: string | null;
    repeatDays?: number[];
    eventDT?: number | null;
}

// Viewing an event shows its message as it will be announced, mentions included, but must not ping
const NO_PINGS: MessageMentionOptions = { parse: [] };

// TODO Work out pagination with the fancy new buttons?
const EVENTS_PER_PAGE = 5;

export default class Event extends Command {
    static readonly metadata = {
        name: "event",
        description: "Configure and view events.",
        contexts: [InteractionContextType.Guild],
        category: "Admin",
        options: [
            {
                name: "create",
                description: "Make a new event",
                type: ApplicationCommandOptionType.Subcommand,
                options: [
                    {
                        name: "name",
                        description: "A unique name for the event",
                        type: ApplicationCommandOptionType.String,
                        required: true,
                    },
                    {
                        name: "day",
                        type: ApplicationCommandOptionType.String,
                        description: "The date it fires, as DD/MM/YYYY",
                        required: true,
                    },
                    {
                        name: "time",
                        type: ApplicationCommandOptionType.String,
                        description: "The time it fires, as HH:MM in 24-hour time, in the server's timezone (/setconf set timezone)",
                        required: true,
                    },
                    {
                        name: "message",
                        type: ApplicationCommandOptionType.String,
                        description: "What to post when the event fires (up to 1000 characters)",
                    },
                    {
                        name: "repeat",
                        type: ApplicationCommandOptionType.String,
                        description: "Repeat at a fixed interval, as 00d00h00m (7d0h0m is weekly)",
                    },
                    {
                        name: "repeatday",
                        type: ApplicationCommandOptionType.String,
                        description: "Days to wait between each repeat, e.g. 2,5,1. Stops after the last one. Ignored if repeat is set",
                    },
                    {
                        name: "channel",
                        type: ApplicationCommandOptionType.Channel,
                        description: "Where to post. Defaults to the server's announce channel (/setconf set announce_chan)",
                    },
                    {
                        name: "countdown",
                        type: ApplicationCommandOptionType.Boolean,
                        description: "Send countdown alerts before the event fires (times are set with /setconf add event_countdown)",
                    },
                ],
            },
            {
                name: "createjson",
                description: "Create one or more events from JSON",
                type: ApplicationCommandOptionType.Subcommand,
                options: [
                    {
                        name: "json",
                        description: "JSON object or array: name, day, time, plus optional message, repeat, repeatDay, channel, countdown",
                        type: ApplicationCommandOptionType.String,
                        required: true,
                    },
                ],
            },
            {
                name: "delete",
                description: "Delete an event",
                type: ApplicationCommandOptionType.Subcommand,
                options: [
                    {
                        name: "name",
                        description: "The event to delete",
                        type: ApplicationCommandOptionType.String,
                        required: true,
                        autocomplete: true,
                    },
                ],
            },
            {
                name: "edit",
                description: "Edit an existing event",
                type: ApplicationCommandOptionType.Subcommand,
                options: [
                    {
                        name: "event_name",
                        description: "The event to edit",
                        type: ApplicationCommandOptionType.String,
                        required: true,
                        autocomplete: true,
                    },
                    {
                        name: "name",
                        description: "Rename the event to this",
                        type: ApplicationCommandOptionType.String,
                    },
                    {
                        name: "day",
                        type: ApplicationCommandOptionType.String,
                        description: "New date, as DD/MM/YYYY",
                    },
                    {
                        name: "time",
                        type: ApplicationCommandOptionType.String,
                        description: "New time, as HH:MM in 24-hour time",
                    },
                    {
                        name: "message",
                        type: ApplicationCommandOptionType.String,
                        description: "New message to post when it fires (up to 1000 characters)",
                    },
                    {
                        name: "repeat",
                        type: ApplicationCommandOptionType.String,
                        description: "New fixed interval, as 00d00h00m (7d0h0m is weekly)",
                    },
                    {
                        name: "repeatday",
                        type: ApplicationCommandOptionType.String,
                        description: "New days to wait between each repeat, e.g. 2,5,1. Ignored if repeat is set",
                    },
                    {
                        name: "channel",
                        type: ApplicationCommandOptionType.Channel,
                        description: "New channel to post in",
                    },
                    {
                        name: "countdown",
                        type: ApplicationCommandOptionType.Boolean,
                        description: "True turns countdown alerts on, False turns them off. Leave it out to keep the current setting.",
                    },
                ],
            },
            {
                name: "trigger",
                description: "Post an event's message now, without changing its schedule",
                type: ApplicationCommandOptionType.Subcommand,
                options: [
                    {
                        name: "name",
                        description: "The event to post now",
                        type: ApplicationCommandOptionType.String,
                        required: true,
                        autocomplete: true,
                    },
                ],
            },
            {
                name: "view",
                description: "View this server's events",
                type: ApplicationCommandOptionType.Subcommand,
                options: [
                    {
                        name: "name",
                        description: "Show just this event",
                        type: ApplicationCommandOptionType.String,
                        autocomplete: true,
                    },
                    {
                        name: "minimal",
                        description: "Hide each event's message",
                        type: ApplicationCommandOptionType.Boolean,
                    },
                    {
                        name: "page_num",
                        description: `Which page of the list to show (${EVENTS_PER_PAGE} events per page)`,
                        type: ApplicationCommandOptionType.Integer,
                    },
                    {
                        name: "filter",
                        description: "Show only events whose name or message contains every word given (case-sensitive)",
                        type: ApplicationCommandOptionType.String,
                    },
                ],
            },
        ],
    };

    constructor() {
        super(Event.metadata);
    }

    async autocomplete(interaction: AutocompleteInteraction, focusedOption: AutocompleteFocusedOption) {
        const searchKey = focusedOption.value?.trim().toLowerCase() || "";

        const guildEvents = await getGuildEvents({
            guildId: interaction.guild?.id ?? "",
        });

        const filteredEvents = guildEvents
            .filter((event) => event.name.toLowerCase().includes(searchKey))
            .map((event) => ({
                name: event.name,
                value: event.name,
            }))
            .slice(0, 25);

        await interaction.respond(filteredEvents);
    }

    async run({ interaction, language, permLevel }: CommandContext) {
        if (!interaction.inCachedGuild()) {
            return super.error(interaction, language.get("BASE_COMMAND_UNAVAILABLE"));
        }

        const guildConf = await getGuildSettings({ guildId: interaction.guild.id });

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

        if (
            ["create", "createjson", "delete", "edit", "trigger"].includes(action.toLowerCase()) &&
            permLevel < constants.permMap.GUILD_ADMIN
        ) {
            return super.error(interaction, language.get("BASE_MISSING_ADMIN_PERM"));
        }

        const guildEvents: GuildConfigEvent[] = await getGuildEvents({ guildId: interaction.guild.id });

        switch (action) {
            case "create":
                return this.createEvent(interaction, language, guildConf, guildEvents);
            case "createjson":
                return this.createEventsFromJson(interaction, language, guildConf, guildEvents);
            case "view":
                return this.viewEvents(interaction, language, guildConf);
            case "delete":
                return this.deleteEvent(interaction, language);
            case "trigger":
                return this.triggerEvent(interaction, guildConf);
            case "edit":
                return this.editEvent(interaction, language, guildConf, guildEvents);
        }
    }

    private async createEvent(
        interaction: ChatInputCommandInteraction<"cached">,
        language: Language,
        guildConf: GuildConfigSettings,
        guildEvents: GuildConfigEvent[],
    ) {
        const evName = interaction.options.getString("name");
        const evDate = interaction.options.getString("day");
        const evTime = interaction.options.getString("time");
        const evMsg = interaction.options.getString("message");
        const repeatStr = interaction.options.getString("repeat");
        const repeatDay = interaction.options.getString("repeatday");
        const channel = interaction.options.getChannel("channel");
        const countdown = interaction.options.getBoolean("countdown");

        const evCount = guildEvents.length;
        // If they have too many events, stop here
        if (evCount >= 50) {
            // 50 should be fine, as at the time of making this, the most anyone has is 31
            return super.error(interaction, language.get("COMMAND_EVENT_TOO_MANY_EVENTS"));
        }

        // Check if that name/ event already exists
        const exists = guildEvents.findIndex((ev) => ev.name === evName);
        if (exists > -1) {
            return super.error(interaction, language.get("COMMAND_EVENT_JSON_EXISTS"));
        }

        const newEv = {
            name: evName,
            time: evTime,
            day: evDate,
            message: evMsg?.length ? evMsg : "",
            channel: channel?.id ? channel.id : null,
            countdown: countdown,
            repeatStr: repeatStr,
            repeatDay: repeatDay,
            eventDT: null,
        };

        const validEV = validateEvents([newEv], guildEvents, { language, guildConf, guild: interaction.guild })[0];
        if (!validEV) {
            return super.error(interaction, language.get("COMMAND_EVENT_VALIDATE_ERROR"));
        }
        if (!validEV?.valid) {
            return super.error(interaction, validEV.str);
        }

        const res = await eventSocket.addEvents(interaction.guild.id, [validEV.event]);
        const ev = res[0];

        if (!ev.success) {
            return interaction.reply({
                content: `${language.get("COMMAND_EVENT_NO_CREATE")}\n\n**${evName}**\n${ev.error}`,
            });
        }
        return interaction.reply({
            content: language.get("COMMAND_EVENT_CREATED", evName ?? "", getDateTimeStr(validEV.event.eventDT, guildConf.timezone)),
        });
    }

    private async createEventsFromJson(
        interaction: ChatInputCommandInteraction<"cached">,
        language: Language,
        guildConf: GuildConfigSettings,
        guildEvents: GuildConfigEvent[],
    ) {
        // Using the json code block method of creating events
        const jsonIn = interaction.options.getString("json") ?? "";
        // const regex = new RegExp(/([`]{3}\s*)([^```]*)(\s*[`]{3})/);     // This is flawed since it breaks as soon as it finds any backticks (`)

        // Grab anything within the triple backticks
        // const regex = /(?<=[`]{3})(.*)(?=[`]{3})/;

        // Grab anything within backticks,        or array    or object
        const regex = /(?<=[`]{3})(.*)(?=[`]{3})|(\[.*]$)|(\{[^}]*}$)/;
        const match = jsonIn.match(regex);

        if (!match) return super.error(interaction, language.get("COMMAND_EVENT_JSON_BAD_JSON"));

        // Make sure the event objects are in an array
        const matchWhole = match[0].replace(/\n/g, "");
        if ((!matchWhole.startsWith("[") || !matchWhole.endsWith("]")) && (!matchWhole.startsWith("{") || !matchWhole.endsWith("}"))) {
            return super.error(
                interaction,
                "Invalid json, please make sure the event(s) are surrounded by square brackets (`[]`) at the beginning and end, OR it's a proper json object inside curly brackets (`{}`).",
            );
        }

        let jsonWhole: GuildConfigEvent[];
        try {
            const parsedJSON = JSON.parse(match[0]);
            if (Array.isArray(parsedJSON)) {
                jsonWhole = parsedJSON;
            } else {
                jsonWhole = [parsedJSON];
            }
        } catch (e) {
            return super.error(interaction, `**ERROR Parsing the json**${codeBlock(e instanceof Error ? e.message : String(e))}`);
        }

        // ```json
        // [{
        //     "name":      "Example",
        //     "time":      "12:36",                 // hh:mm    (24hr format)
        //     "day":       "28/09/18",              // dd/mm/yy
        //     "message":   "Example message here",  // If you need a line break, put \n in the spot you want it
        //     "repeatDay": [0, 0, 0],               // Only need one of these, if
        //     "repeat":    "0d0h0m",                // you have both, it won't work
        //     "countdown": false,                   // true if you want a countdown, false if not
        //     "channel":   "327974285563920387"     // Channel ID, not name anymore
        // }]
        // ```

        // TODO Maybe add in a special help for -json  ";ev -jsonHelp" since it'll need more of a description
        const result = validateEvents(jsonWhole, guildEvents, { language, guildConf, guild: interaction.guild });
        if (result.filter((e) => !e.valid).length) {
            return interaction.reply({
                content: language.get("COMMAND_EVENT_JSON_ERR_NOT_ADDED", codeBlock(result.map((e) => e.str).join("\n\n"))),
            });
        }

        // If there were no errors in the setup, go ahead and add all the events in, then tell em as such
        const res = await eventSocket.addEvents(
            interaction.guild.id,
            result.map((e) => e.event),
        );
        return interaction.reply({ embeds: [eventAddLogEmbed(res, language, guildConf.timezone)] });
    }

    private async viewEvents(interaction: ChatInputCommandInteraction<"cached">, language: Language, guildConf: GuildConfigSettings) {
        const eventName = interaction.options.getString("name");
        const minimal = interaction.options.getBoolean("minimal") ?? false;
        const page = interaction.options.getInteger("page_num") ?? 1;
        const evFilter = interaction.options.getString("filter");

        if (eventName && evFilter) {
            return super.error(
                interaction,
                "Sorry, but you cannot use both name and filter. Please try again with just one of those options.",
            );
        }

        if (eventName) {
            // If they are looking to show a specific event
            const eventIn = await eventSocket.getEventByName(interaction.guild.id, eventName);

            // If it doesn't find the event, say so
            if (!eventIn) return interaction.reply({ content: language.get("COMMAND_EVENT_UNFOUND_EVENT", eventName) });

            return interaction.reply({
                content: formatEventDetails(eventIn, minimal, interaction.guild, language),
                allowedMentions: NO_PINGS,
            });
        }
        const eventList = evFilter?.length
            ? await eventSocket.getEventsByFilter(interaction.guild.id, evFilter.split(" "))
            : await eventSocket.getEventsByGuild(interaction.guild.id);
        return await sendPaged({ interaction, language, guildConf, eventList, minimal, page });
    }

    private async deleteEvent(interaction: ChatInputCommandInteraction<"cached">, language: Language) {
        const eventName = interaction.options.getString("name") ?? "";
        const result = await eventSocket.deleteEvent(interaction.guild.id, eventName);

        if (result.success) {
            return super.success(interaction, language.get("COMMAND_EVENT_DELETED", eventName));
        }
        return super.error(interaction, result.error ?? "");
    }

    private async triggerEvent(interaction: ChatInputCommandInteraction<"cached">, guildConf: GuildConfigSettings) {
        const eventName = interaction.options.getString("name") ?? "";

        // As long as it does exist, go ahead and try triggering it
        const eventIn = await eventSocket.getEventByName(interaction.guild.id, eventName);

        let channel: GuildBasedChannel | null = null;
        const announceMessage = `**${eventIn?.name || eventName}**\n${eventIn?.message || ""}`;
        if (eventIn?.channel && eventIn.channel !== "") {
            // If they"ve set a channel, try using it
            channel = interaction.guild.channels.cache.get(eventIn.channel) ?? findChannelByNameOrId(interaction.guild, eventIn.channel);
        } else {
            // Else, use the default one from their settings
            channel = findChannelByNameOrId(interaction.guild, guildConf.announceChan);
        }
        const botMember = interaction.guild.members.me;
        if (!channel?.isSendable() || !botMember || !(await hasViewAndSend(channel, botMember))) {
            return interaction.reply({
                content: `Could not trigger *${eventIn?.name || eventName}*: I can't post in its channel. Set a channel on the event, or configure \`announceChan\`, and make sure I can view and send messages there.`,
                flags: MessageFlags.Ephemeral,
            });
        }

        try {
            await channel.send({ content: announceMessage });
            return interaction.reply({
                content: `Successfully triggered ${eventIn?.name}`,
                flags: MessageFlags.Ephemeral,
            });
        } catch (err) {
            logger.error(`Event trigger Broke! ${announceMessage} - Error: ${err instanceof Error ? err.message : String(err)}`);
            return interaction.reply({
                content: `Broke when trying to trigger *${eventIn?.name}*.\nIf this continues, please report it.`,
                flags: MessageFlags.Ephemeral,
            });
        }
    }

    private async editEvent(
        interaction: ChatInputCommandInteraction<"cached">,
        language: Language,
        guildConf: GuildConfigSettings,
        guildEvents: GuildConfigEvent[],
    ) {
        const eventName = interaction.options.getString("event_name");

        const eventRes: GuildConfigEvent[] = await getGuildEvents({ guildId: interaction.guild.id });
        const event = eventRes?.find((ev) => ev.name === eventName);

        if (!event) {
            return interaction.reply({ content: language.get("COMMAND_EVENT_UNFOUND_EVENT", eventName ?? "") });
        }

        const newEvent = editedEventInput(event, interaction, guildConf.timezone);
        const otherEvents = guildEvents.filter((ev) => ev.name !== event.name);
        const validEvent = validateEvents([newEvent], otherEvents, { language, guildConf, guild: interaction.guild })[0];
        if (!validEvent.valid) {
            logger.debug("Issue validating an event:");
            logger.debug(validEvent);
            return super.error(interaction, `There was an issue with that: ${validEvent.str}`);
        }

        try {
            const res = await updateGuildEvent({
                guildId: interaction.guild.id,
                evName: event.name,
                event: validEvent.event,
            });
            if (res?.success) {
                const outLog = describeEventChanges(event, validEvent.event);
                return super.error(
                    interaction,
                    `**__UPDATED:__**\n${outLog.map((e) => `- ${e}`).join("\n")}`,
                    // `Updated event from ${codeBlock(JSON.stringify(event, null, 2))}to ${codeBlock(JSON.stringify(validEvent.event, null, 2))}`,
                    { title: "Success", color: constants.colors.green },
                );
            }
            return super.error(interaction, `${language.get("COMMAND_EVENT_EDIT_BROKE")}\n${res?.error}`);
        } catch (e) {
            return super.error(interaction, e instanceof Error ? e.message : String(e));
        }
    }
}

interface ValidateContext {
    language: Language;
    guildConf: GuildConfigSettings;
    guild: Guild;
}

interface ValidatedEvent {
    event: GuildConfigEvent;
    str: string;
    valid: boolean;
}

const MAX_MSG_SIZE = 1000;

const DATE_TIME_PARTS: Intl.DateTimeFormatOptions = {
    hour12: false,
    month: "numeric",
    year: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
};

function eventAddLogEmbed(res: Awaited<ReturnType<typeof eventSocket.addEvents>>, language: Language, timezone: string) {
    const evAddLog: string[] = [];
    const evFailLog: string[] = [];

    for (const ev of res) {
        const thisEvent = ev.event;
        if (ev.success) {
            evAddLog.push(language.get("COMMAND_EVENT_CREATED", thisEvent.name, getDateTimeStr(thisEvent.eventDT, timezone)));
        } else {
            evFailLog.push(language.get("COMMAND_EVENT_JSON_EV_ADD_ERROR", thisEvent.name, ev.error ?? ""));
        }
    }
    return {
        title: "Event(s) add log",
        fields: [
            {
                name: "Success",
                value: evAddLog.join("\n") || "N/A",
            },
            {
                name: "Failures",
                value: evFailLog.join("\n") || "N/A",
            },
        ],
    };
}

function findChannelByNameOrId(guild: Guild, nameOrId: string): GuildBasedChannel | null {
    return guild.channels.cache.find((c) => c.name === nameOrId || c.id === nameOrId) ?? null;
}

// Put any new bits into an event skeleton
function editedEventInput(event: GuildConfigEvent, interaction: ChatInputCommandInteraction<"cached">, timezone: string): EventInput {
    const newEventName = interaction.options.getString("name");
    const newEvDate = interaction.options.getString("day");
    const newEvTime = interaction.options.getString("time");
    const newEvMsg = interaction.options.getString("message");
    const newRepeat = interaction.options.getString("repeat");
    const newRepeatDay = interaction.options.getString("repeatday");
    const newChannel = interaction.options.getChannel("channel");
    const newCountdown = interaction.options.getBoolean("countdown");

    const [oldDate, oldTime] = new Date(event.eventDT).toLocaleString("en-GB", { timeZone: timezone, ...DATE_TIME_PARTS }).split(", ");

    const newEvent: EventInput = {
        name: newEventName ? newEventName : event.name,
        day: newEvDate ? newEvDate : oldDate,
        time: newEvTime ? newEvTime : oldTime,
        message: newEvMsg ? newEvMsg : event.message,
        channel: newChannel?.id ? newChannel.id : event.channel,
        countdown: newCountdown ?? event.countdown,
        eventDT: null,
        repeatDay: null,
    };
    if (newRepeat) {
        newEvent.repeatStr = newRepeat;
    } else if (newRepeatDay) {
        newEvent.repeatDay = newRepeatDay;
    } else if (event.repeat?.repeatDay || event.repeat?.repeatHour || event.repeat?.repeatMin) {
        newEvent.repeatStr = `${event.repeat.repeatDay}d${event.repeat.repeatHour}h${event.repeat.repeatMin}m`;
    } else if (event.repeatDays?.length) {
        newEvent.repeatDay = event.repeatDays.join(",");
    }
    return newEvent;
}

function describeEventChanges(oldEvent: GuildConfigEvent, newEvent: GuildConfigEvent): string[] {
    const outLog: string[] = [];
    for (const field of Object.keys(newEvent)) {
        if (["updated", "updatedAt", "createdAt"].includes(field)) continue;
        const fKey = field as keyof GuildConfigEvent;
        if (newEvent[fKey]?.toString() === oldEvent[fKey]?.toString()) continue;

        if (field === "channel") {
            outLog.push(
                `Updated **${toProperCase(field)}** from ${channelChangeFrom(oldEvent.channel)} to ${channelMention(newEvent.channel)}`,
            );
        } else {
            const from = oldEvent[fKey]?.toString().length ? oldEvent[fKey].toString() : "N/A";
            const to = newEvent[fKey]?.toString().length ? newEvent[fKey].toString() : "N/A";
            outLog.push(`Updated **${toProperCase(field)}** from \`${from}\` to \`${to}\``);
        }
    }
    return outLog;
}

function channelChangeFrom(channel: GuildConfigEvent["channel"]): string {
    if (!channel) return "N/A";
    return isChannelId(channel) ? `<#${channel}>` : channel;
}

function channelMention(channel: GuildConfigEvent["channel"]): string {
    return channel ? `<#${channel}>` : "N/A";
}

function validateEvents(eventArr: EventInput[], guildEvArray: GuildConfigEvent[], ctx: ValidateContext): ValidatedEvent[] {
    const now = Date.now();
    const nameArr: string[] = [];
    const guildEvNames = new Set(guildEvArray?.map((ev) => ev.name) ?? []);
    const eventArray = Array.isArray(eventArr) ? eventArr : [eventArr];
    return eventArray.map((thisEvent, ix) => validateEvent(thisEvent, ix, { ctx, now, nameArr, guildEvNames }));
}

function validateEvent(
    thisEvent: EventInput,
    ix: number,
    { ctx, now, nameArr, guildEvNames }: { ctx: ValidateContext; now: number; nameArr: string[]; guildEvNames: Set<string> },
): ValidatedEvent {
    const { language } = ctx;
    const err: string[] = [];
    const newEvent: GuildConfigEvent = {
        name: "",
        eventDT: 0,
        message: "",
        channel: null,
        countdown: false,
        repeat: {
            repeatDay: 0,
            repeatHour: 0,
            repeatMin: 0,
        },
        repeatDays: [],
    };

    if (!thisEvent?.name?.length) {
        err.push(language.get("COMMAND_EVENT_JSON_INVALID_NAME"));
    } else {
        if (nameArr.includes(thisEvent.name) || guildEvNames.has(thisEvent.name)) {
            err.push(language.get("COMMAND_EVENT_JSON_DUPLICATE"));
        } else {
            nameArr.push(thisEvent.name);
        }
        newEvent.name = thisEvent.name;
    }
    validateEventTime(thisEvent, newEvent, err, ctx, now);
    validateEventMessage(thisEvent, newEvent, err);
    validateEventChannel(thisEvent, newEvent, err, ctx);
    if (thisEvent.repeat && thisEvent.repeatDay) {
        err.push(language.get("COMMAND_EVENT_JSON_NO_2X_REPEAT"));
    } else {
        parseEventRepeat(thisEvent, newEvent, err, language);
        newEvent.countdown = thisEvent.countdown ?? false;
    }

    const outStr = err.length
        ? language.get("COMMAND_EVENT_JSON_ERROR_LIST", ix + 1, err.map((e) => `* ${e}`).join("\n"))
        : language.get("COMMAND_EVENT_JSON_EVENT_VALID", ix + 1, newEvent.name, thisEvent.time ?? "", thisEvent.day ?? "");
    return {
        event: newEvent,
        str: outStr,
        valid: !err.length,
    };
}

function validateEventTime(thisEvent: EventInput, newEvent: GuildConfigEvent, err: string[], ctx: ValidateContext, now: number) {
    const { language, guildConf } = ctx;
    const dateSplit = thisEvent.day?.split("/");
    const mmddyyyDate = `${dateSplit?.[1]}/${dateSplit?.[0]}/${dateSplit?.[2]}`;
    if (!thisEvent.day) {
        err.push(language.get("COMMAND_EVENT_JSON_MISSING_DAY"));
    } else if (!thisEvent.day?.match(/\d{1,2}\/\d{1,2}\/\d{4}/) || !Date.parse(mmddyyyDate)) {
        err.push(language.get("COMMAND_EVENT_JSON_INVALID_DAY", thisEvent.day));
    }
    if (!thisEvent.time) {
        err.push(language.get("COMMAND_EVENT_JSON_MISSING_TIME"));
    } else if (!thisEvent.time.match(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)) {
        err.push(language.get("COMMAND_EVENT_JSON_INVALID_TIME", thisEvent.time));
    }

    if (!thisEvent.day || !thisEvent.time) return;
    newEvent.eventDT = getSetTimeForTimezone(`${mmddyyyDate} ${thisEvent.time}`, guildConf.timezone);
    if (newEvent.eventDT < now) {
        const eventDATE = new Date(newEvent.eventDT).toLocaleString("en-GB", { timeZone: guildConf.timezone, ...DATE_TIME_PARTS });
        const nowDATE = new Date().toLocaleString("en-GB", { timeZone: guildConf.timezone, ...DATE_TIME_PARTS });

        err.push(language.get("COMMAND_EVENT_PAST_DATE", eventDATE, nowDATE));
    }
}

function validateEventMessage(thisEvent: EventInput, newEvent: GuildConfigEvent, err: string[]) {
    if (!thisEvent.message?.length) return;
    if (thisEvent.message.length > MAX_MSG_SIZE) {
        err.push(
            `Events have a maximum message length of ${MAX_MSG_SIZE} characters, this one is ${thisEvent.message.length} characters long`,
        );
    } else {
        newEvent.message = thisEvent.message;
    }
}

function validateEventChannel(thisEvent: EventInput, newEvent: GuildConfigEvent, err: string[], ctx: ValidateContext) {
    if (thisEvent.channel && !thisEvent.channelID) {
        newEvent.channel = thisEvent.channel;
    } else if (thisEvent.channelID?.length) {
        newEvent.channel = thisEvent.channelID;
    } else if (!findChannelByNameOrId(ctx.guild, ctx.guildConf.announceChan)) {
        err.push(ctx.language.get("COMMAND_EVENT_NEED_CHAN"));
    }
}

// If the repeat is set, try to parse it
function parseEventRepeat(thisEvent: EventInput, newEvent: GuildConfigEvent, err: string[], language: Language) {
    const timeReg = /^\d{1,2}d\d{1,2}h\d{1,2}m/i;
    // createjson input names the interval string "repeat", the slash options name it repeatStr
    const repeatStr = thisEvent.repeatStr ?? (typeof thisEvent.repeat === "string" ? thisEvent.repeat : null);
    if (repeatStr?.length) {
        if (repeatStr.match(timeReg)) {
            const dayMatch = repeatStr.match(/(\d{1,2})d/);
            const hourMatch = repeatStr.match(/(\d{1,2})h/);
            const minMatch = repeatStr.match(/(\d{1,2})m/);

            newEvent.repeat = {
                repeatDay: Number.parseInt(dayMatch?.[1] || "0", 10),
                repeatHour: Number.parseInt(hourMatch?.[1] || "0", 10),
                repeatMin: Number.parseInt(minMatch?.[1] || "0", 10),
            };
        } else {
            err.push(language.get("COMMAND_EVENT_INVALID_REPEAT"));
        }
    } else if (thisEvent.repeatDay?.length) {
        parseEventRepeatDays(thisEvent.repeatDay, newEvent, err, language);
    }
}

function parseEventRepeatDays(repeatDay: string, newEvent: GuildConfigEvent, err: string[], language: Language) {
    const dayReg = /^[0-9,]*$/gi;
    let jsonRepDay: number[] | null = null;
    try {
        jsonRepDay = JSON.parse(repeatDay);
    } catch (_) {
        // Don't bother since it's just gonna be a parse error, and it's already null
    }
    if (Array.isArray(jsonRepDay)) {
        for (const r of jsonRepDay) {
            if (r <= 0) {
                err.push(language.get("COMMAND_EVENT_JSON_BAD_NUM"));
            }
        }
        // err also holds the earlier field errors, so any invalid field leaves repeatDays empty
        if (!err?.length) {
            newEvent.repeatDays = jsonRepDay;
        }
    } else if (repeatDay.toString().match(dayReg)) {
        const dayList = repeatDay.toString().split(",");
        if (dayList.find((d: string) => Number.parseInt(d, 10) <= 0)) {
            err.push(language.get("COMMAND_EVENT_JSON_BAD_NUM"));
        }
        newEvent.repeatDays = dayList.map((d: string) => Number.parseInt(d, 10));
    } else {
        err.push(language.get("COMMAND_EVENT_JSON_BAD_FORMAT"));
    }
}

function getDateTimeStr(timeNum: number, zone: string) {
    if (!isValidZone(zone)) return "Invalid Zone";
    const outStr = new Date(timeNum).toLocaleString("en-US", {
        timeZone: zone,
        hour12: false,
        month: "long",
        year: "numeric",
        day: "numeric",
        hour: "numeric",
        minute: "numeric",
    });
    return outStr;
}

function formatEventDetails(event: GuildConfigEvent, minimal: boolean, guild: Guild, language: Language): string {
    let eventString = language.get("COMMAND_EVENT_TIME", event.name, `<t:${Math.floor(event.eventDT / 1000)}:f>`);
    eventString += language.get("COMMAND_EVENT_TIME_LEFT", `<t:${Math.floor(event.eventDT / 1000)}:R>`);
    if (event.channel?.length) {
        const chanName = guild.channels.cache.has(event.channel) ? `<#${guild.channels.cache.get(event.channel)?.id}>` : event.channel;
        eventString += language.get("COMMAND_EVENT_CHAN", chanName);
    }
    if ((event.repeatDays?.length ?? 0) > 0) {
        eventString += language.get("COMMAND_EVENT_SCHEDULE", event.repeatDays?.join(", ") ?? "");
    } else if (event.repeat && (event.repeat.repeatDay !== 0 || event.repeat.repeatHour !== 0 || event.repeat.repeatMin !== 0)) {
        // At least one of em is more than 0
        eventString += language.get("COMMAND_EVENT_REPEAT", event.repeat.repeatDay, event.repeat.repeatHour, event.repeat.repeatMin);
    }
    if (!minimal && event.message?.length) {
        // If they want to show all available events with the message showing
        eventString += language.get("COMMAND_EVENT_MESSAGE", event.message);
    }
    return eventString;
}

function selectEventPage(sortedEvents: GuildConfigEvent[], page: number, useEventPages: boolean | undefined) {
    const PAGES_NEEDED = Math.floor(sortedEvents.length / EVENTS_PER_PAGE) + 1;
    if (!useEventPages && !page) return { pageEvents: sortedEvents, PAGE_SELECTED: 1, PAGES_NEEDED };

    const PAGE_SELECTED = Math.min(Math.max(page || 0, 1), PAGES_NEEDED);
    // If they have pages enabled, remove everything that isn"t within the selected page
    const pageEvents =
        PAGES_NEEDED > 1 ? sortedEvents.slice(EVENTS_PER_PAGE * (PAGE_SELECTED - 1), EVENTS_PER_PAGE * PAGE_SELECTED) : sortedEvents;
    return { pageEvents, PAGE_SELECTED, PAGES_NEEDED };
}

async function sendPaged({
    interaction,
    language,
    guildConf,
    eventList,
    minimal,
    page,
}: {
    interaction: ChatInputCommandInteraction<"cached">;
    language: Language;
    guildConf: GuildConfigSettings;
    eventList: GuildConfigEvent[];
    minimal: boolean;
    page: number;
}) {
    if (Array.isArray(eventList) && eventList.length === 0)
        return interaction.reply({ content: "I could not find any events for this server" });

    // Sort the events by the time/ day
    const sortedEvents = eventList.sort((p, c) => p.eventDT - c.eventDT);

    // Grab the total # of events for later use
    const eventCount = sortedEvents.length;

    const { pageEvents, PAGE_SELECTED, PAGES_NEEDED } = selectEventPage(sortedEvents, page, guildConf.useEventPages);
    const evArray = msgArray(
        pageEvents.map((event) => formatEventDetails(event, minimal, interaction.guild, language)),
        "\n\n",
    );
    try {
        if (evArray.length === 0) {
            return interaction.reply({ content: language.get("COMMAND_EVENT_NO_EVENT") });
        }
        if (evArray.length === 1) {
            return interaction.reply({
                content: language.get("COMMAND_EVENT_SHOW", eventCount, evArray[0]),
                allowedMentions: NO_PINGS,
            });
        }
        if (guildConf.useEventPages) {
            return interaction.reply({
                content: language.get("COMMAND_EVENT_SHOW_PAGED", eventCount, PAGE_SELECTED, PAGES_NEEDED, evArray[0]),
                allowedMentions: NO_PINGS,
            });
        }
        await interaction.reply({
            content: language.get("COMMAND_EVENT_SHOW", eventCount, evArray[0]),
            allowedMentions: NO_PINGS,
        });
        for (const evMsg of evArray.slice(1)) {
            if (interaction.channel?.isSendable()) {
                await interaction.channel.send({ content: evMsg, allowedMentions: NO_PINGS });
            }
        }
    } catch (err) {
        logger.error(`Event View Broke! ${evArray} - Error: ${err instanceof Error ? err.message : String(err)}`);
    }
}
