const Command = require("../base/Command");
const { version } = require("discord.js");

class Info extends Command {
    constructor(client) {
        super(client, {
            aliases: ["invite", "inv"],
            name: "info",
            category: "Misc",
            permissions: ["EMBED_LINKS"]
        });
    }

    async run(client, message) {
        const guilds = await client.guildCount();
        const users = await client.userCount();
        const content = message.language.get("COMMAND_INFO_OUTPUT");
        const fields = [];
        let desc = content.statHeader + "\n";
        const statTable = [
            { title: content.prefix, content: message.guildSettings.prefix },
            { title: content.users, content: users },
            { title: content.servers, content: guilds },
            { title: content.nodeVer, content: process.version },
            { title: content.discordVer, content: "v" + version }
        ];
        desc += client.makeTable({
            title:   {value: "", align: "left", endWith: "::"},
            content: {value: "", align: "left"}
        }, statTable, {useHeader: false}).join("\n");

        desc += `\n\n${content.swgohHeader}\n`;
        const swgohTable = [
            { title: content.players, content: client.swgohPlayerCount },
            { title: content.guilds, content: client.swgohGuildCount },
            { title: content.lang, content: client.swgohLangList.length }
        ];
        desc += client.makeTable({
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
                name: content.header
            },
            description: client.codeBlock(desc, "asciidoc"),
            fields: fields,
            color: Math.floor(Math.random()*16777215)
        }});
    }
}

module.exports = Info;
