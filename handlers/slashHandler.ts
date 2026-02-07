import { Collection } from "discord.js";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import type slashCommand from "../base/slashCommand.ts";
import logger from "../modules/Logger.ts";

const slashDir = join(import.meta.dirname, "..", "slash");

// Module-level collection of loaded slash commands
const slashcmds = new Collection<string, slashCommand>();

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
 * Gets a command by name
 */
export function getCommand(commandName: string): slashCommand | undefined {
    return slashcmds.get(commandName);
}

/**
 * Gets all command names
 */
export function getCommandNames(): string[] {
    return [...slashcmds.keys()];
}

/**
 * Gets the full command collection (read-only access)
 */
export function getCommands(): ReadonlyMap<string, slashCommand> {
    return slashcmds;
}

/**
 * Unloads a single slash command
 */
export function unloadSlash(commandName: string): boolean {
    if (slashcmds.has(commandName)) {
        slashcmds.delete(commandName);
        return true;
    }
    return false;
}

/**
 * Loads a single slash command
 */
export async function loadSlash(commandName: string): Promise<boolean> {
    try {
        const cmd = await loadCommandFile(commandName, true);
        if (!cmd) {
            return false;
        }
        slashcmds.set(cmd.commandData.name, cmd);
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
export async function reloadSlash(commandName: string): Promise<string> {
    const unloaded = unloadSlash(commandName);
    if (!unloaded) {
        throw new Error(`Failed to unload command: ${commandName}`);
    }

    const loaded = await loadSlash(commandName);
    if (!loaded) {
        throw new Error(`Failed to load command: ${commandName}`);
    }

    return commandName;
}

/**
 * Reloads all slash commands (even if they were not loaded before)
 * Will not remove a command if it's been loaded, but will load new commands if added
 */
export async function reloadAllSlashCommands(): Promise<{ succArr: string[]; errArr: string[] }> {
    // Unload all existing commands
    for (const commandName of [...slashcmds.keys()]) {
        unloadSlash(commandName);
    }

    const cmdFiles = getCommandFiles();
    const succArr: string[] = [];
    const errArr: string[] = [];

    for (const file of cmdFiles) {
        const commandName = file.split(".")[0];
        try {
            const loaded = await loadSlash(commandName);
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
export default async () => {
    const slashFiles = getCommandFiles();
    const slashError: string[] = [];

    for (const file of slashFiles) {
        const commandName = file.split(".")[0];
        try {
            const cmd = await loadCommandFile(commandName);
            if (cmd) {
                slashcmds.set(cmd.commandData.name, cmd);
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
