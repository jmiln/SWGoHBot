import config from "../../config.js";
import type { BotCache } from "../../types/cache_types.ts";
import type { GuildConfig, GuildConfigEvent } from "../../types/guildConfig_types.ts";

export async function setEvents({ cache, guildId, evArrOut }: { cache: BotCache; guildId: string; evArrOut: GuildConfigEvent[] }) {
    if (!Array.isArray(evArrOut)) throw new Error("[/eventFuncs setEvents] Somehow have a non-array stOut");
    return await cache.put(config.mongodb.swgohbotdb, "guildConfigs", { guildId: guildId }, { events: evArrOut }, false);
}
export async function updateGuildEvent({ cache, guildId, evName, event }) {
    const evList: GuildConfig = await cache.getOne(config.mongodb.swgohbotdb, "guildConfigs", { guildId }, { events: 1, _id: 0 });
    const evIx = evList.events.findIndex((ev) => ev.name === evName);

    if (evIx < 0) return null; // Just to be doubly sure that it exists
    evList.events[evIx] = event;

    // Set the new event in the db
    const out = await cache
        .put(config.mongodb.swgohbotdb, "guildConfigs", { guildId }, { events: evList.events }, false)
        .then(() => {
            return { success: true, error: null };
        })
        .catch((error: string) => {
            // Bot.logger.error(`(Ev updateEvent)Broke trying to create new event \ninteraction: ${interaction.content}\nError: ${error}`);
            return { success: false, error: error };
        });
    return out;
}

export async function getGuildEvents({ cache, guildId }: { cache: BotCache; guildId: string }): Promise<GuildConfigEvent[]> {
    if (!guildId) return [] as GuildConfigEvent[];
    const resArr = await cache.get(config.mongodb.swgohbotdb, "guildConfigs", { guildId: guildId }, { events: 1 });
    return resArr[0]?.events || ([] as GuildConfigEvent[]);
}
export async function addGuildEvent({ cache, guildId, newEvent }: { cache: BotCache; guildId: string; newEvent: GuildConfigEvent }) {
    const events = await getGuildEvents({ cache, guildId });
    events.push(newEvent);
    return await cache.put(config.mongodb.swgohbotdb, "guildConfigs", { guildId: guildId }, { events }, false);
}
export async function guildEventExists({ cache, guildId, evName }: { cache: BotCache; guildId: string; evName: string }) {
    const resArr: GuildConfigEvent[] = await getGuildEvents({ cache, guildId });
    const resIx = resArr?.findIndex((ev) => ev.name === evName);
    return resIx > -1;
}
export async function deleteGuildEvent({ cache, guildId, evName }: { cache: BotCache; guildId: string; evName: string }) {
    const res: GuildConfigEvent[] = await getGuildEvents({ cache, guildId });

    // Filter out the specific one that we want gone, then re-save em
    const evArrOut = res.filter((ev) => ev.name !== evName);
    return await cache.put(config.mongodb.swgohbotdb, "guildConfigs", { guildId: guildId }, { events: evArrOut }, false);
}
export async function getAllEvents({ cache }: { cache: BotCache }): Promise<GuildConfigEvent[]> {
    const resArr = (await cache.get(
        config.mongodb.swgohbotdb,
        "guildConfigs",
        {},
        { guildId: 1, events: 1, _id: 0 },
    )) as { guildId: string; events: GuildConfigEvent[] }[];
    return resArr.reduce((acc, curr) => {
        if (!curr?.events?.length) return acc;
        return acc.concat(
            curr.events.map((ev) => {
                ev.guildId = curr.guildId;
                return ev;
            }),
        );
    }, [] as GuildConfigEvent[]);
}

/**
 * Get events that should be triggered (eventDT <= current time)
 * Uses database-level filtering for better performance
 */
export async function getTriggeredEvents({ cache, nowTime }: { cache: BotCache; nowTime: number }): Promise<GuildConfigEvent[]> {
    const resArr = (await cache.get(
        config.mongodb.swgohbotdb,
        "guildConfigs",
        {
            "events.eventDT": { $lte: nowTime },
        },
        { guildId: 1, events: 1, _id: 0 },
    )) as { guildId: string; events: GuildConfigEvent[] }[];

    return resArr.reduce((acc, curr) => {
        if (!curr?.events?.length) return acc;
        const triggeredEvents = curr.events
            .filter((ev) => Number.parseInt(ev.eventDT.toString(), 10) <= nowTime)
            .map((ev) => {
                ev.guildId = curr.guildId;
                return ev;
            });
        return acc.concat(triggeredEvents);
    }, [] as GuildConfigEvent[]);
}

/**
 * Get events that have countdown enabled and are in the future
 * Uses database-level filtering for better performance
 */
export async function getCountdownEvents({
    cache,
    nowTime,
}: {
    cache: BotCache;
    nowTime: number;
}): Promise<GuildConfigEvent[]> {
    const resArr = (await cache.get(
        config.mongodb.swgohbotdb,
        "guildConfigs",
        {
            "events.countdown": true,
            "events.eventDT": { $gt: nowTime },
        },
        { guildId: 1, events: 1, _id: 0 },
    )) as { guildId: string; events: GuildConfigEvent[] }[];

    return resArr.reduce((acc, curr) => {
        if (!curr?.events?.length) return acc;
        const countdownEvents = curr.events
            .filter((ev) => ev.countdown && Number.parseInt(ev.eventDT.toString(), 10) > nowTime)
            .map((ev) => {
                ev.guildId = curr.guildId;
                return ev;
            });
        return acc.concat(countdownEvents);
    }, [] as GuildConfigEvent[]);
}
