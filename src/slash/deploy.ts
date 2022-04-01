import SlashCommand from "../base/slashCommand";
import { inspect } from "util";
import { PartialWebhookMixin, Interaction, Client, Snowflake, Collection, ApplicationCommand } from "discord.js";
import { BotInteraction, BotType } from "../modules/types";
import slashCommand from "../base/slashCommand";

const DEBUG = false;
// const DEBUG = true;

class Deploy extends SlashCommand {
    constructor(Bot: BotType) {
        super(Bot, {
            name: "deploy",
            description: "This will deploy all slash commands.",
            category: "Dev",
            permLevel: 10,
            enabled: true
        });
    }

    async run(Bot: BotType, interaction: BotInteraction) {
        if (!interaction?.guild) return super.error(interaction, "This command can only be run in a server");
        const outLog = [];

        try {
            // Filter the slash commands to find guild only ones.
            const guildCmds = interaction.client.slashcmds.filter((com: slashCommand) => com.guildOnly);

            // The currently deployed commands
            const currentGuildCommands = await interaction.client.guilds.cache.get(interaction.guild.id)?.commands.fetch();
            const { newComs: newGuildComs, changedComs: changedGuildComs } = checkCmds(guildCmds, currentGuildCommands);


            // Give the user a notification the commands are deploying.
            await interaction.reply("Deploying commands!");

            // We'll use set but please keep in mind that `set` is overkill for a singular command.
            // Set the guild commands like this.
            if (newGuildComs.length) {
                for (const newGuildCom of newGuildComs) {
                    console.log(`Adding ${newGuildCom.name} to Guild commands`);
                    await interaction.client.guilds.cache.get(interaction.guild.id)?.commands.create(newGuildCom);
                }
            }
            if (changedGuildComs.length) {
                for (const diffGuildCom of changedGuildComs) {
                    console.log(`Updating ${diffGuildCom.com.name} in Guild commands`);
                    await interaction.client.guilds.cache.get(interaction.guild.id)?.commands.edit(diffGuildCom.id, diffGuildCom.com);
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
                const globalCmds = interaction.client.slashcmds.filter((com: slashCommand) => !com.guildOnly);
                // Get the currently deployed global commands
                const currentGlobalCommands = await interaction.client.application?.commands?.fetch();

                const { newComs: newGlobalComs, changedComs: changedGlobalComs } = checkCmds(globalCmds, currentGlobalCommands);

                if (newGlobalComs.length) {
                    for (const newGlobalCom of newGlobalComs) {
                        console.log(`Adding ${newGlobalCom.name} to Global commands`);
                        await interaction.client.application?.commands.create(newGlobalCom);
                    }
                }
                if (changedGlobalComs.length) {
                    for (const diffGlobalCom of changedGlobalComs) {
                        console.log(`Updating ${diffGlobalCom.com.name} in Global commands`);
                        await interaction.client.application?.commands.edit(diffGlobalCom.id, diffGlobalCom.com);
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

            return interaction.editReply({
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

        function checkCmds(localCmdList: Collection<string, slashCommand> | Collection<Snowflake, ApplicationCommand>, currentCmdList: Collection<Snowflake, ApplicationCommand>) {
            const changedComs = [];
            const newComs = [];

            // Work through all the commands that are already deployed, and see which ones have changed
            localCmdList.forEach((cmd: any) => {
                if (cmd.commandData) cmd = cmd.commandData;
                const thisCom = currentCmdList.find(c => c.name === cmd.name);
                let isDiff = false;

                // If there's no match, it definitely goes in
                if (!thisCom) {
                    console.log("Need to add " + cmd.name);
                    return newComs.push(cmd);
                } else {
                    // Fill in various options info, just in case
                    debugLog("\nChecking " + cmd.name);
                    for (const ix in cmd.options) {
                        if (cmd.options?.length !== thisCom.options?.length) {
                            // One of the arrays of stuff (options or length) was a different length
                            debugLog("Diff optionsLen");
                            debugLog(cmd.options, thisCom.options);
                            isDiff = true;
                            return;
                        }
                        if (!cmd.options[ix]) {
                            console.log(`Missing cmd.options[${ix}]: ${cmd.options[ix]}`);
                            cmd.options[ix] = {
                                type: cmd.options[ix].type,
                                name: cmd.options[ix].name,
                                description: cmd.options[ix].description,
                                required: cmd.options[ix].required,
                                choices: cmd.options[ix].choices,
                                channelTypes: cmd.options[ix].channelTypes,
                                options: cmd.options[ix].options?.length ? cmd.options[ix].options : undefined,
                                minValue: cmd.options[ix].minValue || undefined,
                                maxValue: cmd.options[ix].maxValue || undefined
                            };
                        }
                        if (!cmd.options[ix].required)     cmd.options[ix].required     = false;
                        if (!cmd.options[ix].autocomplete) cmd.options[ix].autocomplete = undefined;
                        if (!cmd.options[ix].choices)      cmd.options[ix].choices      = undefined;
                        if (!cmd.options[ix].channelTypes) cmd.options[ix].channelTypes = undefined;
                        if (!cmd.options[ix].options || !cmd.options[ix].options?.length)   cmd.options[ix].options      = undefined;

                        debugLog("> checking " + cmd.options[ix]?.name);
                        for (const op of Object.keys(cmd.options[ix])) {
                            debugLog("  * Checking: " + op);
                            if (op === "choices") {
                                const cmdLen = cmd.options[ix]?.choices?.length;
                                const thisComLen = thisCom.options[ix]?.choices?.length;
                                if (cmdLen && thisComLen) {
                                    // They both have some number of choices
                                    if (cmdLen !== thisComLen) {
                                        // One of em is a different length than the other, so definitely needs an update
                                        debugLog("ChoiceLen is different");
                                        isDiff = true;
                                    } else {
                                        // If they have the same choice count, make sure that the choices are the same inside
                                        cmd.options[ix].choices.forEach((choice: {name: string, value: string}, jx: number) => {
                                            const thisChoice = thisCom.options[ix].choices.find((thisChoice: {name: string}) => thisChoice.name === choice.name);
                                            if (!thisChoice) {
                                                // Couldn't find a matching choice, so go ahead and update
                                                debugLog("Diff choices");
                                                debugLog(choice, thisChoice);
                                                isDiff = true;
                                                return;
                                            }
                                            if (choice.name !== thisChoice.name || choice.value !== thisChoice.value) {
                                                // They have a different choice here, needs updating
                                                debugLog("Diff choices");
                                                debugLog(choice, thisChoice);
                                                isDiff = true;
                                                return;
                                            }
                                        });
                                    }
                                } else {
                                    if (cmdLen || thisComLen) {
                                        // One version of the command has at least one choice
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
function debugLog(...str: any[]) {
    if (DEBUG) {
        if (str?.length === 1 && typeof str[0] === "string") {
            console.log(str[0]);
        } else {
            console.log(inspect(str, {depth: 5}));
        }
    }
}

module.exports = Deploy;
