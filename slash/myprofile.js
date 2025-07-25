const Command = require("../base/slashCommand");
const { ApplicationCommandOptionType } = require("discord.js");

class MyProfile extends Command {
    constructor(Bot) {
        super(Bot, {
            name: "myprofile",
            guildOnly: false,
            description: "Show some general stats about your game profile",
            options: [
                {
                    name: "allycode",
                    description: "The ally code for the profile you want view",
                    type: ApplicationCommandOptionType.String,
                },
            ],
        });
    }

    async run(Bot, interaction) {
        // eslint-disable-line no-unused-vars
        const allycodeIn = interaction.options.getString("allycode");
        const allycode = await Bot.getAllyCode(interaction, allycodeIn);
        if (!allycode) {
            return super.error(interaction, `Sorry, but ${allycodeIn} is not a valid allycode`);
        }
        await interaction.reply({content: `> Please wait while I look up the profile for ${allycode}`});

        const cooldown = await Bot.getPlayerCooldown(interaction.user.id, interaction?.guild?.id);
        let player;
        try {
            player = await Bot.swgohAPI.unitStats(allycode, cooldown);
            if (Array.isArray(player)) player = player[0];
        } catch (e) {
            Bot.logger.error(`Broke getting player in myprofile: ${e}`);
            return super.error(interaction, "Please make sure you are registered with a valid ally code");
        }

        if (!player?.stats) {
            return super.error(interaction, "Sorry, but I could not find that player right now.");
        }

        const gpFull = player.stats.find((s) => s.nameKey === "Galactic Power:" || s.nameKey === "STAT_GALACTIC_POWER_ACQUIRED_NAME").value;
        const gpChar = player.stats.find(
            (s) => s.nameKey === "Galactic Power (Characters):" || s.nameKey === "STAT_CHARACTER_GALACTIC_POWER_ACQUIRED_NAME",
        ).value;
        const gpShip = player.stats.find(
            (s) => s.nameKey === "Galactic Power (Ships):" || s.nameKey === "STAT_SHIP_GALACTIC_POWER_ACQUIRED_NAME",
        ).value;

        const rarityMap = {
            ONESTAR: 1,
            TWOSTAR: 2,
            THREESTAR: 3,
            FOURSTAR: 4,
            FIVESTAR: 5,
            SIXSTAR: 6,
            SEVENSTAR: 7,
        };

        const fields = [];

        // Get the mod stats
        const mods = {
            sixPip: 0,
            spd15: 0,
            spd20: 0,
            off100: 0,
        };
        for (const c of player.roster) {
            if (!Number.parseInt(c.rarity, 10)) {
                c.rarity = rarityMap[c.rarity];
            }
            if (c.mods) {
                const six = c.mods.filter((p) => p.pips === 6);
                if (six.length) {
                    mods.sixPip += six.length;
                }
                for (const m of c.mods) {
                    const spd = m.secondaryStat.find((s) => (s.unitStat === 5 || s.unitStat === "UNITSTATSPEED") && s.value >= 15);
                    const off = m.secondaryStat.find((o) => (o.unitStat === 41 || o.unitStat === "UNITSTATOFFENSE") && o.value >= 100);

                    if (spd) {
                        if (spd.value >= 20) {
                            mods.spd20 += 1;
                        } else {
                            mods.spd15 += 1;
                        }
                    }
                    if (off) mods.off100 += 1;
                }
            }
        }
        for (const k of Object.keys(mods)) {
            if (mods[k] === 0) mods[k] = "0";
        }

        const modOut = interaction.language.get("COMMAND_MYPROFILE_MODS", mods);
        fields.push({
            name: ` ${modOut.header}`,
            value: ["```asciidoc", modOut.modStrs, "```"].join("\n"),
        });

        const rarityCount = {
            1: { c: 0, s: 0 },
            2: { c: 0, s: 0 },
            3: { c: 0, s: 0 },
            4: { c: 0, s: 0 },
            5: { c: 0, s: 0 },
            6: { c: 0, s: 0 },
            7: { c: 0, s: 0 },
        };
        const relicTiers = ["baseZero", "LOCKED", "UNLOCKED", 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
        const relicCount = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0 };

        // Get the Character stats
        let zetaCount = 0;
        let omicronCount = 0;
        const charList = player.roster.filter((u) => u.combatType === "CHARACTER" || u.combatType === 1);

        for (const char of charList) {
            rarityCount[char.rarity].c += 1;
            if (char.relic?.currentTier && char.relic.currentTier > 2) {
                if (!relicCount[relicTiers[char.relic.currentTier]]) {
                    relicCount[relicTiers[char.relic.currentTier]] = 0;
                }
                relicCount[relicTiers[char.relic.currentTier]] += 1;
            }
            for (const skill of char.skills) {
                if (skill.isOmicron && skill.isZeta) {
                    if (skill.tier === skill.tiers) {
                        // If it's max level, then it has both zeta and omicron
                        omicronCount += 1;
                        zetaCount += 1;
                    } else if (skill.tier === skill.tiers - 1) {
                        // It's 1 under max level, so it's a zeta
                        zetaCount += 1;
                    }
                } else if (skill.isOmicron && skill.tier === skill.tiers) {
                    // Maxed out omicron skill, so up that
                    omicronCount += 1;
                } else if (skill.isZeta && skill.tier === skill.tiers) {
                    // Maxed out zeta ability, up you go
                    zetaCount += 1;
                }
            }
        }
        const charOut = interaction.language.get(
            "COMMAND_MYPROFILE_CHARS",
            gpChar.toLocaleString(),
            charList,
            zetaCount,
            relicCount,
            omicronCount,
        );
        fields.push({
            name: charOut.header,
            value: ["```asciidoc", charOut.stats, "```"].join("\n"),
        });

        // Get the ship stats
        const shipList = player.roster.filter((u) => u.combatType === "SHIP" || u.combatType === 2);
        for (const ship of shipList) {
            rarityCount[ship.rarity].s += 1;
        }

        const shipOut = interaction.language.get("COMMAND_MYPROFILE_SHIPS", gpShip.toLocaleString(), shipList);
        fields.push({
            name: shipOut.header,
            value: ["```asciidoc", shipOut.stats, "```"].join("\n"),
        });

        //  Show the rarity stats/ averages
        const totalChars = Object.keys(rarityCount)
            .map((r) => rarityCount[r].c)
            .reduce((a, b) => a + b, 0);
        const avgCharRarity = (
            Object.keys(rarityCount)
                .map((r) => Number(r) * rarityCount[r].c)
                .reduce((a, b) => a + b, 0) / totalChars
        ).toFixed(2);
        const totalShips = Object.keys(rarityCount)
            .map((r) => rarityCount[r].s)
            .reduce((a, b) => a + b, 0);
        const avgShipRarity = (
            Object.keys(rarityCount)
                .map((r) => Number(r) * rarityCount[r].s)
                .reduce((a, b) => a + b, 0) / totalShips
        ).toFixed(2);
        fields.push({
            name: interaction.language.get("COMMAND_MYPROFILE_RARITY_HEADER"),
            value: [
                "` * | Char | Ship `",
                Object.keys(rarityCount)
                    .filter((r) => rarityCount[r].c > 0 || rarityCount[r].s > 0)
                    .map((r) =>
                        Bot.expandSpaces(
                            `\` ${r} | ${" ".repeat(4 - rarityCount[r].c.toString().length)}${rarityCount[r].c} | ${" ".repeat(
                                4 - rarityCount[r].s.toString().length,
                            )}${rarityCount[r].s} \``,
                        ),
                    )
                    .join("\n"),
                `\`AVG| ${" ".repeat(4 - avgCharRarity.toString().length)}${avgCharRarity} | ${" ".repeat(
                    4 - avgShipRarity.toString().length,
                )}${avgShipRarity} \``,
            ].join("\n"),
        });

        // Show the relic counts
        const relicOut = Object.keys(relicCount).map((r) => `\`  ${r}  |  ${relicCount[r].toString().padStart(3)} \``);
        fields.push({
            name: interaction.language.get("COMMAND_MYPROFILE_RELIC_HEADER"),
            value: ["`Tier | Count`"].concat(relicOut).join("\n"),
        });

        if (player.warnings) {
            fields.push({
                name: "Warnings",
                value: player.warnings.join("\n"),
            });
        }

        const footerStr = Bot.updatedFooterStr(player.updated, interaction);
        return interaction.editReply({
            content: null,
            embeds: [
                {
                    author: {
                        name: interaction.language.get("COMMAND_MYPROFILE_EMBED_HEADER", player.name, player.allyCode),
                    },
                    // Need 6*, 15/20 spd, and 100 off
                    description: interaction.language.get(
                        "COMMAND_MYPROFILE_DESC",
                        player.guildName,
                        player.level,
                        player.arena.char.rank,
                        player.arena.ship.rank,
                        gpFull.toLocaleString(),
                        mods,
                    ),
                    fields: [...fields, { name: Bot.constants.zws, value: footerStr }],
                },
            ],
        });
    }
}

module.exports = MyProfile;
