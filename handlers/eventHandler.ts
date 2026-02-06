import { readdirSync } from "node:fs";
import logger from "../modules/Logger.ts";
import type { BotClient } from "../types/types.ts";

const needsClient = ["error", "clientReady", "interactionCreate", "messageCreate", "guildMemberAdd", "guildMemberRemove"];
const evDir = `${import.meta.dirname}/../events/`;

/**
 * Loads an event file and binds it to the client
 */
async function loadEvent(client: BotClient, file: string, cacheBust = false): Promise<string> {
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

export default async (client: BotClient) => {
    const evtFiles = getEventFiles();

    for (const file of evtFiles) {
        try {
            await loadEvent(client, file);
        } catch (e) {
            logger.error(`Failed to load event ${file}: ${e}`);
        }
    }

    // Reload the events files (message, guildCreate, etc)
    client.reloadAllEvents = async () => {
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
    };
};
