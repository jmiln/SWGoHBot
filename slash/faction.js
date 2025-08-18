import { ApplicationCommandOptionType } from "discord.js";
import Command from "../base/slashCommand.js";
import factionMap from "../data/factionMap.js";

export default class Faction extends Command {
    constructor(Bot) {
        super(Bot, {
            name: "faction",
            guildOnly: false,
            options: [
                {
                    name: "faction_group_1",
                    description: "The faction you want to look up",
                    type: ApplicationCommandOptionType.String,
                    choices: factionMap.slice(0, 20),
                },
                {
                    name: "faction_group_2",
                    description: "The faction you want to look up",
                    type: ApplicationCommandOptionType.String,
                    choices: factionMap.slice(20, 40),
                },
                {
                    name: "allycode",
                    description: "Ally code to look up the info for.",
                    type: ApplicationCommandOptionType.String,
                },
                {
                    name: "leader",
                    description: "Limit results to characters with the leader tag.",
                    type: ApplicationCommandOptionType.Boolean,
                },
                {
                    name: "zeta",
                    description: "Limit results to characters with abilities that can be zeta'd.",
                    type: ApplicationCommandOptionType.Boolean,
                },
            ],
        });
    }

    async run(Bot, interaction) {
        const charList = Bot.characters;

        const faction1 = interaction.options.getString("faction_group_1");
        const faction2 = interaction.options.getString("faction_group_2");

        if (faction1 && faction2) {
            return super.error(
                interaction,
                "This command only supports displaying one faction at a time, please don't choose more than that",
            );
        }
        if (!faction1 && !faction2) {
            return super.error(interaction, "You need to select a faction to search for");
        }

        const isLeader = interaction.options.getBoolean("leader");
        const isZeta = interaction.options.getBoolean("zeta");
        let allycode = interaction.options.getString("allycode");
        allycode = await Bot.getAllyCode(interaction, allycode, false);

        let extra = "";
        if (isLeader && isZeta) {
            extra = " with the Leader tag & Zeta abilities";
        } else if (isLeader) {
            extra = " with the Leader tag";
        } else if (isZeta) {
            extra = " with zeta abilities";
        }

        const factionChars = [];
        const query = faction1 ? faction1 : faction2;
        let chars = await Bot.cache.get(
            Bot.config.mongodb.swapidb,
            "units",
            { categoryIdList: query, language: interaction.guildSettings.swgohLanguage.toLowerCase() },
            { _id: 0, baseId: 1, nameKey: 1 },
        );
        const searchName = factionMap.find((f) => f.value === query)?.name;

        // Filter out any ships that show up
        chars = chars.filter((c) => charList.find((char) => char.uniqueName === c.baseId));

        if (!chars.length) {
            return super.error(interaction, interaction.language.get("COMMAND_FACTION_USAGE"), {
                title: interaction.language.get("COMMAND_FACTION_INVALID_FACTION"),
                example: "faction sith",
            });
        }
        if (chars.length > 40) {
            return super.error(interaction, "Your query came up with too many results, please try and be more specific");
        }
        chars = chars.sort((a, b) => (a.nameKey.toLowerCase() > b.nameKey.toLowerCase() ? 1 : -1));

        // If they want just characters with leader abilities or zetas, filter em out
        if (isLeader || isZeta) {
            const units = [];

            for (const c of chars) {
                const char = await Bot.swgohAPI.getCharacter(c.baseId, interaction.guildSettings.swgohLanguage);
                units.push(char);
            }

            if (isLeader) {
                chars = chars.filter((c) => {
                    const char = units.find((u) => u.baseId === c.baseId);
                    const leader = char.skillReferenceList.filter((s) => s.skillId.startsWith("leader"));
                    if (leader.length) return true;
                    return false;
                });
            }
            if (isZeta) {
                chars = chars.filter((c) => {
                    const char = units.find((u) => u.baseId === c.baseId);
                    const zetas = char.skillReferenceList.filter((s) => s.cost.AbilityMatZeta > 0);
                    if (zetas.length > 0) return true;
                    return false;
                });
            }
        }
        if (!allycode) {
            return interaction.reply({
                embeds: [
                    {
                        author: {
                            name: `Matches for ${Bot.toProperCase(searchName)}${extra}`,
                        },
                        description: chars.map((c) => c.nameKey).join("\n"),
                    },
                ],
            });
        }
        if (chars.length) {
            chars = chars.map((c) => c.baseId);
            const cooldown = await Bot.getPlayerCooldown(interaction.user.id, interaction?.guild?.id);
            let player;
            try {
                player = await Bot.swgohAPI.unitStats(allycode, cooldown);
                if (Array.isArray(player)) player = player[0];
            } catch (e) {
                return super.error(interaction, e.message);
            }
            if (!player?.roster?.length) {
                return super.error(interaction, "I couldn't get that player's roster. Please try again later.");
            }
            const playerChars = [];
            for (const c of chars) {
                let found = player.roster.find((char) => char.defId === c);
                if (found) {
                    found = await Bot.swgohAPI.langChar(found, interaction.guildSettings.swgohLanguage);
                    found.gp = found.gp.toLocaleString();
                    playerChars.push(found);
                }
            }

            const gpMax = Math.max(...playerChars.map((c) => c.gp.length));
            const gearMax = Math.max(...playerChars.map((c) => c.gear.toString().length));
            const lvlMax = Math.max(...playerChars.map((c) => c.level.toString().length));

            factionChars.push(
                `**\`[ * | Lvl${" ".repeat(lvlMax)}|   GP  ${" ".repeat((gpMax > 5 ? 6 : gpMax) - 5)}| ⚙${" ".repeat(gearMax)}]\`**`,
            );
            factionChars.push(`**\`=================${"=".repeat(lvlMax + gpMax + gearMax)}\`**`);

            for (const ch of playerChars) {
                const lvlStr = ch.level.toString().padStart(lvlMax - ch.level.toString().length);
                const gpStr = ch.gp.toString().padStart(gpMax - ch.gp.length);
                const gearStr = ch.gear.toString().padStart(gearMax - ch.gear.toString().length);
                const zetas = "z".repeat(
                    ch.skills.filter((s) => (s.isZeta && s.tier === s.tiers) || (s.isOmicron && s.tier >= s.tiers - 1)).length,
                );
                factionChars.push(`**\`[ ${ch.rarity} |  ${lvlStr}  | ${gpStr} | ${gearStr} ]\` ${zetas}${ch.nameKey}**`);
            }
            const msgArr = Bot.msgArray(factionChars, "\n", 1000);
            const fields = [];
            let desc;
            if (msgArr.length > 1) {
                msgArr.forEach((m, ix) => {
                    fields.push({
                        name: `${ix + 1}`,
                        value: m,
                    });
                });
            } else {
                desc = msgArr[0];
            }

            const footerStr = Bot.updatedFooterStr(player.updated, interaction);
            return interaction.reply({
                embeds: [
                    {
                        author: {
                            name: `${player.name}'s matches for ${Bot.toProperCase(searchName)}${extra}`,
                        },
                        description: desc,
                        fields: [...fields, { name: Bot.constants.zws, value: footerStr }],
                    },
                ],
            });
        }
        return super.error(interaction, interaction.language.get("COMMAND_FACTION_USAGE"), {
            title: interaction.language.get("COMMAND_FACTION_INVALID_FACTION"),
            example: "faction sith",
        });
    }
}
