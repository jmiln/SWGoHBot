import { ApplicationCommandOptionType, InteractionContextType } from "discord.js";
import Command from "../base/slashCommand.ts";
import { env } from "../config/config.ts";
import cache from "../modules/cache.ts";
import logger from "../modules/Logger.ts";
import arenaPlayerRegistry from "../modules/arenaPlayerRegistry.ts";
import patreonFuncs, { buildArenaHistChart } from "../modules/patreonFuncs.ts";
import type { CommandContext, UserConfig } from "../types/types.ts";

const WINDOW_MAP: Record<string, number> = {
    "7": 7,
    "30": 30,
    "90": 90,
};

export default class ArenaHist extends Command {
    static readonly metadata = {
        name: "arenahist",
        description: "View your arena rank history as a chart",
        category: "Patreon",
        contexts: [InteractionContextType.Guild, InteractionContextType.BotDM],
        options: [
            {
                name: "allycode",
                type: ApplicationCommandOptionType.String,
                description: "Ally code to view (defaults to primary account)",
                autocomplete: true,
            },
            {
                name: "date_range",
                type: ApplicationCommandOptionType.String,
                description: "Time range to display",
                choices: [
                    { name: "7 days", value: "7" },
                    { name: "30 days", value: "30" },
                    { name: "90 days", value: "90" },
                ],
            },
        ],
    };

    constructor() {
        super(ArenaHist.metadata);
    }

    async run({ interaction, language }: CommandContext) {
        const userID = interaction.user.id;

        // Patreon check — before deferReply so we can use interaction.reply() directly
        const pat = await patreonFuncs.getPatronUser(userID);
        if (!pat || pat.amount_cents < 100) {
            return interaction.reply({
                embeds: [
                    {
                        title: language.get("COMMAND_ARENAHIST_PATREON_TITLE"),
                        description: language.get("COMMAND_ARENAHIST_PATREON_DESC"),
                    },
                ],
            });
        }

        await interaction.deferReply();

        const user = (await cache.getOne(env.MONGODB_SWGOHBOT_DB, "users", { id: userID })) as UserConfig;
        if (!user) {
            return super.error(interaction, language.get("COMMAND_ARENAHIST_NOT_REGISTERED"));
        }

        const allycodeArg = interaction.options.getString("allycode");
        const dateRangeArg = interaction.options.getString("date_range") ?? "7";
        const windowDays = WINDOW_MAP[dateRangeArg] ?? 7;

        const targetAllyCode = allycodeArg ? Number.parseInt(allycodeArg, 10) : (user.primaryAllyCode ?? null);

        if (!targetAllyCode || !user.accounts.includes(targetAllyCode)) {
            return super.error(interaction, language.get("COMMAND_ARENAHIST_NO_ACCOUNT"));
        }

        const playerDoc = await arenaPlayerRegistry.getPlayer(targetAllyCode);

        const payload = buildArenaHistChart(
            playerDoc?.charHist,
            playerDoc?.shipHist,
            windowDays,
            Date.now(),
            `${playerDoc?.name ?? targetAllyCode} (${targetAllyCode})`,
        );

        if (!payload) {
            return super.error(interaction, language.get("COMMAND_ARENAHIST_NO_DATA"));
        }

        let imageBuffer: Buffer | null = null;
        try {
            const res = await fetch(`${env.IMAGE_SERVER_URL}/chart`, {
                method: "POST",
                body: JSON.stringify(payload),
                headers: { "Content-Type": "application/json" },
            });
            if (!res.ok) {
                logger.error(`[arenahist] Image server returned ${res.status} ${res.statusText}`);
            } else {
                imageBuffer = Buffer.from(await res.arrayBuffer());
            }
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            logger.error(`[arenahist] Failed to reach image server: ${msg}`);
        }

        if (!imageBuffer) {
            return super.error(interaction, language.get("COMMAND_ARENAHIST_IMAGE_ERROR"));
        }

        return interaction.editReply({
            files: [{ attachment: imageBuffer, name: "arenahist.png" }],
        });
    }
}
