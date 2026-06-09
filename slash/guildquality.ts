import { ApplicationCommandOptionType, codeBlock, InteractionContextType } from "discord.js";
import Command from "../base/slashCommand.ts";
import constants from "../data/constants/constants.ts";
import { getAllyCode, updatedFooterStr } from "../modules/functions.ts";
import logger from "../modules/Logger.ts";
import patreonFuncs from "../modules/patreonFuncs.ts";
import swgohAPI from "../modules/swapi.ts";
import type { SWAPIGuild, SWAPIPlayer } from "../types/swapi_types.ts";
import type { CommandContext } from "../types/types.ts";

interface PlayerQuality {
    name: string;
    allyCode: number;
    modQuality: number;
    gearQuality: number;
    totalQuality: number;
    charGP: number;
    totalGP: number;
}

export default class GuildQuality extends Command {
    static readonly metadata = {
        name: "guildquality",
        description: "Check a guild's overall quality",
        category: "Gamedata",
        contexts: [InteractionContextType.Guild, InteractionContextType.BotDM],
        options: [
            {
                name: "allycode",
                description: "The ally code of the guild you want to check.",
                type: ApplicationCommandOptionType.String,
                autocomplete: true,
            },
        ],
    };
    constructor() {
        super(GuildQuality.metadata);
    }

    async run({ interaction, language }: CommandContext) {
        await interaction.reply({ content: language.get("BASE_GUILD_PLEASE_WAIT") as string });

        const ac = interaction.options.getString("allycode");
        const allyCode = await getAllyCode(interaction, ac, true);

        if (!allyCode) {
            return super.error(
                interaction,
                "No valid ally code found. Please make sure that you have a registered ally code via the `userconf` command, or have entered a valid ally code",
            );
        }

        const cooldown = await patreonFuncs.getPlayerCooldown(interaction.user.id, interaction?.guild?.id);

        // Take care of the tickets now if needed, since it doesn't need bits ahead
        let guild: SWAPIGuild;
        try {
            // Grab the guild's info from the DB
            guild = await swgohAPI.guild(allyCode, cooldown);
        } catch (e) {
            const errorMessage = e instanceof Error ? e.message : String(e);
            logger.error(`[GuildQuality] Failed to get guild: ${errorMessage}`);
            return super.error(interaction, `Issue getting guild: ${codeBlock(errorMessage)}`);
        }

        if (!guild) {
            return super.error(interaction, `Couldn't get guild. ${language.get("BASE_GUILD_NOT_FOUND")}`);
        }

        const rosterQualities = await getGuildRosterQualities(guild);

        if (!rosterQualities?.length) {
            return super.error(interaction, `Couldn't get guild stats. ${language.get("BASE_GUILD_NOT_FOUND")}`);
        }

        const outArr = [
            "`ModQ | GearQ | TotalQ | CharGP | Name  `",
            ...rosterQualities
                .sort((a, b) => b.totalQuality - a.totalQuality)
                .map((playerQ) => {
                    const totalQStr = playerQ.totalQuality.toFixed(2).padStart(6);
                    const charGPStr = (playerQ.charGP / 1_000_000).toFixed(1);
                    return `\`${playerQ.modQuality.toFixed(2)} |  ${playerQ.gearQuality.toFixed(2)} | ${totalQStr} |  ${charGPStr}M  |\` ${playerQ.name}`;
                }),
        ];

        const fields = [];

        const {
            modQuality: totalMod,
            gearQuality: totalGear,
            totalQuality: totalTotal,
        } = rosterQualities.reduce(
            (acc, p) => ({
                modQuality: acc.modQuality + p.modQuality,
                gearQuality: acc.gearQuality + p.gearQuality,
                totalQuality: acc.totalQuality + p.totalQuality,
            }),
            { modQuality: 0, gearQuality: 0, totalQuality: 0 },
        );
        const count = rosterQualities.length;
        const averages = { modQuality: totalMod / count, gearQuality: totalGear / count, totalQuality: totalTotal / count };
        const averageStr = [
            `Mod Quality: ${averages.modQuality.toFixed(2)}`,
            `Gear Quality: ${averages.gearQuality.toFixed(2)}`,
            `Total Quality: ${averages.totalQuality.toFixed(2)}`,
        ].join("\n");
        fields.push({
            name: "Averages",
            value: codeBlock(averageStr),
        });

        const infoStr = [
            " Mod Quality: Number of +15 Speeds / (squad GP / 100000)",
            " Gear Quality: (Number of G12+ + G13 Bonus Score) / (Total GP / 100000)",
            " G13 Bonus score: 1 + (0.2 bonus per relic tier) (ex: r0 = 1, r1 = 1.2, ..., r10 = 3.0)",
            " Total Quality: Mod Quality + Gear Quality",
        ].join("\n");
        fields.push({
            name: "Extra Info",
            value: `Formulas based on DSR bot's command\n${codeBlock(infoStr)}`,
        });

        if (guild.warnings?.length) {
            fields.push({
                name: "Warnings",
                value: guild.warnings.join("\n"),
            });
        }

        // Grab the most recently updated player's timestamp
        const maxUpdated = Math.max(...guild.roster.map((pl) => pl.updated));
        const footerStr = updatedFooterStr(maxUpdated, language);
        fields.push({
            name: constants.zws,
            value: footerStr,
        });

        return interaction.editReply({
            content: null,
            embeds: [
                {
                    author: {
                        name: `${guild.name}'s player quality`,
                    },
                    description: outArr.join("\n"),
                    fields,
                },
            ],
        });

        async function getGuildRosterQualities(guild: SWAPIGuild): Promise<PlayerQuality[]> {
            try {
                const guildGG = await swgohAPI.unitStats(
                    guild.roster.map((m) => m.allyCode),
                    cooldown,
                );
                return guildGG.map(processPlayerQuality);
            } catch (err) {
                const errorMessage = err instanceof Error ? err.message : String(err);
                await interaction.editReply({
                    content: null,
                    embeds: [
                        {
                            title: "Something Broke while getting your guild's characters",
                            description: codeBlock(errorMessage),
                            footer: { text: language.get("BASE_PLEASE_TRY_AGAIN") as string },
                        },
                    ],
                });
                return null;
            }
        }

        function processPlayerQuality(player: SWAPIPlayer): PlayerQuality {
            const charGP = player?.stats?.find((s) => s.nameKey === "STAT_CHARACTER_GALACTIC_POWER_ACQUIRED_NAME")?.value || 0;
            const totalGP = player?.stats?.find((s) => s.nameKey === "STAT_GALACTIC_POWER_ACQUIRED_NAME")?.value || 0;

            const spd15Count = player.roster
                .flatMap((ch) => ch.mods ?? [])
                .filter((m) => m.secondaryStat.some((s) => (s.unitStat === 5 || s.unitStat === "UNITSTATSPEED") && s.value >= 15)).length;

            const g12Plus = player.roster.filter((ch) => ch.gear >= 12).length;

            const accumulatedCharScore = player.roster
                .filter((ch) => ch.gear >= 13)
                .reduce((sum, ch) => sum + 1 + 0.2 * Math.max(0, (ch.relic?.currentTier ?? 0) - 2), 0);

            const modQuality = charGP > 0 ? spd15Count / (charGP / 100_000) : 0;
            const gearQuality = (g12Plus + accumulatedCharScore) / (totalGP / 100_000);
            return {
                name: player.name,
                allyCode: player.allyCode,
                modQuality,
                gearQuality,
                totalQuality: modQuality + gearQuality,
                charGP,
                totalGP,
            };
        }
    }
}
