import { ApplicationCommandOptionType, codeBlock, InteractionContextType, version } from "discord.js";
import Command from "../base/slashCommand.ts";
import { env } from "../config/config.ts";
import constants from "../data/constants/constants.ts";
import { getCommandDetail, getTopCommands, STATS_WINDOW_MS } from "../modules/commandStats.ts";
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
const CMDSTATS_LIMIT = 15;

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
        category: "General",
        contexts: [InteractionContextType.Guild, InteractionContextType.BotDM],
        description: "Displays general stats & info about the bot",
        options: [
            {
                name: "stats",
                type: ApplicationCommandOptionType.Subcommand,
                description: "Displays bot statistics and info",
            },
            {
                name: "cmdstats",
                type: ApplicationCommandOptionType.Subcommand,
                description: "Displays command usage statistics",
                options: [
                    {
                        name: "command",
                        type: ApplicationCommandOptionType.String,
                        description: "Command name to show detailed stats for",
                        required: false,
                    },
                ],
            },
        ],
    };

    constructor() {
        super(Info.metadata);
    }

    async run({ interaction, language }: CommandContext) {
        const subcommand = interaction.options.getSubcommand();

        if (subcommand === "stats") {
            return this.runStats({ interaction, language });
        }
        return this.runCmdstats({ interaction });
    }

    private async runStats({ interaction, language }: CommandContext) {
        try {
            const db = database.getClient().db(env.MONGODB_SWAPI_DB);
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
                        fields,
                        color: Math.floor(Math.random() * MAX_COLOR_VALUE),
                    },
                ],
            });
        } catch (error) {
            logger.error(`[slash/info] stats error: ${String(error)}`);
            return super.error(interaction, "An error occurred while fetching bot information.");
        }
    }

    private async runCmdstats({ interaction }: Pick<CommandContext, "interaction">) {
        try {
            const commandArg = interaction.options.getString("command");
            const now = Date.now();
            const startTime = now - STATS_WINDOW_MS;

            if (commandArg) {
                return await this.replyCmdDetail(interaction, commandArg, startTime, now);
            }
            return await this.replyCmdList(interaction, startTime, now);
        } catch (error) {
            logger.error(`[slash/info] cmdstats error: ${String(error)}`);
            return super.error(interaction, "An error occurred while fetching command stats.");
        }
    }

    private async replyCmdList(interaction: CommandContext["interaction"], startTime: number, endTime: number) {
        const topCommands = await getTopCommands(startTime, endTime, CMDSTATS_LIMIT);

        const rows = topCommands.map((c) => ({ title: c.command, content: c.count }));
        const tableText =
            rows.length > 0
                ? codeBlock("asciidoc", makeTable(TABLE_CONFIG.columns, rows, TABLE_CONFIG.options).join("\n"))
                : "No data available.";

        return interaction.reply({
            embeds: [
                {
                    title: `Top ${CMDSTATS_LIMIT} Commands (last 90 days)`,
                    description: tableText,
                    color: Math.floor(Math.random() * MAX_COLOR_VALUE),
                },
            ],
        });
    }

    private async replyCmdDetail(interaction: CommandContext["interaction"], commandName: string, startTime: number, endTime: number) {
        const detail = await getCommandDetail(commandName, startTime, endTime);

        const summaryRows = [
            { title: "Total uses", content: detail.totalCount },
            { title: "Success rate", content: `${detail.successRate}%` },
            { title: "Avg exec time", content: detail.avgExecutionTime != null ? `${detail.avgExecutionTime}ms` : "N/A" },
        ];

        const summaryTable = makeTable(TABLE_CONFIG.columns, summaryRows, TABLE_CONFIG.options).join("\n");

        const fields: { name: string; value: string }[] = [];
        if (Object.keys(detail.subcommandCounts).length > 0) {
            const subRows = Object.entries(detail.subcommandCounts)
                .sort(([, a], [, b]) => b - a)
                .map(([sub, count]) => ({ title: sub, content: count }));
            const subTable = makeTable(TABLE_CONFIG.columns, subRows, TABLE_CONFIG.options).join("\n");
            fields.push({ name: "Subcommands", value: codeBlock("asciidoc", subTable) });
        }

        return interaction.reply({
            embeds: [
                {
                    title: `/${commandName} — last 90 days`,
                    description: detail.totalCount === 0 ? "No usage data found for this command." : codeBlock("asciidoc", summaryTable),
                    fields,
                    color: Math.floor(Math.random() * MAX_COLOR_VALUE),
                },
            ],
        });
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
