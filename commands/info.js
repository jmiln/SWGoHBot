const Command = require("../base/Command");
const { version } = require("discord.js");

class Info extends Command {
    constructor(Bot) {
        super(Bot, {
            aliases: ["invite", "inv"],
            name: "info",
            category: "Misc",
            permissions: ["EMBED_LINKS"]
        });
    }

    async run(Bot, message) {
        try {
            const guilds = await Bot.guildCount();
            const users = await Bot.userCount();
            const content = message.language.get("COMMAND_INFO_OUTPUT", message.client.shard.id);
            const fields = [];
            let desc = content.statHeader + "\n";
            const statTable = [
                { title: content.prefix, content: message.guildSettings.prefix },
                { title: content.users, content: users },
                { title: content.servers, content: guilds },
                { title: content.nodeVer, content: process.version },
                { title: content.discordVer, content: "v" + version }
            ];
            desc += Bot.makeTable({
                title:   {value: "", align: "left", endWith: "::"},
                content: {value: "", align: "left"}
            }, statTable, {useHeader: false}).join("\n");

            desc += `\n\n${content.swgohHeader}\n`;
            const swgohTable = [
                { title: content.players, content: Bot.swgohPlayerCount },
                { title: content.guilds, content: Bot.swgohGuildCount },
                { title: content.lang, content: Bot.swgohLangList.length }
            ];
            desc += Bot.makeTable({
                title:   {value: "", align: "left", endWith: "::"},
                content: {value: "", align: "left"}
            }, swgohTable, {useHeader: false}).join("\n");

            Object.keys(content.links).forEach(link => {
                fields.push({
                    name: link,
                    value: content.links[link]
                });
            });

            message.channel.send({embed: {
                author: {
                    name: message.client.shard?.count ? content.shardHeader : content.header
                },
                description: Bot.codeBlock(desc, "asciidoc"),
                fields: fields,
                color: Math.floor(Math.random()*16777215)
            }});
        } catch (e) {
            console.log("Error in info, caught error:");
            return Bot.logger.error(e);
        }
    }
}

module.exports = Info;
