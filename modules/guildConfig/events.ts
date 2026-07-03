import type { GuildConfig, GuildConfigEvent, GuildConfigEventWithGuild } from "../../types/guildConfig_types.ts";
import logger from "../Logger.ts";
import { guildConfigDB } from "./db.ts";

export async function setEvents({ guildId, evArrOut }: { guildId: string; evArrOut: GuildConfigEvent[] }) {
    if (!Array.isArray(evArrOut)) throw new Error("[/eventFuncs setEvents] Somehow have a non-array stOut");
    return await guildConfigDB.put({ guildId: guildId }, { events: evArrOut }, false);
}
export async function updateGuildEvent({ guildId, evName, event }: { guildId: string; evName: string; event: GuildConfigEvent }) {
    const evList: GuildConfig | null = await guildConfigDB.getOne({ guildId }, { events: 1, _id: 0 });
    if (!evList) return null; // No config doc for this guild, so there is no event to update
    const evIx = evList.events.findIndex((ev) => ev.name === evName);

    if (evIx < 0) return null; // Just to be doubly sure that it exists
    evList.events[evIx] = event;

    // Set the new event in the db
    const out = await guildConfigDB
        .put({ guildId }, { events: evList.events }, false)
        .then(() => {
            return { success: true, error: null };
        })
        .catch((error: Error) => {
            logger.error(`[guildConfig/events/updateGuildEvent] Error: ${error.message}`);
            return { success: false, error: error };
        });
    return out;
}

export async function getGuildEvents({ guildId }: { guildId: string }): Promise<GuildConfigEvent[]> {
    if (!guildId) return [] as GuildConfigEvent[];
    const res = await guildConfigDB.getOne({ guildId: guildId }, { events: 1 });
    return (res?.events || []) as GuildConfigEvent[];
}
export async function addGuildEvent({ guildId, newEvent }: { guildId: string; newEvent: GuildConfigEvent }) {
    const events = await getGuildEvents({ guildId });
    events.push(newEvent);
    return await guildConfigDB.put({ guildId: guildId }, { events }, false);
}
export async function guildEventExists({ guildId, evName }: { guildId: string; evName: string }) {
    const resArr: GuildConfigEvent[] = await getGuildEvents({ guildId });
    const resIx = resArr?.findIndex((ev) => ev.name === evName);
    return resIx > -1;
}
export async function deleteGuildEvent({ guildId, evName }: { guildId: string; evName: string }) {
    const res: GuildConfigEvent[] = await getGuildEvents({ guildId });

    // Filter out the specific one that we want gone, then re-save em
    const evArrOut = res.filter((ev) => ev.name !== evName);
    return await guildConfigDB.put({ guildId: guildId }, { events: evArrOut }, false);
}
export async function getAllEvents(): Promise<GuildConfigEventWithGuild[]> {
    const resArr = (await guildConfigDB.get({}, { guildId: 1, events: 1, _id: 0 })) as {
        guildId: string;
        events: GuildConfigEvent[];
    }[];
    return resArr.reduce((acc, curr) => {
        if (!curr?.events?.length) return acc;
        return acc.concat(
            curr.events.map((ev) => {
                ev.guildId = curr.guildId;
                // guildId was just stamped above, so this is now a guaranteed-guild event
                return ev as GuildConfigEventWithGuild;
            }),
        );
    }, [] as GuildConfigEventWithGuild[]);
}

/**
 * Get events that should be triggered (eventDT <= current time)
 * Uses database-level filtering for better performance
 */
export async function getTriggeredEvents({ nowTime }: { nowTime: number }): Promise<GuildConfigEventWithGuild[]> {
    const resArr = (await guildConfigDB.get(
        {
            "events.eventDT": { $lte: nowTime },
        },
        { guildId: 1, events: 1, _id: 0 },
    )) as { guildId: string; events: GuildConfigEvent[] }[];

    return resArr.reduce((acc, curr) => {
        if (!curr?.events?.length) return acc;
        const triggeredEvents = curr.events
            .filter((ev) => ev.eventDT <= nowTime)
            .map((ev) => {
                ev.guildId = curr.guildId;
                // guildId was just stamped above, so this is now a guaranteed-guild event
                return ev as GuildConfigEventWithGuild;
            });
        return acc.concat(triggeredEvents);
    }, [] as GuildConfigEventWithGuild[]);
}

/**
 * Get events that have countdown enabled and are in the future
 * Uses database-level filtering for better performance
 */
export async function getCountdownEvents({ nowTime }: { nowTime: number }): Promise<GuildConfigEventWithGuild[]> {
    const resArr = (await guildConfigDB.get(
        {
            "events.countdown": true,
            "events.eventDT": { $gt: nowTime },
        },
        { guildId: 1, events: 1, _id: 0 },
    )) as { guildId: string; events: GuildConfigEvent[] }[];

    return resArr.reduce((acc, curr) => {
        if (!curr?.events?.length) return acc;
        const countdownEvents = curr.events
            .filter((ev) => ev.countdown && ev.eventDT > nowTime)
            .map((ev) => {
                ev.guildId = curr.guildId;
                // guildId was just stamped above, so this is now a guaranteed-guild event
                return ev as GuildConfigEventWithGuild;
            });
        return acc.concat(countdownEvents);
    }, [] as GuildConfigEventWithGuild[]);
}
