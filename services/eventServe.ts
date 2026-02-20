import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { MongoClient } from "mongodb";
import { env } from "../config/config.ts";
import cache from "../modules/cache.ts";
import {
    addGuildEvent,
    deleteGuildEvent,
    getCountdownEvents,
    getGuildEvents,
    getTriggeredEvents,
    guildEventExists,
} from "../modules/guildConfig/events.ts";
import { getGuildSettings } from "../modules/guildConfig/settings.ts";
import logger from "../modules/Logger.ts";
import type { GuildConfigEvent } from "../types/guildConfig_types.ts";

let mongo: MongoClient | null = null;
let isShuttingDown = false;

const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    if (req.method !== "POST") {
        res.writeHead(405, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Method not allowed" }));
        return;
    }

    let body: unknown;
    try {
        body = await readBody(req);
    } catch {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Invalid JSON" }));
        return;
    }

    const respond = (data: unknown) => {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(data));
    };

    try {
        switch (req.url) {
            case "/checkEvents": {
                respond(await processEvents());
                break;
            }
            case "/addEvents": {
                const { guildId, events } = body as { guildId: string; events: GuildConfigEvent | GuildConfigEvent[] };
                respond(await addEvents(guildId, events));
                break;
            }
            case "/delEvent": {
                const { guildId, eventName } = body as { guildId: string; eventName: string };
                respond(await removeEvent(guildId, eventName));
                break;
            }
            case "/getEventByName": {
                const { guildId, evName } = body as { guildId: string; evName: string };
                const events = await getGuildEvents({ guildId });
                respond(events.find((ev) => ev.name === evName) ?? null);
                break;
            }
            case "/getEventsByFilter": {
                const { guildId, filterArr } = body as { guildId: string; filterArr: string[] };
                respond(await getEventsByFilter(guildId, filterArr));
                break;
            }
            case "/getEventsByGuild": {
                const { guildId } = body as { guildId: string };
                respond(await getGuildEvents({ guildId }));
                break;
            }
            default: {
                res.writeHead(404, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ error: "Not found" }));
            }
        }
    } catch (error) {
        logger.error(`EventMgr: Handler error for ${req.url}: ${error instanceof Error ? error.message : String(error)}`);
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Internal server error" }));
    }
});

async function readBody(req: IncomingMessage): Promise<unknown> {
    return new Promise((resolve, reject) => {
        let data = "";
        req.on("data", (chunk) => {
            data += chunk;
        });
        req.on("end", () => {
            try {
                resolve(data ? JSON.parse(data) : {});
            } catch {
                reject(new Error("Invalid JSON"));
            }
        });
        req.on("error", reject);
    });
}

async function init() {
    try {
        mongo = await MongoClient.connect(env.MONGODB_URL);
        cache.init(mongo);

        server.listen(env.EVENT_SERVER_PORT, () => {
            logger.log(`EventMgr: Service started on port ${env.EVENT_SERVER_PORT}`);
        });
    } catch (error) {
        logger.error(`EventMgr: Failed to initialize - ${error instanceof Error ? error.message : String(error)}`);
        process.exit(1);
    }
}

async function gracefulShutdown(signal: string): Promise<void> {
    if (isShuttingDown) return;
    isShuttingDown = true;

    logger.log(`EventMgr: Received ${signal}, starting graceful shutdown`);

    try {
        await new Promise<void>((resolve, reject) => {
            server.close((err) => {
                if (err) {
                    reject(err);
                } else {
                    logger.log("EventMgr: HTTP server closed");
                    resolve();
                }
            });
        });

        if (mongo) {
            await mongo.close();
            logger.log("EventMgr: MongoDB connection closed");
        }

        logger.log("EventMgr: Graceful shutdown complete");
        process.exit(0);
    } catch (error) {
        logger.error(`EventMgr: Error during shutdown - ${error instanceof Error ? error.message : String(error)}`);
        process.exit(1);
    }
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

process.on("uncaughtException", (error) => {
    logger.error(`EventMgr: Uncaught exception - ${error instanceof Error ? error.message : String(error)}`);
    logger.error(String(error.stack));
});

process.on("unhandledRejection", (reason, promise) => {
    logger.error(`EventMgr: Unhandled rejection at ${promise}`);
    logger.error(`Reason: ${reason}`);
});

async function processEvents() {
    const nowTime = Date.now();

    const triggeredEvents = await getTriggeredEvents({ nowTime });
    const eventsOut = [...triggeredEvents];

    const countdownEvents = await getCountdownEvents({ nowTime });

    for (const ev of countdownEvents) {
        const guildConf = await getGuildSettings({ guildId: ev.guildId });

        if (!guildConf?.eventCountdown?.length) continue;

        const timesToCountdown = new Set(guildConf.eventCountdown);
        const timeTil = ev.eventDT - nowTime;
        const { minute } = convertMS(timeTil);
        const cdMin = timesToCountdown.has(minute);

        if (cdMin) {
            ev.isCD = true;
            ev.name = `${ev.name}-CD${cdMin}`;
            eventsOut.push(ev);
        }
    }
    return eventsOut;
}

async function addEvents(guildId: string, events: GuildConfigEvent | GuildConfigEvent[]) {
    const eventArr = Array.isArray(events) ? events : [events];
    const results = [];

    for (const event of eventArr) {
        const evRes = { event, success: true, error: null };
        const exists = await guildEventExists({ guildId, evName: event.name });
        if (exists) {
            evRes.success = false;
            evRes.error = `Event "${event.name}" already exists`;
            results.push(evRes);
            continue;
        }

        try {
            await addGuildEvent({ guildId, newEvent: event });
            results.push(evRes);
        } catch (error) {
            evRes.success = false;
            evRes.error = error instanceof Error ? error.message : String(error);
            results.push(evRes);
        }
    }
    return results;
}

async function removeEvent(guildId: string, eventName: string) {
    const res = { eventName, success: true, error: null };
    const exists = await guildEventExists({ guildId, evName: eventName });

    if (!exists) {
        res.success = false;
        res.error = "Invalid event. Does not exist";
        return res;
    }

    try {
        await deleteGuildEvent({ guildId, evName: eventName });
    } catch (error) {
        res.success = false;
        res.error = error instanceof Error ? error.message : String(error);
    }
    return res;
}

async function getEventsByFilter(guildId: string, filter: string | string[]) {
    const filterArr = Array.isArray(filter) ? filter : [filter];
    const events = await getGuildEvents({ guildId });
    return events.filter((ev) => filterArr.every((e) => `${ev.message} ${ev.name}`.includes(e)));
}

function convertMS(milliseconds: number) {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const totalMin = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const hour = Math.floor(totalMin / 60);
    const minute = totalMin % 60;
    return { hour, minute, totalMin, seconds };
}

init();
