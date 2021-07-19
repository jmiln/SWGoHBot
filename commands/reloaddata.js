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
                    message.client.shard.broadcastEval(`this.reloadAllCommands('${id}'); `);
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
                    message.client.shard.broadcastEval(`this.reloadAllEvents('${id}'); `);
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
                    message.client.shard.broadcastEval(`this.reloadFunctions('${id}'); `);
                } else {
                    client.reloadFunctions(id);
                }
                break;
            case "api":
            case "swapi": // Reload the swapi file
                if (message.client.shard && message.client.shard.count > 0) {
                    message.client.shard.broadcastEval(`this.reloadSwapi('${id}'); `);
                } else {
                    client.reloadSwapi(id);
                }
                break;
            case "data": // Reload the character/ ship data files
                if (message.client.shard && message.client.shard.count > 0) {
                    message.client.shard.broadcastEval(`this.reloadDataFiles('${id}'); `);
                } else {
                    client.reloadDataFiles(id);
                }
                break;
            case "lang":
            case "language":
            case "languages":
                if (message.client.shard && message.client.shard.count > 0) {
                    message.client.shard.broadcastEval(`this.reloadLanguages('${id}'); `);
                } else {
                    client.reloadLanguages(id);
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
                        await Bot.swgohAPI.gear([], lang, true);
                        message.channel.send({content: `Updated gear for ${lang}`});
                        await Bot.swgohAPI.recipes([], lang, true);
                        message.channel.send({content: `Updated recipes for ${lang}`});
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
                                await Bot.swgohAPI.recipes([], lang, true);
                                message.channel.send({content: `Updated recipes for ${lang}`});
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
                    message.client.shard.broadcastEval(`this.reloadUserReg('${id}');`);
                } else {
                    client.reloadUserReg(id);
                }
                break;
            default:
                return super.error(message, "You can only choose `api, commands, events, functions, languages, swlang, or data.`");
        }
    }
}

module.exports = ReloadData;
