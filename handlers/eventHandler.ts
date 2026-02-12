import { readdirSync } from "node:fs";
import type { Client } from "discord.js";
import logger from "../modules/Logger.ts";

const needsClient = ["error", "clientReady", "messageCreate", "guildMemberAdd", "guildMemberRemove"];
const evDir = `${import.meta.dirname}/../events/`;

/**
 * Loads an event file and binds it to the client
 */
async function loadEvent(client: Client<true>, file: string, cacheBust = false): Promise<string> {
    const path = cacheBust ? `${evDir}${file}?t=${Date.now()}` : `${evDir}${file}`;
    const { default: event } = await import(path);
    const eventName = event.name;

    if (needsClient.includes(eventName)) {
        client.on(eventName, event.execute.bind(null, client));
    } else {
        client.on(eventName, event.execute);
    }

    return eventName;
}

/**
 * Gets all event files from the events directory
 */
function getEventFiles(): string[] {
    return readdirSync(evDir).filter((file) => file.endsWith(".js") || file.endsWith(".ts"));
}

/**
 * Reloads all event listeners
 */
export async function reloadAllEvents(client: Client<true>): Promise<{ succArr: string[]; errArr: string[] }> {
    const succArr: string[] = [];
    const errArr: string[] = [];

    // Remove all existing event listeners
    client.removeAllListeners();

    const evtFiles = getEventFiles();
    for (const file of evtFiles) {
        try {
            const eventName = await loadEvent(client, file, true);
            succArr.push(eventName);
        } catch (e) {
            logger.error(`Failed to reload event ${file}: ${e}`);
            errArr.push(file);
        }
    }

    return {
        succArr,
        errArr,
    };
}

/**
 * Initialize event handler - loads all events on startup
 */
export default async (client: Client<true>) => {
    const evtFiles = getEventFiles();
    const loadErrors: string[] = [];

    for (const file of evtFiles) {
        try {
            await loadEvent(client, file);
        } catch (e) {
            const errorMsg = `Failed to load event ${file}: ${e instanceof Error ? e.message : String(e)}`;
            loadErrors.push(errorMsg);
        }
    }

    if (loadErrors.length) {
        logger.error(`eventLoad: ${loadErrors.join("\n")}`);
    }
};
