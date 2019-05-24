const Command = require("../base/Command");

class ReloadData extends Command {
    constructor(client) {
        super(client, {
            name: "reloaddata",
            category: "Dev",
            enabled: true,
            aliases: ["rdata", "rd"],
            permLevel: 10
        });
    }

    async run(client, message, [action, ...args], options) { // eslint-disable-line no-unused-vars
        const id = message.channel.id;
        switch (action) {
            case "com":
            case "commands": // Reloads all the commands,
                if (client.shard && client.shard.count > 0) {
                    client.shard.broadcastEval(`this.reloadAllCommands('${id}'); `);
                } else {
                    client.reloadAllCommands(id);
                }
                break;
            case "ev":
            case "events": // Reload the events
                if (client.shard && client.shard.count > 0) {
                    client.shard.broadcastEval(`this.reloadAllEvents('${id}'); `);
                } else {
                    client.reloadAllEvents(id);
                }
                break;
            case "func":
            case "funct":
            case "functs":
            case "function":
            case "functions": // Reload the functions file
                if (client.shard && client.shard.count > 0) {
                    client.shard.broadcastEval(`this.reloadFunctions('${id}'); `);
                } else {
                    client.reloadFunctions(id);
                }
                break;
            case "api":
            case "swapi": // Reload the swapi file
                if (client.shard && client.shard.count > 0) {
                    client.shard.broadcastEval(`this.reloadSwapi('${id}'); `);
                } else {
                    client.reloadSwapi(id);
                }
                break;
            case "data": // Reload the character/ ship data files
                if (client.shard && client.shard.count > 0) {
                    client.shard.broadcastEval(`this.reloadDataFiles('${id}'); `);
                } else {
                    client.reloadDataFiles(id);
                }
                break;
            case "lang":
            case "language":
            case "languages":
                if (client.shard && client.shard.count > 0) {
                    client.shard.broadcastEval(`this.reloadLanguages('${id}'); `);
                } else {
                    client.reloadLanguages(id);
                }
                break;
            case "swlang":
                // Do this first since it's just the basic skeleton
                await client.swgohAPI.character(null, true);
                for (const lang of client.swgohLangList) {
                    if (!args[0]) {
                        await client.swgohAPI.abilities([], lang, true);
                        message.channel.send(`Updated abilities for ${lang}`);
                        await client.swgohAPI.gear([], lang, true);
                        message.channel.send(`Updated gear for ${lang}`);
                        await client.swgohAPI.recipes([], lang, true);
                        message.channel.send(`Updated recipes for ${lang}`);
                        await client.swgohAPI.materials([], lang, true);
                        message.channel.send(`Updated mats for ${lang}`);
                        await client.swgohAPI.units("", lang, true);
                        message.channel.send(`Updated units for ${lang}`);
                        message.channel.send("Updated all local data for " + lang);
                    } else {
                        switch (args[0]) {
                            case "abilities":
                                await client.swgohAPI.abilities([], lang, true);
                                message.channel.send(`Updated abilities for ${lang}`);
                                break;
                            case "gear":
                                await client.swgohAPI.gear([], lang, true);
                                message.channel.send(`Updated gear for ${lang}`);
                                break;
                            case "materials":
                                await client.swgohAPI.materials([], lang, true);
                                message.channel.send(`Updated mats for ${lang}`);
                                break;
                            case "recipes":
                                await client.swgohAPI.recipes([], lang, true);
                                message.channel.send(`Updated recipes for ${lang}`);
                                break;
                            case "units":
                                await client.swgohAPI.units("", lang, true);
                                message.channel.send(`Updated units for ${lang}`);
                                break;
                            default:
                                return message.channel.send("Invalid choice - `Abilities, gear, materials, recipes, units`");
                        }
                    }
                }
                message.channel.send("API Language update complete");
                break;
            case "users": // Reload the users file
                if (client.shard && client.shard.count > 0) {
                    client.shard.broadcastEval(`this.reloadUserReg('${id}');`);
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

