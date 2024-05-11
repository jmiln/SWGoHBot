const { REST, Routes } = require("discord.js");
const { readdirSync } = require("node:fs");
const slashDir = `${__dirname}/../slash/`;

module.exports = (Bot, client) => {
    const slashFiles = readdirSync(slashDir);
    const slashError = [];
    for (const file of slashFiles) {
        try {
            if (!file.endsWith(".js")) return;
            const commandName = file.split(".")[0];
            try {
                const cmd = new (require(`${slashDir}${commandName}`))(Bot);
                if (!cmd.commandData.enabled) {
                    return console.error(`${commandName} is not enabled`);
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
            const command = client.slashcmds.get(commandName);
            client.slashcmds.delete(command);
            delete require.cache[require.resolve(`${slashDir}${command.commandData.name}.js`)];
        }
        return;
    };
    client.loadSlash = (commandName) => {
        try {
            const cmd = new (require(`${slashDir}${commandName}`))(Bot);
            if (!cmd.commandData.enabled) {
                return `${commandName} is not enabled`;
            }
            client.slashcmds.set(cmd.commandData.name, cmd);
            return false;
        } catch (err) {
            console.log(err);
            return `Unable to load command ${commandName}: ${err}`;
        }
    };
    client.reloadSlash = async (commandName) => {
        let response = client.unloadSlash(commandName);
        if (response) {
            return new Error(`Error Unloading: ${response}`);
        }
        response = client.loadSlash(commandName);
        if (response) {
            return new Error(`Error Loading: ${response}`);
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

    Bot.deployCommands = async () => {
        const existingCommands = await fetchCommands();
        const updateRequired = [];

        for (const cmd of Array.from(client.slashcmds.values())) {
            const commandData = cmd.commandData;
            const existingCmd = existingCommands.find((cmd) => cmd.name === commandData?.name);
            if (!existingCmd) {
                updateRequired.push({ command: commandData, reason: `New command${commandData?.guildOnly ? " (guild only)" : ""}` });
            } else {
                const areOptionsEqual = compareOptions(commandData.options || [], existingCmd.options || []);
                if (!areOptionsEqual) {
                    updateRequired.push({
                        command: commandData,
                        reason: `Update required${commandData?.guildOnly ? " (guild only)" : ""}`,
                    });
                }
            }
        }

        if (updateRequired?.length) {
            console.log(
                `Updates required for the following commands: \n - ${updateRequired
                    .map((r) => `${r.command.name} - ${r.reason}`)
                    .join("\n - ")}`,
            );

            // If any of em need to be updated, send it all
            await sendCommandData(client.slashcmds.map((r) => r.commandData));
        }
    };
    function compareOptions(localOptions, existingOptions) {
        if (localOptions.length !== existingOptions.length) return false;
        return localOptions.every((localOption, index) => {
            const existingOption = existingOptions[index];
            if (!existingOption || existingOption.name !== localOption.name || existingOption.type !== localOption.type) {
                return false;
            }
            if (localOption.options) {
                // Handle subcommands or groups
                return compareOptions(localOption.options, existingOption.options || []);
            }
            if (localOption.choices) {
                // Handle choices
                if (!existingOption.choices || localOption.choices.length !== existingOption.choices.length) return false;
                return localOption.choices.every((choice, choiceIndex) => {
                    const existingChoice = existingOption.choices[choiceIndex];
                    return existingChoice && choice.name === existingChoice.name && choice.value === existingChoice.value;
                });
            }
            return true;
        });
    }

    // Fetch and compare commands as previously described
    async function fetchCommands() {
        const rest = new REST().setToken(Bot.config.token);
        const cmdOut = [];
        try {
            if (Bot.config.dev_server) {
                const guildCmds = await rest.get(Routes.applicationGuildCommands(Bot.config.clientId, Bot.config.dev_server));
                for (const cmd of guildCmds) {
                    cmdOut.push(cmd);
                }
            }
            const globalCmds = await rest.get(Routes.applicationCommands(Bot.config.clientId));
            for (const cmd of globalCmds) {
                cmdOut.push(cmd);
            }
        } catch (error) {
            console.error("Failed to fetch commands:", error);
        }
        return cmdOut;
    }

    async function sendCommandData(commands) {
        const rest = new REST().setToken(Bot.config.token);

        try {
            const globalCommands = commands.filter((cmd) => !cmd.guildOnly);
            const guildCommands = commands.filter((cmd) => cmd.guildOnly && Bot.config?.dev_server);

            // Deploy global commands
            if (Bot.config.enableGlobalCmds && globalCommands.length) {
                const response = await rest.put(Routes.applicationCommands(Bot.config.clientId), { body: globalCommands });
                console.log(`Successfully reloaded ${response.length} global (/) commands.`);
            }

            // Deploy guild commands if there's a dev_server set
            if (Bot.config?.dev_server && guildCommands.length) {
                const response = await rest.put(Routes.applicationGuildCommands(Bot.config.clientId, Bot.config?.dev_server), {
                    body: guildCommands,
                });
                console.log(`Successfully reloaded ${response.length} guild (/) commands.`);
            }
        } catch (error) {
            console.error("Failed to refresh application commands:", error);
        }
    }
};
