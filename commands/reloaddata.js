const Command = require("../base/Command");

class ReloadData extends Command {
    constructor(Bot) {
        super(Bot, {
            name: "reloaddata",
            category: "Dev",
            enabled: true,
            aliases: ["rdata", "rd"],
            subArgs: {
                lang: { aliases: [] }
            },
            permLevel: 10
        });
    }

    async run(Bot, message, [action, ...args], options) { // eslint-disable-line no-unused-vars
        const id = message.channel.id;
        const client = message.client;
        switch (action) {
            case "com":
            case "commands": // Reloads all the commands,
                if (message.client.shard && message.client.shard.count > 0) {
                    console.log("Trying to shard reload all coms, id: " + id + " test");
                    await message.client.shard.broadcastEval(async client =>  await client.reloadAllCommands())
                        .then(res => {
                            let errors = [];
                            res.forEach(r => {
                                if (r.errArr?.length) errors.push(...r.errArr);
                            });
                            errors = [...new Set(errors)];
                            const resOut = res.map(r => `${r.succArr.length.toString().padStart(4)} | ${r.errArr.length}`);
                            return message.channel.send({content: Bot.codeBlock(`Succ | Err\n${resOut.join("\n")}${errors.length ? "\n\nErrors in files:\n" + errors.join("\n") : ""}`)});
                        })
                        .catch(err => console.log("[ReloadData com]\n" + err));
                } else {
                    client.reloadAllCommands(id);
                }
                break;
            case "debug":
            case "debugLogs":
                Bot.config.debugLogs = !Bot.config.debugLogs;
                return super.success(message, `DebugLogs set to **${Bot.config.debugLogs}**`);
            case "ev":
            case "events": // Reload the events
                if (message.client.shard && message.client.shard.count > 0) {
                    message.client.shard.broadcastEval(client => client.reloadAllEvents())
                        .then(res => {
                            let errors = [];
                            res.forEach(r => {
                                if (r.errArr?.length) errors.push(...r.errArr);
                            });
                            errors = [...new Set(errors)];
                            const resOut = res.map(r => `${r.succArr.length.toString().padStart(4)} | ${r.errArr.length}`);
                            return message.channel.send({content: Bot.codeBlock(`Succ | Err\n${resOut.join("\n")}${errors.length ? "\n\nErrors in files:\n" + errors.join("\n") : ""}`)});
                        })
                        .catch(err => console.log("[ReloadData ev]\n" + err));
                } else {
                    client.reloadAllEvents(id);
                }
                break;
            case "func":
            case "funct":
            case "functs":
            case "function":
            case "functions": // Reload the functions file
                if (message.client.shard && message.client.shard.count > 0) {
                    message.client.shard.broadcastEval(client => client.reloadFunctions())
                        .then(res => {
                            let errors = [];
                            res.forEach(r => {
                                if (r?.err) errors.push(r.err);
                            });
                            errors = [...new Set(errors)];
                            return message.channel.send({
                                content: errors.length ? "**ERROR**\n" + Bot.codeBlock(errors.join("\n")) : "> Functions reloaded!"
                            });
                        })
                        .catch(err => console.log("[ReloadData funct]\n" + err));
                } else {
                    client.reloadFunctions();
                }
                break;
            case "api":
            case "swapi": // Reload the swapi file
                if (message.client.shard && message.client.shard.count > 0) {
                    message.client.shard.broadcastEval(client => client.reloadSwapi())
                        .then(res => {
                            let errors = [];
                            res.forEach(r => {
                                if (r?.err) errors.push(r.err);
                            });
                            errors = [...new Set(errors)];
                            return message.channel.send({
                                content: errors.length ? "**ERROR**\n" + errors.join("\n") : "> Swapi reloaded!"
                            });
                        })
                        .catch(err => console.log("[ReloadData swapi]\n" + err));
                } else {
                    client.reloadSwapi();
                }
                break;
            case "data": // Reload the character/ ship data files
                if (message.client.shard && message.client.shard.count > 0) {
                    message.client.shard.broadcastEval(client => client.reloadDataFiles())
                        .then(res => {
                            let errors = [];
                            res.forEach(r => {
                                if (r?.err) errors.push(r.err);
                            });
                            errors = [...new Set(errors)];
                            return message.channel.send({
                                content: errors.length ? "**ERROR**\n" + Bot.codeBlock(errors.join("\n")) : "> Data reloaded!"
                            });
                        })
                        .catch(err => console.log("[ReloadData data]\n" + err));
                } else {
                    client.reloadDataFiles();
                }
                break;
            case "lang":
            case "language":
            case "languages":
                if (message.client.shard && message.client.shard.count > 0) {
                    message.client.shard.broadcastEval(client => client.reloadLanguages())
                        .then(res => {
                            let errors = [];
                            res.forEach(r => {
                                if (r.err) errors.push(r.err);
                            });
                            errors = [...new Set(errors)];
                            return message.channel.send({
                                content: errors.length ? "**ERROR**\n" + errors.join("\n") : "> Languages reloaded!"
                            });
                        })
                        .catch(err => console.log("[ReloadData data]\n" + err));
                } else {
                    client.reloadLanguages();
                }
                break;
            case "swlang": {
                // Do this first since it's just the basic skeleton
                let langList;
                if (options.subArgs.lang) {
                    if (Bot.swgohLangList.includes(options.subArgs.lang)) {
                        langList = [options.subArgs.lang];
                    } else {
                        return message.channel.send({content: "Invalid lang, try one of these: " + Bot.swgohLangList.join(", ")});
                    }
                } else {
                    langList = Bot.swgohLangList;
                }

                await Bot.swgohAPI.character(null, true);
                // console.log(`Reloading ${args[0] ? args[0] : "all"} for langs: ${langList.join(", ")}`);
                // console.log(langList);
                for (const lang of langList) {
                    if (!args[0]) {
                        await Bot.swgohAPI.units("", lang, true);
                        message.channel.send({content: `Updated units for ${lang}`});
                        await Bot.swgohAPI.abilities([], lang, true);
                        message.channel.send({content: `Updated abilities for ${lang}`});

                        // I only check for English ones anyways, so don't bother grabbing the resOut
                        // * Also, it seems to bork everything for whatever reason
                        if (lang.toLowerCase() === "eng_us") {
                            await Bot.swgohAPI.recipes([], lang, true);
                            message.channel.send({content: `Updated recipes for ${lang}`});
                        } else {
                            message.channel.send({content: "Skipping recipes for " + lang});
                        }

                        await Bot.swgohAPI.gear([], lang, true);
                        message.channel.send({content: `Updated gear for ${lang}`});
                        message.channel.send({content: "Updated all local data for " + lang});
                    } else {
                        switch (args[0]) {
                            case "abilities":
                                await Bot.swgohAPI.abilities([], lang, true);
                                message.channel.send({content: `Updated abilities for ${lang}`});
                                break;
                            case "gear":
                                await Bot.swgohAPI.gear([], lang, true);
                                message.channel.send({content: `Updated gear for ${lang}`});
                                break;
                            case "recipes":
                                if (lang.toLowerCase() === "eng_us") {
                                    await Bot.swgohAPI.recipes([], lang, true);
                                    message.channel.send({content: `Updated recipes for ${lang}`});
                                } else {
                                    message.channel.send({content: "Skipping recipes for " + lang});
                                }
                                break;
                            case "units":
                                await Bot.swgohAPI.units("", lang, true);
                                message.channel.send({content: `Updated units for ${lang}`});
                                break;
                            default:
                                return message.channel.send({content: "Invalid choice - `Abilities, gear, recipes, units`"});
                        }
                    }
                }
                message.channel.send({content: "API Language update complete"});
                break;
            }
            case "users": // Reload the users file
                if (message.client.shard && message.client.shard.count > 0) {
                    message.client.shard.broadcastEval(client => client.reloadUserReg())
                        .then(res => {
                            let errors = [];
                            res.forEach(r => {
                                if (r.err) errors.push(r.err);
                            });
                            errors = [...new Set(errors)];
                            return message.channel.send({
                                content: errors.length ? "**ERROR**\n" + errors.join("\n") : "> Users reloaded!"
                            });
                        })
                        .catch(err => console.log("[ReloadData users]\n" + err));
                } else {
                    client.reloadUserReg();
                }
                break;
            default:
                return super.error(message, "You can only choose `api, commands, events, functions, languages, swlang, users, or data.`");
        }
    }
}

module.exports = ReloadData;
