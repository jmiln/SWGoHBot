// Copied from https://github.com/AnIdiotsGuide/guidebot/blob/class-v13-update/commands/deploy.js
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

    async run(Bot, message, args, options) { // eslint-disable-line no-unused-vars
        try {
            // Filter the slash commands to find guild only ones.
            const guildCmds = message.client.slashcmds.filter(c => c.guildOnly).map(c => c.commandData);

            // The currently deployed commands
            const currentGuildCommands = await message.client.guilds.cache.get(message.guild.id)?.commands.fetch();
            const changedGuildComs = [];
            const newGuildComs = [];

            // Work through all the commands that are already deployed, and see which ones have changed
            guildCmds.forEach(cmd => {
                const thisCom = currentGuildCommands.find(c => c.name === cmd.name);
                let isDiff = false;

                // If there's no match, it definitely goes in
                if (!thisCom) {
                    console.log("Need to add " + cmd.name);
                    return newGuildComs.push(cmd);
                } else {
                    // Fill in various options info, just in case
                    debugLog("\nChecking " + cmd.name);
                    for (const ix in cmd.options) {
                        if (!cmd.options[ix]) cmd.options[ix] = {};
                        if (!cmd.options[ix].required) cmd.options[ix].required = false;
                        if (!cmd.options[ix].choices) cmd.options[ix].choices = undefined;
                        if (!cmd.options[ix].options) cmd.options[ix].options = undefined;

                        debugLog("> checking " + cmd.options[ix]?.name);
                        for (const op of Object.keys(cmd.options[ix])) {
                            debugLog("  * Checking: " + op);
                            if (op === "choices") {
                                if (cmd.options[ix]?.choices?.length && thisCom.options[ix]?.choices?.length) {
                                    // Make sure they both have some number of choices
                                    if (cmd.options[ix]?.choices?.length !== thisCom.options[ix]?.choices?.length) {
                                        // One of em is different than the other, so definitely needs an update
                                        isDiff = true;
                                    } else {
                                        // If they have the same option count, make sure that the choices are the same inside
                                        cmd.options[ix].choices.forEach((c, jx) => {
                                            if (JSON.stringify(c) !== JSON.stringify(thisCom.options[ix].choices[jx])) {
                                                // They have a different choice here, needs updating
                                                isDiff = true;
                                                return;
                                            }
                                        });
                                    }
                                } else {
                                    // One or both have no choices
                                    if (cmd.options[ix]?.choices?.length && thisCom.options[ix]?.choices?.length) {
                                        // At least one of em has an entry, so it needs updating
                                        isDiff = true;
                                    } else {
                                        // Neither of em have any, so nothing to do here
                                        continue;
                                    }
                                }
                                if (isDiff) {
                                    debugLog(`    - ${cmd.options[ix] ? inspect(cmd.options[ix]?.choices) : null}\n    - ${thisCom.options[ix] ? inspect(thisCom.options[ix]?.choices) : null}`);
                                    break;
                                }
                            } else if (!cmd.options[ix] || !thisCom.options[ix] || cmd.options[ix][op] !== thisCom.options[ix][op]) {
                                isDiff = true;
                                debugLog(`    - ${cmd.options[ix] ? inspect(cmd.options[ix][op]) : null}\n    - ${thisCom.options[ix] ? inspect(thisCom.options[ix][op]) : null}`);
                                break;
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
                    changedGuildComs.push({id: thisCom.id, com: cmd});
                }
            });

            // Now we filter out global commands by inverting the filter.
            // const globalCmds = message.client.slashcmds.filter(c => !c.guildOnly).map(c => c.commandData);

            // Give the user a notification the commands are deploying.
            await message.channel.send("Deploying commands!");

            // We'll use set but please keep in mind that `set` is overkill for a singular command.
            // Set the guild commands like this.
            // await message.client.guilds.cache.get(message.guild.id)?.commands.set([]);
            // await message.client.guilds.cache.get(message.guild.id)?.commands.set(guildComsToLoad);
            if (newGuildComs.length) {
                for (const newCom of newGuildComs) {
                    console.log(`Adding ${newCom.name}`);
                    await message.client.guilds.cache.get(message.guild.id)?.commands.create(newCom);
                }
            }
            if (changedGuildComs.length) {
                for (const diffCom of changedGuildComs) {
                    console.log(`Updating ${diffCom.com.name}`);
                    await message.client.guilds.cache.get(message.guild.id)?.commands.edit(diffCom.id, diffCom.com);
                }
            }

            // Then set the global commands like this.
            // await message.client.application?.commands.set(globalCmds).catch(e => console.log(e));

            // Reply to the user that the commands have been deployed.
            await message.channel.send("All commands deployed!");
        } catch (err) {
            Bot.logger.error(inspect(err, {depth: 5}));
        }
    }
}
function debugLog(str) {
    if (DEBUG) {
        console.log(str);
    }
}

module.exports = Deploy;
