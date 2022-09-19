const Command = require("../base/slashCommand");
const { ApplicationCommandOptionType } = require("discord.js");

class ReloadData extends Command {
    constructor(Bot) {
        super(Bot, {
            name: "reloaddata",
            enabled: true,
            guildOnly: true,
            permLevel: 10,
            options: [
                {
                    name: "target",
                    description: "What to reload",
                    type: ApplicationCommandOptionType.String,
                    required: true,
                    choices: [
                        {name: "Commands", value: "Commands"},
                        {name: "Data", value: "Data"},
                        {name: "Debug", value: "Debug"},
                        {name: "Events", value: "Events"},
                        {name: "Functions", value: "Functions"},
                        {name: "Languages", value: "Languages"},
                        {name: "Slash Commands", value: "SlashCommands"},
                        {name: "SWAPI", value: "SWAPI"},
                        {name: "SWLang", value: "SWLang"},
                        {name: "Users", value: "Users"},
                    ]
                }
            ]
        });
    }

    async run(Bot, interaction) { // eslint-disable-line no-unused-vars
        const channelId = interaction.channel.id;
        const action = interaction.options.getString("target").toLowerCase();

        switch (action) {
            case "com":
            case "commands": // Reloads all the commands,
                if (interaction.client.shard && interaction.client.shard.count > 0) {
                    await interaction.client.shard.broadcastEval(async client =>  await client.reloadAllCommands())
                        .then(res => {
                            let errors = [];
                            res.forEach(r => {
                                if (r.errArr?.length) errors.push(...r.errArr);
                            });
                            errors = [...new Set(errors)];
                            const resOut = res.map(r => `${r.succArr.length.toString().padStart(4)} | ${r.errArr.length}`);
                            return interaction.reply({content: Bot.codeBlock(`Succ | Err\n${resOut.join("\n")}${errors.length ? "\n\nErrors in files:\n" + errors.join("\n") : ""}`)});
                        })
                        .catch(err => console.log("[ReloadData com]\n" + err));
                } else {
                    interaction.client.reloadAllCommands(channelId);
                }
                break;
            case "slashcommands": // Reloads all the commands,
                if (interaction.client.shard && interaction.client.shard.count > 0) {
                    await interaction.client.shard.broadcastEval(async client =>  await client.reloadAllSlashCommands())
                        .then(res => {
                            let errors = [];
                            res.forEach(r => {
                                if (r.errArr?.length) errors.push(...r.errArr);
                            });
                            errors = [...new Set(errors)];
                            const resOut = res.map(r => `${r.succArr.length.toString().padStart(4)} | ${r.errArr.length}`);
                            return interaction.reply({content: Bot.codeBlock(`Succ | Err\n${resOut.join("\n")}${errors.length ? "\n\nErrors in files:\n" + errors.join("\n") : ""}`)});
                        })
                        .catch(err => console.log("[ReloadData slash com]\n" + err));
                } else {
                    interaction.client.reloadAllCommands();
                }
                break;
            case "debug":
            case "debugLogs":
                Bot.config.debugLogs = !Bot.config.debugLogs;
                return super.success(interaction, `DebugLogs set to **${Bot.config.debugLogs}**`);
            case "ev":
            case "events": // Reload the events
                if (interaction.client.shard && interaction.client.shard.count > 0) {
                    interaction.client.shard.broadcastEval(client => client.reloadAllEvents())
                        .then(res => {
                            let errors = [];
                            res.forEach(r => {
                                if (r.errArr?.length) errors.push(...r.errArr);
                            });
                            errors = [...new Set(errors)];
                            const resOut = res.map(r => `${r.succArr.length.toString().padStart(4)} | ${r.errArr.length}`);
                            return interaction.reply({content: Bot.codeBlock(`Succ | Err\n${resOut.join("\n")}${errors.length ? "\n\nErrors in files:\n" + errors.join("\n") : ""}`)});
                        })
                        .catch(err => console.log("[ReloadData ev]\n" + err));
                } else {
                    interaction.client.reloadAllEvents(channelId);
                }
                break;
            case "func":
            case "funct":
            case "functs":
            case "function":
            case "functions": // Reload the functions file
                if (interaction.client.shard && interaction.client.shard.count > 0) {
                    interaction.client.shard.broadcastEval(client => client.reloadFunctions())
                        .then(res => {
                            let errors = [];
                            res.forEach(r => {
                                if (r?.err) errors.push(r.err);
                            });
                            errors = [...new Set(errors)];
                            return interaction.reply({
                                content: errors.length ? "**ERROR**\n" + Bot.codeBlock(errors.join("\n")) : "> Functions reloaded!"
                            });
                        })
                        .catch(err => console.log("[ReloadData funct]\n" + err));
                } else {
                    interaction.client.reloadFunctions();
                }
                break;
            case "api":
            case "swapi": // Reload the swapi file
                if (interaction.client.shard && interaction.client.shard.count > 0) {
                    interaction.client.shard.broadcastEval(client => client.reloadSwapi())
                        .then(res => {
                            let errors = [];
                            res.forEach(r => {
                                if (r?.err) errors.push(r.err);
                            });
                            errors = [...new Set(errors)];
                            return interaction.reply({
                                content: errors.length ? "**ERROR**\n" + errors.join("\n") : "> Swapi reloaded!"
                            });
                        })
                        .catch(err => console.log("[ReloadData swapi]\n" + err));
                } else {
                    interaction.client.reloadSwapi();
                }
                break;
            case "data": // Reload the character/ ship data files
                if (interaction.client.shard && interaction.client.shard.count > 0) {
                    interaction.client.shard.broadcastEval(client => client.reloadDataFiles())
                        .then(res => {
                            let errors = [];
                            res.forEach(r => {
                                if (r?.err) errors.push(r.err);
                            });
                            errors = [...new Set(errors)];
                            return interaction.reply({
                                content: errors.length ? "**ERROR**\n" + Bot.codeBlock(errors.join("\n")) : "> Data reloaded!"
                            });
                        })
                        .catch(err => console.log("[ReloadData data]\n" + err));
                } else {
                    interaction.client.reloadDataFiles();
                }
                break;
            case "lang":
            case "language":
            case "languages":
                if (interaction.client.shard && interaction.client.shard.count > 0) {
                    interaction.client.shard.broadcastEval(client => client.reloadLanguages())
                        .then(res => {
                            let errors = [];
                            res.forEach(r => {
                                if (r.err) errors.push(r.err);
                            });
                            errors = [...new Set(errors)];
                            return interaction.reply({
                                content: errors.length ? "**ERROR**\n" + errors.join("\n") : "> Languages reloaded!"
                            });
                        })
                        .catch(err => console.log("[ReloadData data]\n" + err));
                } else {
                    interaction.client.reloadLanguages();
                }
                break;
            case "swlang": {
                // Do this first since it's just the basic skeleton
                const langList = Bot.swgohLangList;

                // Helper funct to log the updates
                const progressArr = [];
                const progressOut = (strIn) => {
                    progressArr.push(strIn);
                    if (interaction.replied) {
                        interaction.editReply({content: progressArr.join("\n")});
                    } else {
                        interaction.reply({content: progressArr.join("\n")});
                    }
                };

                await Bot.swgohAPI.character(null, true);
                progressOut("Starting update...");
                for (const lang of langList) {
                    await Bot.swgohAPI.units("", lang, true);
                    progressOut(`Updated units for ${lang}`);

                    await Bot.swgohAPI.abilities([], lang, true);
                    progressOut(`Updated abilities for ${lang}`);

                    await Bot.swgohAPI.gear([], lang, true);
                    progressOut(`Updated gear for ${lang}`);

                    if (lang.toLowerCase() === "eng_us") {
                        await Bot.swgohAPI.recipes([], lang, true);
                        progressOut(`Updated recipes for ${lang}`);
                    } else {
                        progressOut(`Skipping recipes for ${lang}`);
                    }

                    progressOut(`Updated all local data for ${lang}`);
                }
                interaction.editReply({content: "API Language update complete"});
                break;
            }
            case "users": // Reload the users file
                if (interaction.client.shard && interaction.client.shard.count > 0) {
                    interaction.client.shard.broadcastEval(client => client.reloadUserReg())
                        .then(res => {
                            let errors = [];
                            res.forEach(r => {
                                if (r.err) errors.push(r.err);
                            });
                            errors = [...new Set(errors)];
                            return interaction.reply({
                                content: errors.length ? "**ERROR**\n" + errors.join("\n") : "> Users reloaded!"
                            });
                        })
                        .catch(err => console.log("[ReloadData users]\n" + err));
                } else {
                    interaction.client.reloadUserReg();
                }
                break;
            default:
                return super.error(interaction, "You can only choose `api, commands, events, functions, languages, swlang, users, or data.`");
        }
    }
}

module.exports = ReloadData;
