const Command = require("../base/slashCommand");
const { version, codeBlock } = require("discord.js");

class Info extends Command {
    constructor(Bot) {
        super(Bot, {
            name: "info",
            guildOnly: false,
            description: "Displays general stats & info about the bot",
        });
    }

    async run(Bot, interaction) {
        const dbo = await Bot.mongo.db(Bot.config.mongodb.swapidb);
        const swgohPlayerCount = await dbo.collection("playerStats").estimatedDocumentCount();
        const swgohGuildCount = await dbo.collection("guilds").estimatedDocumentCount();
        try {
            const guilds = await Bot.guildCount();
            const users = await Bot.userCount();
            const content = interaction.language.get("COMMAND_INFO_OUTPUT", interaction.client.shard.id);
            const fields = [];
            let desc = `${content.statHeader}\n`;
            const statTable = [
                { title: content.users, content: users },
                { title: content.servers, content: guilds },
                { title: content.nodeVer, content: process.version },
                { title: content.discordVer, content: `v${version}` },
            ];
            desc += Bot.makeTable(
                {
                    title: { value: "", align: "left", endWith: "::" },
                    content: { value: "", align: "left" },
                },
                statTable,
                { useHeader: false },
            ).join("\n");

            desc += `\n\n${content.swgohHeader}\n`;
            const swgohTable = [
                { title: content.players, content: swgohPlayerCount },
                { title: content.guilds, content: swgohGuildCount },
                { title: content.lang, content: Bot.swgohLangList.length },
            ];
            desc += Bot.makeTable(
                {
                    title: { value: "", align: "left", endWith: "::" },
                    content: { value: "", align: "left" },
                },
                swgohTable,
                { useHeader: false },
            ).join("\n");

            for (const link of Object.keys(content.links)) {
                fields.push({
                    name: link,
                    value: content.links[link],
                });
            }

            return interaction.reply({
                embeds: [
                    {
                        author: {
                            name: interaction.client.shard?.count ? content.shardHeader : content.header,
                        },
                        description: codeBlock("asciidoc", desc),
                        fields: fields,
                        color: Math.floor(Math.random() * 16777215),
                    },
                ],
            });
        } catch (e) {
            return Bot.logger.error(`[slash/info] Caught error: ${e.toString()}`);
        }
    }
}

module.exports = Info;
