const Command = require("../base/slashCommand");
const { ApplicationCommandOptionType, codeBlock } = require("discord.js");

class GuildQuality extends Command {
    constructor(Bot) {
        super(Bot, {
            name: "guildquality",
            guildOnly: false,
            options: [
                {
                    name: "allycode",
                    description: "The ally code of the guild you want to check.",
                    type: ApplicationCommandOptionType.String,
                },
            ],
        });
    }

    async run(Bot, interaction) {
        await interaction.reply({ content: interaction.language.get("COMMAND_GUILDS_PLEASE_WAIT") });

        const allycode = interaction.options.getString("allycode");
        const userAC = await Bot.getAllyCode(interaction, allycode, true);

        // If it hasn't found a valid ally code, grumble at the user, since that's required
        if (!userAC) {
            return super.error(
                interaction,
                "No valid ally code found. Please make sure that you have a registered ally code via the `userconf` command, or have entered a valid ally code",
            );
        }

        const cooldown = await Bot.getPlayerCooldown(interaction.user.id, interaction?.guild?.id);

        // Take care of the tickets now if needed, since it doesn't need bits ahead
        let guild = null;
        try {
            // Grab the guild's info from the DB
            guild = await Bot.swgohAPI.guild(userAC, cooldown);

            // Filter out any members that aren't in the guild
            guild.roster = guild.roster.filter((mem) => mem.guildMemberLevel > 1);
        } catch (e) {
            return super.error(interaction, `Issue getting guild: \`${codeBlock(e.message)}\``);
        }

        if (!guild) {
            return super.error(interaction, `Couldn't get guild${interaction.language.get("COMMAND_GUILDS_NO_GUILD")}`);
        }

        const rosterQualities = await getGuildRosterQualities(guild);

        if (!rosterQualities?.length) {
            return super.error(interaction, `Couldn't get guild stats${interaction.language.get("COMMAND_GUILDS_NO_GUILD")}`);
        }

        const outArr = ["`ModQ | GearQ | TotalQ | CharGP | Name  `"];
        for (const playerQ of rosterQualities.sort((a, b) => b.totalQuality - a.totalQuality)) {
            const gearQStr = playerQ.gearQuality.toFixed(2);
            const totalQStr = playerQ.totalQuality.toFixed(2).toString().padStart(6);
            const charGPStr = (playerQ.charGP/1_000_000).toFixed(1);

            outArr.push(`\`${playerQ.modQuality.toFixed(2)} |  ${gearQStr} | ${totalQStr} |  ${charGPStr}M  |\` ${playerQ.name}`);
        }

        const fields = [];

        const averages = {
            modQuality: rosterQualities.reduce((a, b) => a + b.modQuality, 0) / rosterQualities.length,
            gearQuality: rosterQualities.reduce((a, b) => a + b.gearQuality, 0) / rosterQualities.length,
            totalQuality: rosterQualities.reduce((a, b) => a + b.totalQuality, 0) / rosterQualities.length,
        };
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
                " G13 Bonus score: 1 + (0.2 bonus per relic tier) (ex: r0 = 1, r1 = 1.2, ..., r7 = 2.4)",
                " Total Quality: Mod Quality + Gear Quality"
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

        const footerStr = Bot.updatedFooterStr(guild.updated, interaction);
        fields.push({
            name: Bot.constants.zws,
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
                    fields: fields.length ? fields : null,
                },
            ],
        });


        // Mod quality: 15+ speed mods / (charGP / 100_000)
        // Gear Quality: (Number of G12+ + G13 Bonus Score) / (Total GP / 100000)
        // G13 Bonus score: 1 + (0.2 bonus per relic tier) (ex: r0 = 1, r1 = 1.2, ..., r7 = 2.4)
        // Total Quality: Mod Quality + Gear Quality

        // Output: ModQ | GearQ | TotalQ | CharGP | TotalGP | Name

        async function getGuildRosterQualities(guild) {
            const playerQualities = [];
            let guildGG;
            try {
                guildGG = await Bot.swgohAPI.unitStats(
                    guild.roster.map((m) => m.allyCode),
                    cooldown,
                );
            } catch (err) {
                return interaction.editReply({
                    content: null,
                    embeds: [
                        {
                            title: "Something Broke while getting your guild's characters",
                            description: ` ${codeBlock(err)}`,
                            footer: "Please try again in a bit",
                        },
                    ],
                });
            }
            guildGG = guildGG.sort((a, b) => (a.name.toLowerCase() > b.name.toLowerCase() ? 1 : -1));
            for (const player of guildGG) {
                const thisPlayer = await processPlayerQuality(player);
                playerQualities.push(thisPlayer);
            }

            return playerQualities;
        }

        async function processPlayerQuality(player) {
            const charGP = player?.stats?.find((s) => s.nameKey === "STAT_CHARACTER_GALACTIC_POWER_ACQUIRED_NAME")?.value || 0;
            const totalGP = player?.stats?.find((s) => s.nameKey === "STAT_GALACTIC_POWER_ACQUIRED_NAME")?.value || 0;

            let spd15Count = 0;
            let accumulatedCharScore = 0;
            let g12Plus = 0;

            for (const ch of player.roster) {
                if (ch.mods) {
                    for (const m of ch.mods) {
                        const spd = m.secondaryStat.find((s) => (s.unitStat === 5 || s.unitStat === "UNITSTATSPEED") && s.value >= 15);
                        if (spd?.value >= 15) {
                            spd15Count += 1;
                        }
                    }
                }
                if (ch.gear >= 12) {
                    g12Plus += 1;
                }
                if (ch.gear >= 13) {
                    const relicTier = ch?.relic?.currentTier || 0;
                    accumulatedCharScore += 1 + (0.2 * relicTier);
                }
            }

            const modQuality = spd15Count / (charGP / 100_000);
            const gearQuality = (g12Plus + accumulatedCharScore) / (totalGP / 100_000);
            return {
                name: player.name,
                allyCode: player.allyCode,
                modQuality: modQuality,
                gearQuality: gearQuality,
                totalQuality: modQuality + gearQuality,
                charGP: charGP,
                totalGP: totalGP,
            };
        }
    }
}

module.exports = GuildQuality;
