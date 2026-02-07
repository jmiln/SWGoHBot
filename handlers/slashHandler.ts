import { readdirSync } from "node:fs";
import { join } from "node:path";
import type slashCommand from "../base/slashCommand.ts";
import logger from "../modules/Logger.ts";
import type { BotClient } from "../types/types.ts";

const slashDir = join(import.meta.dirname, "..", "slash");

/**
 * Gets all command files from the slash directory
 */
function getCommandFiles(): string[] {
    return readdirSync(slashDir).filter((file) => file.endsWith(".js") || file.endsWith(".ts"));
}

/**
 * Loads a single slash command
 */
async function loadCommandFile(commandName: string, cacheBust = false): Promise<slashCommand | null> {
    const path = cacheBust ? `${slashDir}/${commandName}.ts?t=${Date.now()}` : `${slashDir}/${commandName}.ts`;
    const { default: command } = await import(path);
    const cmd = new command();

    if (!cmd.commandData.enabled) {
        logger.error(`Command ${commandName} is not enabled`);
        return null;
    }

    return cmd;
}

/**
 * Unloads a single slash command from the client
 */
export function unloadSlash(client: BotClient, commandName: string): boolean {
    if (client.slashcmds.has(commandName)) {
        client.slashcmds.delete(commandName);
        return true;
    }
    return false;
}

/**
 * Loads a single slash command into the client
 */
export async function loadSlash(client: BotClient, commandName: string): Promise<boolean> {
    try {
        const cmd = await loadCommandFile(commandName, true);
        if (!cmd) {
            return false;
        }
        client.slashcmds.set(cmd.commandData.name, cmd);
        return true;
    } catch (err) {
        logger.error(`Unable to load command ${commandName}: ${err}`);
        logger.error(err);
        return false;
    }
}

/**
 * Reloads a single slash command (unload + load)
 */
export async function reloadSlash(client: BotClient, commandName: string): Promise<string> {
    const unloaded = unloadSlash(client, commandName);
    if (!unloaded) {
        throw new Error(`Failed to unload command: ${commandName}`);
    }

    const loaded = await loadSlash(client, commandName);
    if (!loaded) {
        throw new Error(`Failed to load command: ${commandName}`);
    }

    return commandName;
}

/**
 * Reloads all slash commands (even if they were not loaded before)
 * Will not remove a command if it's been loaded, but will load new commands if added
 */
export async function reloadAllSlashCommands(client: BotClient): Promise<{ succArr: string[]; errArr: string[] }> {
    // Unload all existing commands
    for (const commandName of [...client.slashcmds.keys()]) {
        unloadSlash(client, commandName);
    }

    const cmdFiles = getCommandFiles();
    const succArr: string[] = [];
    const errArr: string[] = [];

    for (const file of cmdFiles) {
        const commandName = file.split(".")[0];
        try {
            const loaded = await loadSlash(client, commandName);
            if (loaded) {
                succArr.push(commandName);
            } else {
                errArr.push(file);
            }
        } catch (e) {
            logger.error(`Failed to reload command ${commandName}: ${e}`);
            errArr.push(file);
        }
    }

    return {
        succArr,
        errArr,
    };
}

/**
 * Initialize slash command handler - loads all commands on startup
 */
export default async (client: BotClient) => {
    const slashFiles = getCommandFiles();
    const slashError: string[] = [];

    for (const file of slashFiles) {
        const commandName = file.split(".")[0];
        try {
            const cmd = await loadCommandFile(commandName);
            if (cmd) {
                client.slashcmds.set(cmd.commandData.name, cmd);
            }
        } catch (err) {
            slashError.push(`Unable to load command ${commandName}: ${err}`);
            logger.error(err);
        }
    }

    if (slashError.length) {
        logger.error(`slashLoad: ${slashError.join("\n")}`);
    }
};
