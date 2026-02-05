import { readdirSync } from "node:fs";
import { join } from "node:path";
import type slashCommand from "../base/slashCommand.ts";
import logger from "../modules/Logger.ts";
import type { BotClient, BotType } from "../types/types.ts";

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
async function loadCommandFile(Bot: BotType, commandName: string, cacheBust = false): Promise<slashCommand | null> {
    const path = cacheBust ? `${slashDir}/${commandName}.ts?t=${Date.now()}` : `${slashDir}/${commandName}.ts`;
    const { default: command } = await import(path);
    const cmd = new command(Bot);

    if (!cmd.commandData.enabled) {
        logger.error(`Command ${commandName} is not enabled`);
        return null;
    }

    return cmd;
}

export default async (Bot: BotType, client: BotClient) => {
    const slashFiles = getCommandFiles();
    const slashError: string[] = [];

    for (const file of slashFiles) {
        const commandName = file.split(".")[0];
        try {
            const cmd = await loadCommandFile(Bot, commandName);
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

    client.unloadSlash = (commandName) => {
        if (client.slashcmds.has(commandName)) {
            client.slashcmds.delete(commandName);
            return true;
        }
        return false;
    };

    client.loadSlash = async (commandName) => {
        try {
            const cmd = await loadCommandFile(Bot, commandName, true);
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
    };

    client.reloadSlash = async (commandName) => {
        const unloaded = client.unloadSlash(commandName);
        if (!unloaded) {
            throw new Error(`Failed to unload command: ${commandName}`);
        }

        const loaded = await client.loadSlash(commandName);
        if (!loaded) {
            throw new Error(`Failed to load command: ${commandName}`);
        }

        return commandName;
    };

    /**
     * Reloads all slash commands (even if they were not loaded before)
     * Will not remove a command if it's been loaded, but will load new commands if added
     */
    client.reloadAllSlashCommands = async () => {
        // Unload all existing commands
        for (const commandName of [...client.slashcmds.keys()]) {
            client.unloadSlash(commandName);
        }

        const cmdFiles = getCommandFiles();
        const succArr: string[] = [];
        const errArr: string[] = [];

        for (const file of cmdFiles) {
            const commandName = file.split(".")[0];
            try {
                const loaded = await client.loadSlash(commandName);
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
    };
};
