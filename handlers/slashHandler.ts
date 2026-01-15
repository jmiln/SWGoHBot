import { readdirSync } from "node:fs";
import { type APIApplicationCommand, type APIApplicationCommandOption, REST, Routes } from "discord.js";
import logger from "../modules/Logger.ts";
import type slashCommand from "../base/slashCommand.ts";
import type { BotClient, BotType } from "../types/types.ts";

const slashDir = `${import.meta.dirname}/../slash/`;

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
    const path = cacheBust ? `${slashDir}${commandName}.ts?t=${Date.now()}` : `${slashDir}${commandName}.ts`;
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

    /**
     * Compares command options to determine if updates are needed
     */
    function compareOptions(localOptions: APIApplicationCommandOption[], existingOptions: APIApplicationCommandOption[]): boolean {
        if (localOptions.length !== existingOptions.length) {
            return false;
        }

        return localOptions.every((localOption, index) => {
            const existingOption = existingOptions[index];
            if (!existingOption || existingOption.name !== localOption.name || existingOption.type !== localOption.type) {
                return false;
            }

            // Compare nested options (subcommands/groups)
            const localCmdOptions = "options" in localOption ? (localOption.options ?? []) : [];
            const existingCmdOptions = "options" in existingOption ? (existingOption.options ?? []) : [];
            if (localCmdOptions.length !== existingCmdOptions.length) {
                return false;
            }
            if (localCmdOptions.length && !compareOptions(localCmdOptions, existingCmdOptions)) {
                return false;
            }

            // Compare choices
            const localCmdChoices = "choices" in localOption ? (localOption.choices ?? []) : [];
            const existingCmdChoices = "choices" in existingOption ? (existingOption.choices ?? []) : [];
            if (localCmdChoices.length !== existingCmdChoices.length) {
                return false;
            }
            if (localCmdChoices.length) {
                return localCmdChoices.every((choice) => {
                    const existingChoice = existingCmdChoices.find((ch) => ch.name === choice.name);
                    return existingChoice && choice.name === existingChoice.name && choice.value === existingChoice.value;
                });
            }

            return true;
        });
    }

    /**
     * Deploys commands to Discord API if updates are needed
     */
    Bot.deployCommands = async (force = false) => {
        const existingCommands = await fetchCommands();
        const updateRequired = [];

        for (const cmd of Array.from(client.slashcmds.values())) {
            const commandData = cmd.commandData;
            const existingCmd = existingCommands.find((cmd) => cmd.name === commandData?.name);

            if (!existingCmd) {
                updateRequired.push({
                    command: commandData,
                    reason: `New command${commandData?.guildOnly ? " (guild only)" : ""}`,
                });
            } else {
                const areOptionsEqual = compareOptions(commandData.options || [], existingCmd.options || []);
                if (!areOptionsEqual || force) {
                    updateRequired.push({
                        command: commandData,
                        reason: `Update required${commandData?.guildOnly ? " (guild only)" : ""}`,
                    });
                }
            }
        }

        if (updateRequired.length) {
            const outStr = `Updates required for the following commands:\n - ${updateRequired
                .map((r) => `${r.command.name} - ${r.reason}`)
                .join("\n - ")}`;
            logger.log(outStr);

            // If any need updates, send all commands
            await sendCommandData(client.slashcmds.map((r) => r.commandData));
            return outStr;
        }

        return "No commands needed updating";
    };

    /**
     * Fetches existing commands from Discord API
     */
    async function fetchCommands(): Promise<APIApplicationCommand[]> {
        const rest = new REST().setToken(Bot.config.token);
        const cmdOut: APIApplicationCommand[] = [];

        try {
            // Fetch guild commands if dev_server is configured
            if (Bot.config.dev_server) {
                const guildCmds = (await rest.get(
                    Routes.applicationGuildCommands(Bot.config.clientId, Bot.config.dev_server),
                )) as APIApplicationCommand[];
                cmdOut.push(...guildCmds);
            }

            // Fetch global commands
            const globalCmds = (await rest.get(Routes.applicationCommands(Bot.config.clientId))) as APIApplicationCommand[];
            cmdOut.push(...globalCmds);
        } catch (error) {
            logger.error("Failed to fetch commands:", error);
        }

        return cmdOut;
    }

    /**
     * Sends command data to Discord API
     */
    async function sendCommandData(commands: slashCommand["commandData"][]) {
        const rest = new REST().setToken(Bot.config.token);

        try {
            const globalCommands = commands.filter((cmd) => !cmd.guildOnly);
            const guildCommands = commands.filter((cmd) => cmd.guildOnly && Bot.config?.dev_server);

            // Deploy global commands
            if (Bot.config.enableGlobalCmds && globalCommands.length) {
                const response = (await rest.put(Routes.applicationCommands(Bot.config.clientId), {
                    body: globalCommands,
                })) as APIApplicationCommand[];
                logger.log(`Successfully reloaded ${response.length} global (/) commands.`);
            }

            // Deploy guild commands if there's a dev_server set
            if (Bot.config?.dev_server && guildCommands.length) {
                const response = (await rest.put(Routes.applicationGuildCommands(Bot.config.clientId, Bot.config?.dev_server), {
                    body: guildCommands,
                })) as APIApplicationCommand[];
                logger.log(`Successfully reloaded ${response.length} guild (/) commands.`);
            }
        } catch (error) {
            logger.error("Failed to refresh application commands:", error);
        }
    }
};
