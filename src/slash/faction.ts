import { Interaction } from "discord.js";
import SlashCommand from "../base/slashCommand";
import factionMap from "../data/factionMap";
import { APIUnitListChar, APIUnitObj, APIUnitSkill, BotInteraction, BotType, PlayerStatsAccount, UnitObj } from "../modules/types";

class Faction extends SlashCommand {
    constructor(Bot: BotType) {
        super(Bot, {
            name: "faction",
            guildOnly: false,
            category: "Star Wars",
            permissions: ["EMBED_LINKS"],
            options: [
                {
                    name: "faction_group_1",
                    description: "The faction you want to look up",
                    type: Bot.constants.optionType.STRING,
                    choices: factionMap.slice(0, 20)
                },
                {
                    name: "faction_group_2",
                    description: "The faction you want to look up",
                    type: Bot.constants.optionType.STRING,
                    choices: factionMap.slice(20, 40)
                },
                {
                    name: "allycode",
                    description: "Ally code to look up the info for.",
                    type: Bot.constants.optionType.INTEGER,
                },
                {
                    name: "leader",
                    description: "Limit results to characters with the leader tag.",
                    type: Bot.constants.optionType.BOOLEAN
                },
                {
                    name: "zeta",
                    description: "Limit results to characters with abilities that can be zeta'd.",
                    type: Bot.constants.optionType.BOOLEAN
                }
            ]
        });
    }

    async run(Bot: BotType, interaction: BotInteraction) {
        const charList = Bot.characters;

        const faction1 = interaction.options.getString("faction_group_1");
        const faction2 = interaction.options.getString("faction_group_2");

        if (faction1 && faction2) {
            return super.error(interaction, "This command only supports displaying one faction at a time, please don't choose more than that");
        } else if (!faction1 && !faction2) {
            return super.error(interaction, "You need to select a faction to search for");
        }

        const isLeader = interaction.options.getBoolean("leader");
        const isZeta = interaction.options.getBoolean("zeta");
        let allycode = interaction.options.getInteger("allycode");
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
        let chars: APIUnitListChar[] = await Bot.cache.get(Bot.config.mongodb.swapidb, "units",
            {categoryIdList: query, language: interaction.guildSettings.swgohLanguage.toLowerCase()},
            {_id: 0, baseId: 1, nameKey: 1});
        const searchName = factionMap.find(f => f.value === query)?.name;

        // Filter out any ships that show up
        chars = chars.filter((c) => {
            return charList.find((char) => char.uniqueName === c.baseId);
        });

        if (!chars.length) {
            return super.error(interaction, interaction.language.get("COMMAND_FACTION_USAGE", interaction.guildSettings.prefix), {title: interaction.language.get("COMMAND_FACTION_INVALID_FACTION"), example: "faction sith"});
        } else if (chars.length > 40) {
            return super.error(interaction, "Your query came up with too many results, please try and be more specific");
        } else {
            chars = chars.sort((a, b) => a.nameKey.toLowerCase() > b.nameKey.toLowerCase() ? 1 : -1);
        }

        // If they want just characters with leader abilities or zetas, filter em out
        if (isLeader || isZeta) {
            const units: APIUnitListChar[] = [];

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
                    const char = units.find(u => u.baseId === c.baseId);
                    const zetas = char.skillReferenceList.filter((s) => s.cost.AbilityMatZeta > 0);
                    if (zetas.length > 0) return true;
                    return false;
                });
            }
        }
        if (allycode) {
            if (chars.length) {
                const charIds = chars.map((c) => c.baseId);
                const cooldown = await Bot.getPlayerCooldown(interaction.user.id);
                let player: PlayerStatsAccount;
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
                for (const cId of charIds) {
                    let found = player.roster.find((char: APIUnitObj) => char.defId === cId);
                    if (found) {
                        found = await Bot.swgohAPI.langChar(found, interaction.guildSettings.swgohLanguage);
                        playerChars.push(found);
                    }
                }

                const gpMax   = Math.max(...playerChars.map(c => c.gp.toLocaleString().length));
                const gearMax = Math.max(...playerChars.map(c => c.gear.toString().length));
                const lvlMax  = Math.max(...playerChars.map(c => c.level.toString().length));

                factionChars.push(`**\`[ * | Lvl${" ".repeat(lvlMax)}|   GP  ${" ".repeat((gpMax > 5 ?  6 : gpMax) -5)}| ⚙${" ".repeat(gearMax)}]\`**`);
                factionChars.push("**`=================" + "=".repeat(lvlMax + gpMax + gearMax) + "`**");

                playerChars.forEach(c => {
                    const lvlStr  = " ".repeat(lvlMax  - c.level.toString().length) + c.level;
                    const gpStr   = " ".repeat(gpMax   - c.gp.toLocaleString().length) + c.gp.toLocaleString();
                    const gearStr = " ".repeat(gearMax - c.gear.toString().length) + c.gear;
                    const zetas   = "z".repeat(c.skills.filter((s: APIUnitSkill) => (s.isZeta && s.tier === s.tiers) || (s.isOmicron && s.tier >= s.tiers-1)).length);
                    factionChars.push(`**\`[ ${c.rarity} |  ${lvlStr}  | ${gpStr} | ${gearStr} ]\` ${zetas}${c.nameKey}**`);
                });
                const msgArr = Bot.msgArray(factionChars, "\n", 1000);
                const fields = [];
                let desc: string;
                if (msgArr.length > 1) {
                    msgArr.forEach((m: string, ix: number) => {
                        fields.push({
                            name: `${ix+1}`,
                            value: m
                        });
                    });
                } else {
                    desc = msgArr[0];
                }

                const footer = Bot.updatedFooter(player.updated, interaction, "player", cooldown);
                return interaction.reply({embeds: [{
                    author: {
                        name: player.name + "'s matches for " + Bot.toProperCase(searchName) + extra
                    },
                    description: desc,
                    fields: fields,
                    footer: footer
                }]});
            } else {
                return super.error(interaction, interaction.language.get("COMMAND_FACTION_USAGE", interaction.guildSettings.prefix), {title: interaction.language.get("COMMAND_FACTION_INVALID_FACTION"), example: "faction sith"});
            }
        } else {
            return interaction.reply({embeds: [{
                author: {
                    name: "Matches for " + Bot.toProperCase(searchName) + extra
                },
                description: chars.map((c) => c.nameKey).join("\n")
            }]});
        }
    }
}

module.exports = Faction;
