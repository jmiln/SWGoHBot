import { ApplicationCommandOptionType, InteractionContextType } from "discord.js";
import Command from "../base/slashCommand.ts";
import config from "../config.js";
import constants from "../data/constants/constants.ts";
import { characters } from "../data/constants/units.ts";
import factionMap from "../data/factionMap.ts";
import cache from "../modules/cache.ts";
import { getAllyCode, msgArray, toProperCase, updatedFooterStr } from "../modules/functions.ts";
import patreonFuncs from "../modules/patreonFuncs.ts";
import swgohAPI from "../modules/swapi.ts";
import type { RawCharacter, SWAPIPlayer, SWAPIUnit } from "../types/swapi_types.ts";
import type { BotInteraction, BotType } from "../types/types.ts";

export default class Faction extends Command {
    static readonly metadata = {
        name: "faction",
        description: "Lookup characters from a faction",
        guildOnly: false,
        contexts: [InteractionContextType.Guild, InteractionContextType.BotDM],
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
    };

    constructor(Bot: BotType) {
        super(Bot, Faction.metadata);
    }

    async run(_Bot: BotType, interaction: BotInteraction) {
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

        const wantsLeader = interaction.options.getBoolean("leader");
        const wantsZeta = interaction.options.getBoolean("zeta");
        let allycode = interaction.options.getString("allycode");
        allycode = await getAllyCode(interaction, allycode, false);

        let extra = "";
        if (wantsLeader && wantsZeta) {
            extra = " with the Leader tag & Zeta abilities";
        } else if (wantsLeader) {
            extra = " with the Leader tag";
        } else if (wantsZeta) {
            extra = " with zeta abilities";
        }

        const factionChars = [];
        const query = faction1 ? faction1 : faction2;
        let chars: RawCharacter[] = await cache.get(
            config.mongodb.swapidb,
            "units",
            { categoryIdList: query, language: interaction.guildSettings.swgohLanguage.toLowerCase() },
            { _id: 0, baseId: 1, nameKey: 1 },
        );
        const searchName = factionMap.find((f) => f.value === query)?.name;

        // Filter out any ships that show up
        chars = chars.filter((c) => characters.find((char) => char.uniqueName === c.baseId));

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
        if (wantsLeader || wantsZeta) {
            const units = [];

            for (const c of chars) {
                const char: RawCharacter = await swgohAPI.getCharacter(c.baseId, interaction.guildSettings.swgohLanguage);
                const isLeader = char.skillReferenceList.some((s) => s.skillId.startsWith("leader"));
                const hasZeta = char.skillReferenceList.some((s) => s.cost?.AbilityMatZeta > 0);
                units.push({
                    char,
                    isLeader,
                    hasZeta,
                });
            }

            if (wantsLeader) {
                chars = chars.filter((c) => {
                    const char = units.find((u) => u.char.baseId === c.baseId);
                    return char.isLeader;
                });
            }
            if (wantsZeta) {
                chars = chars.filter((c) => {
                    const char = units.find((u) => u.char.baseId === c.baseId);
                    return char.hasZeta;
                });
            }
        }
        if (!allycode) {
            return interaction.reply({
                embeds: [
                    {
                        author: {
                            name: `Matches for ${toProperCase(searchName)}${extra}`,
                        },
                        description: chars.map((c) => c.nameKey).join("\n"),
                    },
                ],
            });
        }
        await interaction.deferReply();
        if (chars.length) {
            const charDefIds = chars.map((c) => c.baseId);
            const cooldown = await patreonFuncs.getPlayerCooldown(interaction.user.id, interaction?.guild?.id);
            let player: SWAPIPlayer;
            try {
                const playerRes = await swgohAPI.unitStats(Number.parseInt(allycode, 10), cooldown);
                if (Array.isArray(playerRes)) player = playerRes[0];
            } catch (e) {
                return super.error(interaction, e.message);
            }
            if (!player?.roster?.length) {
                return super.error(interaction, "I couldn't get that player's roster. Please try again later.");
            }
            const playerChars: SWAPIUnit[] = [];
            for (const c of charDefIds) {
                const thisChar = player.roster.find((char) => char.defId === c);
                if (thisChar) {
                    const found = (await swgohAPI.langChar(thisChar, interaction.guildSettings.swgohLanguage)) as SWAPIUnit;
                    playerChars.push(found);
                }
            }

            const gpMax = Math.max(...playerChars.map((c) => c.gp.toLocaleString().length));
            const gearMax = Math.max(...playerChars.map((c) => c.gear.toString().length));
            const lvlMax = Math.max(...playerChars.map((c) => c.level.toString().length));

            factionChars.push(
                `**\`[ * | Lvl${" ".repeat(lvlMax)}|   GP  ${" ".repeat((gpMax > 5 ? 6 : gpMax) - 5)}| ⚙${" ".repeat(gearMax)}]\`**`,
            );
            factionChars.push(`**\`=================${"=".repeat(lvlMax + gpMax + gearMax)}\`**`);

            for (const ch of playerChars) {
                const lvlStr = ch.level.toString().padStart(lvlMax);
                const gpStr = ch.gp.toLocaleString().padStart(gpMax);
                const gearStr = ch.gear.toString().padStart(gearMax);
                const zetas = "z".repeat(
                    ch.skills.filter((s) => (s.isZeta && s.tier === s.tiers) || (s.isOmicron && s.tier >= s.tiers - 1)).length,
                );
                factionChars.push(`**\`[ ${ch.rarity} |  ${lvlStr}  | ${gpStr} | ${gearStr} ]\` ${zetas}${ch.nameKey}**`);
            }
            const msgArr = msgArray(factionChars, "\n", 1000);
            const fields = [];
            let desc: string;
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

            const footerStr = updatedFooterStr(player.updated, interaction);
            return interaction.editReply({
                content: null,
                embeds: [
                    {
                        author: {
                            name: `${player.name}'s matches for ${toProperCase(searchName)}${extra}`,
                        },
                        description: desc,
                        fields: [...fields, { name: constants.zws, value: footerStr }],
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
