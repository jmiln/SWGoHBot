import { readdirSync } from "node:fs";
import { type APIApplicationCommand, type APIApplicationCommandOption, REST, Routes } from "discord.js";
import type slashCommand from "../base/slashCommand.ts";
import type { BotClient, BotType } from "../types/types.ts";

const slashDir = `${import.meta.dirname}/../slash/`;

export default async (Bot: BotType, client: BotClient) => {
    const slashFiles = readdirSync(slashDir);
    const slashError = [];
    for (const file of slashFiles) {
        try {
            if (!file.endsWith(".js") && !file.endsWith(".ts")) return;
            const [commandName, ext, ..._] = file.split(".");
            try {
                const path = `${slashDir}${commandName}.${ext}`;
                const { default: command } = await import(path);
                const cmd = new command(Bot);
                if (!cmd.commandData.enabled) {
                    console.error(`${commandName} is not enabled`);
                    continue;
                }
                client.slashcmds.set(cmd.commandData.name, cmd);
            } catch (err) {
                slashError.push(`Unable to load command ${commandName}: ${err}`);
                console.log(err);
            }
        } catch (err) {
            return console.error(err);
        }
    }
    if (slashError.length) {
        console.error(`slashLoad: ${slashError.join("\n")}`);
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
            const path = `${slashDir}${commandName}.js?t=${Date.now()}`;
            const { default: command } = await import(path);
            const cmd = new command(Bot);
            if (!cmd.commandData.enabled) {
                return false;
            }
            client.slashcmds.set(cmd.commandData.name, cmd);
            return true;
        } catch (err) {
            console.error(`Unable to load command ${commandName}: ${err}`);
            console.error(err);
            return false;
        }
    };
    client.reloadSlash = async (commandName) => {
        let response = client.unloadSlash(commandName);
        if (!response) {
            throw new Error(`Error Unloading: ${commandName}`);
        }
        response = await client.loadSlash(commandName);
        if (!response) {
            throw new Error(`Error Loading: ${commandName}`);
        }
        return commandName;
    };

    // Reloads all slash commads (even if they were not loaded before)
    // Will not remove a command if it's been loaded,
    // but will load a new command if it's been added
    client.reloadAllSlashCommands = async () => {
        for (const c of [...client.slashcmds.keys()]) {
            client.unloadSlash(c);
        }
        const cmdFiles = await readdirSync(slashDir);
        const coms = [];
        const errArr = [];
        for (const f of cmdFiles) {
            try {
                const cmd = f.split(".")[0];
                if (f.split(".").slice(-1)[0] !== "js") {
                    errArr.push(f);
                } else {
                    const res = client.loadSlash(cmd);
                    if (!res) {
                        coms.push(cmd);
                    } else {
                        errArr.push(f);
                    }
                }
            } catch (e) {
                Bot.logger.error(`Error: ${e}`);
                errArr.push(f);
            }
        }
        return {
            succArr: coms,
            errArr: errArr,
        };
    };

    Bot.deployCommands = async (force = false) => {
        const existingCommands = await fetchCommands();
        const updateRequired = [];

        for (const cmd of Array.from(client.slashcmds.values())) {
            const commandData = cmd.commandData;
            const existingCmd = existingCommands.find((cmd) => cmd.name === commandData?.name);
            if (!existingCmd) {
                updateRequired.push({ command: commandData, reason: `New command${commandData?.guildOnly ? " (guild only)" : ""}` });
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

        if (updateRequired?.length) {
            const outStr = `Updates required for the following commands: \n - ${updateRequired
                .map((r) => `${r.command.name} - ${r.reason}`)
                .join("\n - ")}`;
            console.log(outStr);

            // If any of em need to be updated, send it all
            await sendCommandData(client.slashcmds.map((r) => r.commandData));
            return outStr;
        }
        return "No commands needed updating";
    };
    function compareOptions(localOptions: APIApplicationCommandOption[], existingOptions: APIApplicationCommandOption[]) {
        if (localOptions.length !== existingOptions.length) return false;
        return localOptions.every((localOption, index) => {
            const existingOption = existingOptions[index];
            if (!existingOption || existingOption.name !== localOption.name || existingOption.type !== localOption.type) {
                return false;
            }
            let localCmdOptions = [];
            let existingCmdOptions = [];
            if ("options" in localOption) {
                localCmdOptions = localOption.options;
            }
            if ("options" in existingOption) {
                existingCmdOptions = existingOption.options;
            }
            if (localCmdOptions.length !== existingCmdOptions.length) return false;
            if (localCmdOptions.length) {
                // Handle subcommands or groups
                return compareOptions(localCmdOptions, existingCmdOptions);
            }

            let localCmdChoices = [];
            let existingCmdChoices = [];
            if ("choices" in localOption) {
                localCmdChoices = localOption.choices;
            }
            if ("choices" in existingOption) {
                existingCmdChoices = existingOption.choices;
            }
            if (localCmdChoices.length !== existingCmdChoices.length) return false;
            if (localCmdChoices.length) {
                // Handle choices
                return localCmdChoices.every((choice) => {
                    const existingChoice = existingCmdChoices.find((ch) => ch.name === choice.name);
                    return existingChoice && choice.name === existingChoice.name && choice.value === existingChoice.value;
                });
            }
            return true;
        });
    }

    // Fetch and compare commands as previously described
    async function fetchCommands(): Promise<APIApplicationCommand[]> {
        const rest = new REST().setToken(Bot.config.token);
        const cmdOut = [];
        try {
            if (Bot.config.dev_server) {
                const guildCmds = (await rest.get(
                    Routes.applicationGuildCommands(Bot.config.clientId, Bot.config.dev_server),
                )) as APIApplicationCommand[];
                for (const cmd of guildCmds) {
                    cmdOut.push(cmd);
                }
            }
            const globalCmds = (await rest.get(Routes.applicationCommands(Bot.config.clientId))) as APIApplicationCommand[];
            for (const cmd of globalCmds) {
                cmdOut.push(cmd);
            }
        } catch (error) {
            console.error("Failed to fetch commands:", error);
        }
        return cmdOut;
    }

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
                console.log(`Successfully reloaded ${response.length} global (/) commands.`);
            }

            // Deploy guild commands if there's a dev_server set
            if (Bot.config?.dev_server && guildCommands.length) {
                const response = (await rest.put(Routes.applicationGuildCommands(Bot.config.clientId, Bot.config?.dev_server), {
                    body: guildCommands,
                })) as APIApplicationCommand[];
                console.log(`Successfully reloaded ${response.length} guild (/) commands.`);
            }
        } catch (error) {
            console.error("Failed to refresh application commands:", error);
        }
    }
};
