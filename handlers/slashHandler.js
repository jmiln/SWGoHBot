const { ApplicationCommandOptionType } = require("discord.js");
const {readdirSync} = require("fs");
const { inspect } = require("node:util");
const slashDir = __dirname + "/../slash/";

// const DEBUG = true;
const DEBUG = false;

module.exports = (Bot, client) => {
    const slashFiles = readdirSync(slashDir);
    const slashError = [];
    slashFiles.forEach(file => {
        try {
            if (!file.endsWith(".js")) return;
            const commandName = file.split(".")[0];
            try {
                const cmd = new (require(`${slashDir}${commandName}`))(Bot);
                if (!cmd.commandData.enabled) {
                    return console.error(commandName + " is not enabled");
                }
                client.slashcmds.set(cmd.commandData.name, cmd);
                return false;
            } catch (err) {
                slashError.push(`Unable to load command ${commandName}: ${err}`);
                console.log(err);
            }
        } catch (err) {
            return console.error(err);
        }
    });
    if (slashError.length) {
        console.error("slashLoad: " + slashError.join("\n"));
    }


    client.unloadSlash = commandName => {
        if (client.slashcmds.has(commandName)) {
            const command = client.slashcmds.get(commandName);
            client.slashcmds.delete(command);
            delete require.cache[require.resolve(`${slashDir}${command.commandData.name}.js`)];
        }
        return;
    };
    client.loadSlash = commandName => {
        try {
            const cmd = new (require(`${slashDir}${commandName}`))(Bot);
            if (!cmd.commandData.enabled) {
                return commandName + " is not enabled";
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
        } else {
            response = client.loadSlash(commandName);
            if (response) {
                return new Error(`Error Loading: ${response}`);
            }
        }
        return commandName;
    };

    // Reloads all slash commads (even if they were not loaded before)
    // Will not remove a command if it's been loaded,
    // but will load a new command if it's been added
    client.reloadAllSlashCommands = async () => {
        [...client.slashcmds.keys()].forEach(c => {
            client.unloadSlash(c);
        });
        const cmdFiles = await readdirSync(slashDir);
        const coms = [], errArr = [];
        cmdFiles.forEach(async (f) => {
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
                Bot.logger.error("Error: " + e);
                errArr.push(f);
            }
        });
        return {
            succArr: coms,
            errArr: errArr
        };
    };


    // Deploy commands
    Bot.deployCommands = async (force=false) => {
        const outLog = [];

        if (force) {
            console.log("Running deploy with force.");
            try {
                // Force deploy the global slash commands
                const globalCmds = client.slashcmds.filter(c => !c.guildOnly);
                const globalCmdData = globalCmds?.map(c => c.commandData);
                await client.application?.commands.set(globalCmdData);
            } catch (err) {
                console.error("ERROR: " + err);
            }
        } else if (Bot.config.dev_server) {
            try {
                // Filter the slash commands to find guild only ones.
                const guildCmds = client.slashcmds.filter(c => c.guildOnly).map(c => c.commandData);

                // The currently deployed commands
                let currentGuildCommands = await client.shard.broadcastEval(async (client, {guildId}) => {
                    const targetGuild = await client.guilds.cache.get(guildId)?.commands.fetch();
                    if (targetGuild) {
                        return targetGuild;
                    }
                }, {context: {
                    guildId: Bot.config.dev_server
                }});
                if (currentGuildCommands?.length) currentGuildCommands = currentGuildCommands.filter(curr => !!curr)[0];
                const { newComs: newGuildComs, changedComs: changedGuildComs } = checkCmds(guildCmds, currentGuildCommands);

                // We'll use set but please keep in mind that `set` is overkill for a singular command.
                // Set the guild commands like this.

                if (newGuildComs?.length || changedGuildComs?.length) {
                    await client.shard.broadcastEval(async (client, {guildId, newGuildComs, changedGuildComs}) => {
                        const targetGuild = await client.guilds.cache.get(guildId);
                        if (targetGuild) {
                            for (const newGuildCom of newGuildComs) {
                                console.log(`Adding ${newGuildCom.name} to Guild commands`);
                                await targetGuild.commands.create(newGuildCom);
                            }
                            for (const diffGuildCom of changedGuildComs) {
                                console.log(`Updating ${diffGuildCom.com.name} in Guild commands`);
                                await targetGuild.commands.edit(diffGuildCom.id, diffGuildCom.com);
                            }
                        }
                    }, {context: {
                        guildId: Bot.config.dev_server,
                        newGuildComs: newGuildComs,
                        changedGuildComs: changedGuildComs
                    }});

                    // The new guild commands
                    outLog.push({
                        name: "**Added Guild**",
                        value: newGuildComs?.length ? newGuildComs.map(newCom => ` * ${newCom.name}`).join("\n") : "N/A"
                    });

                    // The edited guild commands
                    outLog.push({
                        name: "**Changed Guild**",
                        value: changedGuildComs?.length ? changedGuildComs.map(diffCom => ` * ${diffCom.com.name}`).join("\n") : "N/A"
                    });
                }


                if (Bot.config.enableGlobalCmds) {
                    // Then filter out global commands by inverting the filter
                    const globalCmds = client.slashcmds.filter(c => !c.guildOnly).map(c => c.commandData);
                    // Get the currently deployed global commands
                    const currentGlobalCommands = await client.application?.commands?.fetch();

                    const { newComs: newGlobalComs, changedComs: changedGlobalComs } = checkCmds(globalCmds, currentGlobalCommands);

                    // The new global commands
                    if (newGlobalComs.length) {
                        for (const newGlobalCom of newGlobalComs) {
                            console.log(`Adding ${newGlobalCom.name} to Global commands`);
                            await client.application?.commands.create(newGlobalCom);
                        }
                        outLog.push({
                            name: "**Added Global**",
                            value: newGlobalComs?.length ? newGlobalComs.map(newCom => ` * ${newCom.name}`).join("\n") : "N/A"
                        });
                    }

                    // The edited global commands
                    if (changedGlobalComs.length) {
                        for (const diffGlobalCom of changedGlobalComs) {
                            console.log(`Updating ${diffGlobalCom.com.name} in Global commands`);
                            await client.application?.commands.edit(diffGlobalCom.id, diffGlobalCom.com);
                        }
                        outLog.push({
                            name: "**Changed Global**",
                            value: changedGlobalComs?.length ? changedGlobalComs.map(diffCom => ` * ${diffCom.com.name}`).join("\n") : "N/A"
                        });
                    }
                }

                if (outLog?.length) {
                    console.log("Deployed Commands:");
                    console.log(outLog.map(log => `${log.name}:\n${log.value}`).join("\n\n"));
                }
                return outLog;
            } catch (err) {
                Bot.logger.error(inspect(err, {depth: 5}));
            }
        }
    };

    function checkCmds(newCmdList, oldCmdList) {
        const changedComs = [];
        const newComs = [];

        // Work through all the commands that are already deployed, and see which ones have changed
        newCmdList.forEach(cmd => {
            const thisCom = oldCmdList.find(c => c.name === cmd.name);
            let isDiff = false;

            // If there's no match, it definitely goes in
            if (!thisCom) {
                console.log("Need to add " + cmd.name);
                return newComs.push(cmd);
            } else {
                // Fill in various options info, just in case
                debugLog("\nChecking " + cmd.name);
                for (const ix in cmd.options) {
                    if (!cmd.options[ix])                           cmd.options[ix]                          = {};
                    if (!cmd.options[ix].required)                  cmd.options[ix].required                 = false;
                    if (!cmd.options[ix].autocomplete)              cmd.options[ix].autocomplete             = undefined;
                    if (!cmd.options[ix].choices)                   cmd.options[ix].choices                  = undefined;
                    if (!cmd.options[ix].nameLocalizations)         cmd.options[ix].nameLocalizations        = undefined;
                    if (!cmd.options[ix].nameLocalized)             cmd.options[ix].nameLocalized            = undefined;
                    if (!cmd.options[ix].descriptionLocalizations)  cmd.options[ix].descriptionLocalizations = undefined;
                    if (!cmd.options[ix].descriptionLocalized)      cmd.options[ix].descriptionLocalized     = undefined;
                    if (!cmd.options[ix].channelTypes)              cmd.options[ix].channelTypes             = undefined;
                    if (!cmd.options[ix].options?.length)           cmd.options[ix].options                  = undefined;

                    if (!cmd.options[ix].minValue  && !isNaN(cmd.options[ix].minValue))  cmd.options[ix].minValue  = undefined;
                    if (!cmd.options[ix].maxValue  && !isNaN(cmd.options[ix].maxValue))  cmd.options[ix].maxValue  = undefined;
                    if (!cmd.options[ix].minLength && !isNaN(cmd.options[ix].minLength)) cmd.options[ix].minLength = undefined;
                    if (!cmd.options[ix].maxLength && !isNaN(cmd.options[ix].maxLength)) cmd.options[ix].maxLength = undefined;

                    debugLog("> checking " + cmd.options[ix]?.name);
                    for (const opt of Object.keys(cmd.options[ix])) {
                        debugLog("  * Checking: " + opt);
                        if (opt === "choices") {
                            if (cmd.options[ix]?.choices?.length && thisCom.options[ix]?.choices?.length) {
                                // Make sure they both have some number of choices
                                if (cmd.options[ix]?.choices?.length !== thisCom.options[ix]?.choices?.length) {
                                    // One of em is different than the other, so definitely needs an update
                                    debugLog("ChoiceLen is different");
                                    isDiff = true;
                                } else {
                                    // If they have the same option count, make sure that the choices are the same inside
                                    cmd.options[ix].choices.forEach((c, jx) => {
                                        const thisChoice = thisCom.options[ix].choices[jx];
                                        if (c.name !== thisChoice.name || c.value !== thisChoice.value) {
                                            // They have a different choice here, needs updating
                                            debugLog("Diff choices");
                                            debugLog(c, thisChoice);
                                            isDiff = true;
                                            return;
                                        }
                                    });
                                }
                            } else {
                                // One or both have no choices
                                if (cmd.options[ix]?.choices?.length && thisCom.options[ix]?.choices?.length) {
                                    // At least one of em has an entry, so it needs updating
                                    debugLog("choiceLen2 is diff");
                                    isDiff = true;
                                } else {
                                    // Neither of em have any, so nothing to do here
                                    continue;
                                }
                            }
                            if (isDiff) {
                                debugLog(`   [NEW] - ${cmd.options[ix] ? inspect(cmd.options[ix]?.choices) : null}\n   [OLD] - ${thisCom.options[ix] ? inspect(thisCom.options[ix]?.choices) : null}`);
                                break;
                            }
                        } else {
                            const newOpt = cmd.options[ix];
                            const thisOpt = thisCom.options[ix];
                            if (!thisOpt) {
                                debugLog("Missing opt for: newOpt");
                                isDiff = true;
                                break;
                            }
                            if (!newOpt) {
                                debugLog("Missing opt for: newOpt");
                                isDiff = true;
                                break;
                            }
                            if ((newOpt.required !== thisOpt.required               && (newOpt.required || thisOpt.required)) ||
                                (newOpt.name !== thisOpt.name                       && (newOpt.name || thisOpt.name)) ||
                                (newOpt.autocomplete !== thisOpt.autocomplete       && (newOpt.autocomplete || thisOpt.autocomplete)) ||
                                (newOpt.description !== thisOpt.description         && (newOpt.description || thisOpt.description)) ||
                                (newOpt.minValue !== thisOpt.minValue               && (!isNaN(newOpt?.minValue) || !isNaN(thisOpt?.minValue))) ||
                                (newOpt.maxValue !== thisOpt.maxValue               && (!isNaN(newOpt?.maxValue) || !isNaN(thisOpt?.maxValue))) ||
                                (newOpt.minLength !== thisOpt.minLength             && (!isNaN(newOpt?.minLength) || !isNaN(thisOpt?.minLength))) ||
                                (newOpt.maxLength !== thisOpt.maxLength             && (!isNaN(newOpt?.maxLength) || !isNaN(thisOpt?.maxLength))) ||
                                (newOpt.choices?.length !== thisOpt.choices?.length && (newOpt.choices || thisOpt.choices)) ||
                                (newOpt.options?.length !== thisOpt.options?.length && (newOpt.options || thisOpt.options))
                            ) {
                                isDiff = true;
                                debugLog(`   [NEW] - ${newOpt ? inspect(newOpt) : null}\n   [OLD] - ${thisOpt ? inspect(thisOpt) : null}`);
                                break;
                            }

                            if (thisOpt?.type === ApplicationCommandOptionType.Subcommand) {
                                for (const optIx in thisOpt.options) {
                                    const thisSubOpt = thisOpt.options[optIx];
                                    const newSubOpt  = newOpt.options[optIx];

                                    if ((newSubOpt.required !== thisSubOpt.required               && (newSubOpt.required || thisSubOpt.required)) ||
                                        (newSubOpt.name !== thisSubOpt.name                       && (newSubOpt.name || thisSubOpt.name)) ||
                                        (newSubOpt.autocomplete !== thisSubOpt.autocomplete       && (newSubOpt.autocomplete || thisSubOpt.autocomplete)) ||
                                        (newSubOpt.description !== thisSubOpt.description         && (newSubOpt.description || thisSubOpt.description)) ||
                                        (newSubOpt.minValue !== thisSubOpt.minValue               && (!isNaN(newSubOpt?.minValue) || !isNaN(thisSubOpt?.minValue))) ||
                                        (newSubOpt.maxValue !== thisSubOpt.maxValue               && (!isNaN(newSubOpt?.maxValue) || !isNaN(thisSubOpt?.maxValue))) ||
                                        (newSubOpt.minLength !== thisSubOpt.minLength             && (!isNaN(newSubOpt?.minLength) || !isNaN(thisSubOpt?.minLength))) ||
                                        (newSubOpt.maxLength !== thisSubOpt.maxLength             && (!isNaN(newSubOpt?.maxLength) || !isNaN(thisSubOpt?.maxLength))) ||
                                        (newSubOpt.choices?.length !== thisSubOpt.choices?.length && (newSubOpt.choices || thisSubOpt.choices)) ||
                                        (newSubOpt.options?.length !== thisSubOpt.options?.length && (newSubOpt.options || thisSubOpt.options))
                                    ) {
                                        isDiff = true;
                                        debugLog(`   [NEW] - ${newSubOpt ? inspect(newSubOpt) : null}\n   [OLD] - ${thisSubOpt ? inspect(thisSubOpt) : null}`);
                                        break;
                                    }
                                }
                            }
                            if (thisOpt?.type === ApplicationCommandOptionType.SubcommandGroup) {
                                debugLog(` > SubcommandGroup: ${thisOpt.name}`);
                                for (const optIx in thisOpt.options) {
                                    const thisSubOpt = thisOpt.options[optIx];
                                    const newSubOpt  = newOpt.options[optIx];

                                    if ((newSubOpt.required !== thisSubOpt.required               && (newSubOpt.required || thisSubOpt.required)) ||
                                        (newSubOpt.name !== thisSubOpt.name                       && (newSubOpt.name || thisSubOpt.name)) ||
                                        (newSubOpt.autocomplete !== thisSubOpt.autocomplete       && (newSubOpt.autocomplete || thisSubOpt.autocomplete)) ||
                                        (newSubOpt.description !== thisSubOpt.description         && (newSubOpt.description || thisSubOpt.description)) ||
                                        (newSubOpt.minValue !== thisSubOpt.minValue               && (!isNaN(newSubOpt?.minValue) || !isNaN(thisSubOpt?.minValue))) ||
                                        (newSubOpt.maxValue !== thisSubOpt.maxValue               && (!isNaN(newSubOpt?.maxValue) || !isNaN(thisSubOpt?.maxValue))) ||
                                        (newSubOpt.minLength !== thisSubOpt.minLength             && (!isNaN(newSubOpt?.minLength) || !isNaN(thisSubOpt?.minLength))) ||
                                        (newSubOpt.maxLength !== thisSubOpt.maxLength             && (!isNaN(newSubOpt?.maxLength) || !isNaN(thisSubOpt?.maxLength))) ||
                                        (newSubOpt.choices?.length !== thisSubOpt.choices?.length && (newSubOpt.choices || thisSubOpt.choices)) ||
                                        (newSubOpt.options?.length !== thisSubOpt.options?.length && (newSubOpt.options || thisSubOpt.options))
                                    ) {
                                        isDiff = true;
                                        debugLog(`   [NEW] - ${newSubOpt ? inspect(newSubOpt) : null}\n   [OLD] - ${thisSubOpt ? inspect(thisSubOpt) : null}`);
                                        break;
                                    }
                                }
                            }
                        }
                    }
                }
                if (cmd?.description !== thisCom?.description) {
                    isDiff = true;
                    debugLog("Diff Desc");
                }
                if (cmd?.defaultPermission !== thisCom?.defaultPermission) {
                    isDiff = true;
                    debugLog("Diff perms");
                }
            }

            // If something has changed, stick it in there
            if (isDiff) {
                console.log("Need to update " + thisCom.name);
                changedComs.push({id: thisCom.id, com: cmd});
            }
        });
        return {changedComs, newComs};
    }

    function debugLog(...str) {
        if (!DEBUG) return;
        if (str.length === 1 && typeof str[0] === "string") {
            console.log(str[0]);
        } else {
            console.log(inspect(...str, {depth: 5}));
        }
    }
};



