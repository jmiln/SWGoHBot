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
        const swgohLangList = ["CHS_CN", "CHT_CN", "ENG_US", "FRE_FR", "GER_DE", "IND_ID", "ITA_IT", "JPN_JP", "KOR_KR", "POR_BR", "RUS_RU", "SPA_XM", "THA_TH", "TUR_TR"];
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
                for (const lang of swgohLangList) {
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
                }
                message.channel.send("API Language update complete");
                break;

            default:
                return super.error(message, "You can only choose `api, commands, events, functions, languages, swlang, or data.`");
        }
    }
}

module.exports = ReloadData;

