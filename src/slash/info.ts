import SlashCommand from "../base/slashCommand";
import { Interaction, version } from "discord.js";
import { BotInteraction, BotType } from "../modules/types";

class Info extends SlashCommand {
    constructor(Bot: BotType) {
        super(Bot, {
            name: "info",
            guildOnly: false,
            category: "Misc",
            permissions: ["EMBED_LINKS"],
            description: "Displays general stats & info about the bot"
        });
    }

    async run(Bot: BotType, interaction: BotInteraction) {
        try {
            const guilds = await Bot.guildCount();
            const users = await Bot.userCount();
            const content = interaction.language.get("COMMAND_INFO_OUTPUT", interaction.client.shard.ids[0]);
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
