import { codeBlock, InteractionContextType, version } from "discord.js";
import Command from "../base/slashCommand.ts";
import config from "../config.ts";
import constants from "../data/constants/constants.ts";
import database from "../modules/database.ts";
import { getShardId, guildCount, makeTable, userCount } from "../modules/functions.ts";
import logger from "../modules/Logger.ts";
import type { CommandContext } from "../types/types.ts";

interface InfoContent {
    statHeader: string;
    users: string;
    servers: string;
    nodeVer: string;
    discordVer: string;
    swgohHeader: string;
    players: string;
    guilds: string;
    lang: string;
    links: { [key: string]: string };
    shardHeader: string;
    header: string;
}

const MAX_COLOR_VALUE = 0xffffff;

const TABLE_CONFIG = {
    columns: {
        title: { value: "", align: "left", endWith: "::" },
        content: { value: "", align: "left" },
    },
    options: { boldHeader: false, useHeader: false },
} as const;

export default class Info extends Command {
    static readonly metadata = {
        name: "info",
        guildOnly: false,
        contexts: [InteractionContextType.Guild, InteractionContextType.BotDM],
        description: "Displays general stats & info about the bot",
    };
    constructor() {
        super(Info.metadata);
    }

    async run({ interaction, language }: CommandContext) {
        try {
            const db = database.getClient().db(config.mongodb.swapidb);
            const swgohPlayerCount = await db.collection("playerStats").estimatedDocumentCount();
            const swgohGuildCount = await db.collection("guilds").estimatedDocumentCount();
            const totalGuilds = await guildCount(interaction.client);
            const totalUsers = await userCount(interaction.client);
            const shardId = getShardId(interaction.client);

            const content = language.get("COMMAND_INFO_OUTPUT", shardId) as unknown as InfoContent;

            const description = this.buildDescription(content, {
                users: totalUsers,
                guilds: totalGuilds,
                swgohPlayers: swgohPlayerCount,
                swgohGuilds: swgohGuildCount,
            });

            const fields = Object.keys(content.links).map((linkName) => ({
                name: linkName,
                value: content.links[linkName],
            }));

            return interaction.reply({
                embeds: [
                    {
                        author: {
                            name: interaction.client.shard?.count ? content.shardHeader : content.header,
                        },
                        description: codeBlock("asciidoc", description),
                        fields: fields,
                        color: Math.floor(Math.random() * MAX_COLOR_VALUE),
                    },
                ],
            });
        } catch (error) {
            logger.error(`[slash/info] Caught error: ${error.toString()}`);
            return super.error(interaction, "An error occurred while fetching bot information.");
        }
    }

    private buildDescription(
        content: InfoContent,
        stats: { users: number; guilds: number; swgohPlayers: number; swgohGuilds: number },
    ): string {
        const statRows = [
            { title: content.users, content: stats.users },
            { title: content.servers, content: stats.guilds },
            { title: content.nodeVer, content: process.version },
            { title: content.discordVer, content: `v${version}` },
        ];

        const swgohRows = [
            { title: content.players, content: stats.swgohPlayers },
            { title: content.guilds, content: stats.swgohGuilds },
            { title: content.lang, content: constants.swgohLangList.length },
        ];

        const statTable = makeTable(TABLE_CONFIG.columns, statRows, TABLE_CONFIG.options).join("\n");
        const swgohTable = makeTable(TABLE_CONFIG.columns, swgohRows, TABLE_CONFIG.options).join("\n");

        return `${content.statHeader}\n${statTable}\n\n${content.swgohHeader}\n${swgohTable}`;
    }
}
