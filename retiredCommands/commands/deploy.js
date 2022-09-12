// Copied then severely modified from https://github.com/AnIdiotsGuide/guidebot/blob/class-v13-update/commands/deploy.js
const Command = require("../base/Command.js");
const {inspect} = require("util");
const DEBUG = false;
// const DEBUG = true;

class Deploy extends Command {
    constructor(client) {
        super(client, {
            name: "deploy",
            description: "This will deploy all slash commands.",
            category: "Dev",
            permLevel: 10,
            usage: "deploy",
            aliases: ["d"],
            enabled: true
        });
    }

    async run(Bot, message) {
        if (!message?.guild) return super.error(message, "This command can only be run in a server");
        const outLog = [];

        try {
            // Filter the slash commands to find guild only ones.
            const guildCmds = message.client.slashcmds.filter(c => c.guildOnly).map(c => c.commandData);

            // The currently deployed commands
            const currentGuildCommands = await message.client.guilds.cache.get(message.guild.id)?.commands.fetch();
            const { newComs: newGuildComs, changedComs: changedGuildComs } = checkCmds(guildCmds, currentGuildCommands);


            // Give the user a notification the commands are deploying.
            const msg = await message.channel.send("Deploying commands!");

            // We'll use set but please keep in mind that `set` is overkill for a singular command.
            // Set the guild commands like this.
            if (newGuildComs.length) {
                for (const newGuildCom of newGuildComs) {
                    console.log(`Adding ${newGuildCom.name} to Guild commands`);
                    await message.client.guilds.cache.get(message.guild.id)?.commands.create(newGuildCom);
                }
            }
            if (changedGuildComs.length) {
                for (const diffGuildCom of changedGuildComs) {
                    console.log(`Updating ${diffGuildCom.com.name} in Guild commands`);
                    await message.client.guilds.cache.get(message.guild.id)?.commands.edit(diffGuildCom.id, diffGuildCom.com);
                }
            }

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


            if (Bot.config.enableGlobalCmds) {
                // Then filter out global commands by inverting the filter
                const globalCmds = message.client.slashcmds.filter(c => !c.guildOnly).map(c => c.commandData);
                // Get the currently deployed global commands
                const currentGlobalCommands = await message.client.application?.commands?.fetch();

                const { newComs: newGlobalComs, changedComs: changedGlobalComs } = checkCmds(globalCmds, currentGlobalCommands);

                if (newGlobalComs.length) {
                    for (const newGlobalCom of newGlobalComs) {
                        console.log(`Adding ${newGlobalCom.name} to Global commands`);
                        await message.client.application?.commands.create(newGlobalCom);
                    }
                }
                if (changedGlobalComs.length) {
                    for (const diffGlobalCom of changedGlobalComs) {
                        console.log(`Updating ${diffGlobalCom.com.name} in Global commands`);
                        await message.client.application?.commands.edit(diffGlobalCom.id, diffGlobalCom.com);
                    }
                }

                // The new global commands
                outLog.push({
                    name: "**Added Global**",
                    value: newGlobalComs?.length ? newGlobalComs.map(newCom => ` * ${newCom.name}`).join("\n") : "N/A"
                });

                // The edited global commands
                outLog.push({
                    name: "**Changed Global**",
                    value: changedGlobalComs?.length ? changedGlobalComs.map(diffCom => ` * ${diffCom.com.name}`).join("\n") : "N/A"
                });
            }

            return msg.edit({
                content: null,
                embeds: [
                    {
                        title: "Deployed Commands",
                        fields: outLog
                    }
                ]
            });
        } catch (err) {
            Bot.logger.error(inspect(err, {depth: 5}));
        }

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
                        if (!cmd.options[ix]) cmd.options[ix] = {};
                        if (!cmd.options[ix].required)     cmd.options[ix].required     = false;
                        if (!cmd.options[ix].autocomplete) cmd.options[ix].autocomplete = undefined;
                        if (!cmd.options[ix].choices)      cmd.options[ix].choices      = undefined;
                        if (!cmd.options[ix].channelTypes) cmd.options[ix].channelTypes = undefined;
                        if (!cmd.options[ix].options || !cmd.options[ix].options?.length)   cmd.options[ix].options = undefined;

                        debugLog("> checking " + cmd.options[ix]?.name);
                        for (const op of Object.keys(cmd.options[ix])) {
                            debugLog("  * Checking: " + op);
                            if (op === "choices") {
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
                                    (newOpt.description !== thisOpt.description         && (newOpt.description || thisOpt.description)) ||
                                    (newOpt.min_value !== thisOpt.min_value             && (newOpt.min_value || thisOpt.min_value)) ||
                                    (newOpt.max_value !== thisOpt.max_value             && (newOpt.max_value || thisOpt.max_value)) ||
                                    (newOpt.choices?.length !== thisOpt.choices?.length && (newOpt.choices || thisOpt.choices)) ||
                                    (newOpt.options?.length !== thisOpt.options?.length && (newOpt.options || thisOpt.options))
                                ) {
                                    isDiff = true;
                                    debugLog(`   [NEW] - ${newOpt ? inspect(newOpt) : null}\n   [OLD] - ${thisOpt ? inspect(thisOpt) : null}`);
                                    break;
                                }

                                if (thisOpt?.type === "SUB_COMMAND") {
                                    for (const optIx in thisOpt.options) {
                                        const thisSubOpt = thisOpt.options[optIx];
                                        const newSubOpt  = newOpt.options[optIx];

                                        if ((newSubOpt.required !== thisSubOpt.required               && (newSubOpt.required || thisSubOpt.required)) ||
                                            (newSubOpt.name !== thisSubOpt.name                       && (newSubOpt.name || thisSubOpt.name)) ||
                                            (newSubOpt.description !== thisSubOpt.description         && (newSubOpt.description || thisSubOpt.description)) ||
                                            (newSubOpt.min_value !== thisSubOpt.min_value             && (newSubOpt.min_value || thisSubOpt.min_value)) ||
                                            (newSubOpt.max_value !== thisSubOpt.max_value             && (newSubOpt.max_value || thisSubOpt.max_value)) ||
                                            (newSubOpt.choices?.length !== thisSubOpt.choices?.length && (newSubOpt.choices || thisSubOpt.choices)) ||
                                            (newSubOpt.options?.length !== thisSubOpt.options?.length && (newSubOpt.options || thisSubOpt.options))
                                        ) {
                                            isDiff = true;
                                            debugLog(`   [NEW] - ${newOpt ? inspect(newOpt) : null}\n   [OLD] - ${thisOpt ? inspect(thisOpt) : null}`);
                                            break;
                                        }
                                    }
                                }
                            }
                        }
                    }
                    if (!cmd.defaultPermission) cmd.defaultPermission = true;

                    if (cmd?.description !== thisCom?.description) { isDiff = true; }
                    if (cmd?.defaultPermission !== thisCom?.defaultPermission) { isDiff = true; }
                }

                // If something has changed, stick it in there
                if (isDiff) {
                    console.log("Need to update " + thisCom.name);
                    changedComs.push({id: thisCom.id, com: cmd});
                }
            });
            return {changedComs, newComs};
        }
    }
}
function debugLog(...str) {
    if (DEBUG) {
        if (str.length === 1 && typeof str[0] === "string") {
            console.log(str[0]);
        } else {
            console.log(inspect(...str, {depth: 5}));
        }
    }
}

module.exports = Deploy;
