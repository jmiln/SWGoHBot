import { type APIEmbedField, ApplicationCommandOptionType, InteractionContextType } from "discord.js";
import Command from "../base/slashCommand.ts";
import constants from "../data/constants/constants.ts";
import { getAllyCode, getPayoutTimeLeft, makeTable, updatedFooterStr } from "../modules/functions.ts";
import logger from "../modules/Logger.ts";
import { fetchPlayerWithCooldown } from "../modules/patreonFuncs.ts";
import swgohAPI from "../modules/swapi.ts";
import type { SWAPIPlayer } from "../types/swapi_types.ts";
import type { CommandContext } from "../types/types.ts";

// To get the player's arena info (Adapted from shittybill#3024's Scorpio)
export default class MyArena extends Command {
    static readonly metadata = {
        name: "myarena",
        category: "Gamedata",
        contexts: [InteractionContextType.Guild, InteractionContextType.BotDM],
        description: "Show your current ranking in the character & fleet arenas",

        options: [
            {
                name: "allycode",
                description: "The ally code of the user you want to see",
                type: ApplicationCommandOptionType.String,
                autocomplete: true,
            },
            {
                name: "stats",
                type: ApplicationCommandOptionType.Boolean,
                description: "Show some general stats for your arena team",
            },
        ],
    };
    constructor() {
        super(MyArena.metadata);
    }

    async run({ interaction, language, swgohLanguage }: CommandContext) {
        const showStats = interaction.options.getBoolean("stats");
        const ac = interaction.options.getString("allycode");
        const allyCode = await getAllyCode(interaction, ac);

        await interaction.reply({ content: language.get("BASE_SWGOH_PLS_WAIT_FETCH") });

        if (!allyCode) {
            return super.error(
                interaction,
                "Invalid user ID, you need to use either the `me` keyword if you have a registered ally code, an ally code, or mention a Discord user",
            );
        }

        const player = await fetchPlayerWithCooldown(interaction, allyCode);
        if (!player) return super.error(interaction, language.get("BASE_SOMETHING_BROKE"));

        if (!player?.arena) {
            return super.error(interaction, language.get("BASE_SOMETHING_BROKE"));
        }

        const fields: APIEmbedField[] = [];
        const positions = ["L|", "2|", "3|", "4|", "5|"];
        const sPositions = ["L|", "2|", "3|", "4|", "B|", "B|", "B|", "B|"];

        let desc = "";
        if (!showStats) {
            // Grab the arena info
            const shipArena = await getArenaStrings(player, "ship");
            if (shipArena) fields.push(shipArena);

            const charArena = await getArenaStrings(player, "char");
            if (charArena) fields.push(charArena);
        } else {
            // If it's set to show stats, grab all the stats for each unit in the character arena team
            if (!player.arena?.char?.squad?.length) {
                return super.error(interaction, language.get("BASE_SOMETHING_BROKE"));
            }

            const playerStats = player;

            const chars: { pos: string; speed: string | number; health: string | number; prot: string | number; name: string }[] = [];
            for (let ix = 0; ix < player.arena.char.squad.length; ix++) {
                const charId = player.arena.char.squad[ix].defId;
                const unitName = await getUnitName(player, charId);

                const thisChar = playerStats.roster.find((c) => c.defId === charId);
                const speed = thisChar?.stats?.final?.Speed?.toLocaleString() || 0;
                const health = thisChar?.stats?.final?.Health?.toLocaleString() || 0;
                const prot = thisChar?.stats?.final?.Protection?.toLocaleString() || 0;
                chars.push({
                    pos: positions[ix],
                    speed: speed,
                    health: health,
                    prot: prot,
                    name: unitName,
                });
            }
            desc =
                getPayoutLine(player, "char") +
                makeTable(
                    {
                        pos: { value: "", startWith: "`" },
                        speed: { value: "Spd", startWith: "[", endWith: "|" },
                        health: { value: "HP", endWith: "|" },
                        prot: { value: "Prot", endWith: "]`" },
                        name: { value: "", align: "left" },
                    },
                    chars,
                ).join("\n");
        }

        if (player.warnings) {
            fields.push({
                name: "Warnings",
                value: player.warnings.join("\n"),
            });
        }

        const footerStr = updatedFooterStr(player.updated, language);
        return interaction.editReply({
            content: null,
            embeds: [
                {
                    author: {
                        name: language.get("COMMAND_MYARENA_EMBED_HEADER", player.name),
                    },
                    description: desc,
                    fields: [...fields, { name: constants.zws, value: footerStr }],
                },
            ],
        });

        async function getArenaStrings(player: SWAPIPlayer, type = "char") {
            if (!player.arena?.[type]?.squad?.length) return null;
            const arenaArr: string[] = [];
            for (let ix = 0; ix < player.arena[type].squad.length; ix++) {
                const unitId = player.arena[type].squad[ix].defId;
                const unitName = await getUnitName(player, unitId);
                arenaArr.push(`\`${type === "char" ? positions[ix] : sPositions[ix]}\` ${unitName}`);
            }
            return {
                name: language.get(`COMMAND_MYARENA_${type === "char" ? "ARENA" : "FLEET"}`, player.arena[type].rank),
                value: `${getPayoutLine(player, type === "char" ? "char" : "fleet")}${arenaArr.join("\n")}\n\`------------------------------\``,
                inline: true,
            };
        }

        // "Payout: <t:..:t> (<t:..:R>)\n" or "" when the offset is missing from the player data
        function getPayoutLine(player: SWAPIPlayer, arenaType: "char" | "fleet") {
            if (typeof player.poUTCOffsetMinutes !== "number") return "";
            const now = Date.now();
            const payoutAt = Math.floor((now + getPayoutTimeLeft(player.poUTCOffsetMinutes, arenaType, now)) / 1000);
            return `${language.get("COMMAND_MYARENA_PAYOUT")}: <t:${payoutAt}:t> (<t:${payoutAt}:R>)\n`;
        }

        async function getUnitName(player: SWAPIPlayer, defId: string) {
            const thisChar = player.roster.find((c) => c.defId === defId);
            if (!thisChar) {
                logger.error(`[slash/myarena] Missing ID for ${defId}`);
                return `Missing ID for ${defId}`;
            }
            const thisLangChar = await swgohAPI.langChar(thisChar, swgohLanguage);
            const thisZ = thisLangChar.skills.filter((s) => (s.isZeta && s.tier === s.tiers) || (s.isOmicron && s.tier >= s.tiers - 1));
            if (thisLangChar.name && !thisLangChar.nameKey) thisLangChar.nameKey = thisLangChar.name;
            return `${"z".repeat(thisZ.length)}${thisLangChar.nameKey}`;
        }
    }
}
