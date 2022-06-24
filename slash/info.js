const Command = require("../base/slashCommand");
const { version } = require("discord.js");

class Info extends Command {
    constructor(Bot) {
        super(Bot, {
            aliases: ["invite", "inv"],
            name: "info",
            guildOnly: false,
            category: "Misc",
            permissions: ["EMBED_LINKS"],
            description: "Displays general stats & info about the bot"
        });
    }

    async run(Bot, interaction) {
        const dbo = await Bot.mongo.db(Bot.config.mongodb.swapidb);
        const swgohPlayerCount = await dbo.collection("playerStats").estimatedDocumentCount();
        const swgohGuildCount  = await dbo.collection("guilds").estimatedDocumentCount();
        try {
            const guilds = await Bot.guildCount();
            const users = await Bot.userCount();
            const content = interaction.language.get("COMMAND_INFO_OUTPUT", interaction.client.shard.id);
            const fields = [];
            let desc = content.statHeader + "\n";
            const statTable = [
                { title: content.prefix, content: interaction.guildSettings.prefix },
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
                { title: content.players, content: swgohPlayerCount },
                { title: content.guilds,  content: swgohGuildCount },
                { title: content.lang,    content: Bot.swgohLangList.length }
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

            return interaction.reply({embeds: [{
                author: {
                    name: interaction.client.shard?.count ? content.shardHeader : content.header
                },
                description: Bot.codeBlock(desc, "asciidoc"),
                fields: fields,
                color: Math.floor(Math.random()*16777215)
            }]});
        } catch (e) {
            console.log("Error in info, caught error:");
            return Bot.logger.error(e);
        }
    }
}

module.exports = Info;
