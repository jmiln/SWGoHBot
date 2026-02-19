import { ApplicationCommandOptionType, codeBlock, InteractionContextType } from "discord.js";
import Command from "../base/slashCommand.ts";
import { env } from "../config/config.ts";
import constants from "../data/constants/constants.ts";
import { characters } from "../data/constants/units.ts";
import cache from "../modules/cache.ts";
import { expandSpaces, findChar, getAllyCode, getSideColor, msgArray, updatedFooterStr } from "../modules/functions.ts";
import patreonFuncs from "../modules/patreonFuncs.ts";
import swgohAPI from "../modules/swapi.ts";
import type { RawCharacter, SWAPIGearRecipe, SWAPIIngredient, SWAPIPlayer, SWAPIRecipe } from "../types/swapi_types.ts";
import type { BotUnit, CommandContext } from "../types/types.ts";

export default class Charactergear extends Command {
    static readonly metadata = {
        name: "charactergear",
        category: "Gamedata",
        description: "Show the gear required for a specified character",
        guildOnly: false,
        contexts: [InteractionContextType.Guild, InteractionContextType.BotDM],

        options: [
            {
                name: "character",
                autocomplete: true,
                type: ApplicationCommandOptionType.String,
                description: "The character you want to see the gear of",
                required: true,
            },
            {
                name: "allycode",
                type: ApplicationCommandOptionType.String,
                autocomplete: true,
                description: "An ally code to check the character against",
            },
            {
                name: "expand",
                type: ApplicationCommandOptionType.Boolean,
                description: "Expand the gear pieces to show their parts instead of the whole",
            },
            {
                name: "gearlevel",
                type: ApplicationCommandOptionType.Integer,
                description: "The gear level you want to see the requirements for",
                minValue: 1,
                maxValue: 13,
            },
        ],
    };

    constructor() {
        super(Charactergear.metadata);
    }

    async run({ interaction, language }: CommandContext) {
        // Grab the various options
        const doExpand = interaction.options.getBoolean("expand");
        const gearLvl = interaction.options.getInteger("gearlevel") || 0;
        const searchChar = interaction.options.getString("character");
        let allycode = interaction.options.getString("allycode");

        // The current max possible gear level
        const MAX_GEAR = 13;

        // Go through and verify as possible
        if (allycode) {
            allycode = await getAllyCode(interaction, allycode, true);
        }
        if (gearLvl < 0 || gearLvl > MAX_GEAR) {
            return super.error(interaction, `${gearLvl} is not a valid gear level. It must be between 1 and ${MAX_GEAR}`);
        }

        const chars = findChar(searchChar, characters);

        let character: BotUnit;
        if (!chars.length) {
            return super.error(interaction, language.get("BASE_SWGOH_NO_CHAR_FOUND", searchChar));
        }
        if (chars.length > 1) {
            const charL = [];
            const charS = chars.sort((p, c) => (p.name > c.name ? 1 : -1));
            for (const ch of charS) {
                charL.push(ch.name);
            }
            return super.error(interaction, language.get("BASE_SWGOH_CHAR_LIST", charL.join("\n")));
        }
        character = chars[0];

        let char: RawCharacter;
        try {
            char = await swgohAPI.getCharacter(character.uniqueName);
        } catch (_) {
            return super.error(interaction, "There was an error fetching character data. Please try again later.");
        }

        if (!allycode) {
            if (!gearLvl) {
                const allGear = {};
                let allGearList = [];
                for (const gTier of char.unitTierList) {
                    if (doExpand) {
                        allGearList = allGearList.concat(gTier.equipmentSetList);
                    } else {
                        for (const g of gTier.equipmentSetList) {
                            if (g === "???????") continue;
                            if (!allGear[g]) {
                                // If it's not been checked yet
                                allGear[g] = 1;
                            } else {
                                // It's already in there
                                allGear[g] = allGear[g] + 1;
                            }
                        }
                    }
                }

                let gearString = "";
                if (doExpand) {
                    allGearList = allGearList.filter((g) => g !== "???????");
                    const out = await expandPieces(allGearList);
                    const outK = Object.keys(out).sort((a, b) => Number.parseInt(out[a].mark, 10) - Number.parseInt(out[b].mark, 10));
                    gearString = expandSpaces(
                        outK.map((g) => `*${" ".repeat(3 - out[g].count.toString().length)}${out[g].count}x${g}`).join("\n"),
                    );
                } else {
                    const sortedGear = Object.keys(allGear).sort((a, b) => {
                        let aNum = Number.parseInt(a.split(" ")[1], 10);
                        let bNum = Number.parseInt(b.split(" ")[1], 10);
                        if (Number.isNaN(aNum)) aNum = 0;
                        if (Number.isNaN(bNum)) bNum = 0;

                        return aNum - bNum;
                    });
                    for (const key of sortedGear) {
                        gearString += `* ${allGear[key]}x ${key}\n`;
                    }
                }
                const msgArr = msgArray(language.get("COMMAND_CHARACTERGEAR_GEAR_ALL", character.name, gearString), "\n", 1900);
                for (const [ix, msg] of msgArr.entries()) {
                    if (ix === 0) {
                        await interaction.reply({ content: codeBlock("md", msg) });
                    } else if (ix > 0) {
                        await interaction.followUp({ content: codeBlock("md", msg) });
                    }
                }
            } else {
                // Format and send the requested data back
                const gearList = char.unitTierList.filter((t) => t.tier >= gearLvl);
                const fields = [];
                for (const g of gearList) {
                    let f: { name: string; value: string };
                    if (doExpand) {
                        const out = await expandPieces(g.equipmentSetList);
                        const outK = Object.keys(out).sort((a, b) => Number.parseInt(out[a].mark, 10) - Number.parseInt(out[b].mark, 10));

                        f = {
                            name: `Gear Lvl ${g.tier}`,
                            value: expandSpaces(
                                outK.map((g) => `**${out[g].count}x** ${" ".repeat(3 - out[g].count.toString().length)}${g}`).join("\n"),
                            ),
                        };
                    } else {
                        f = {
                            name: `Gear ${g.tier}`,
                            value: g.equipmentSetList.filter((gname) => gname !== "???????").join("\n"),
                        };
                    }
                    if (f.value.length > 0) {
                        fields.push(f);
                    }
                }
                return interaction.reply({
                    content: null,
                    embeds: [
                        {
                            color: getSideColor(character.side),
                            author: {
                                name: character.name,
                                url: character.url,
                                icon_url: character.avatarURL,
                            },
                            fields: fields,
                        },
                    ],
                });
            }
        } else {
            // Looking for a player's remaining needed gear
            const cooldown = await patreonFuncs.getPlayerCooldown(interaction.user.id, interaction?.guild?.id);
            let player: SWAPIPlayer;
            player = await swgohAPI.player(allycode, cooldown);

            if (!player?.roster) {
                return super.error(
                    interaction,
                    "Sorry, but I'm having trouble getting your roster. Please make sure you have the correct ally code, and try again in a bit.",
                );
            }

            const playerChar = player.roster.find((c) => c.defId === character.uniqueName);

            if (!playerChar) {
                return super.error(interaction, "Looks like you don't have this character unlocked");
            }
            // They do have the character unlocked.
            // Need to filter out the gear that they already have assigned to the character, then show them what's left

            if (gearLvl && gearLvl < playerChar.gear) {
                return super.error(interaction, "Looks like you already have all the gear equipped for that level", {
                    title: "Already There",
                });
            }

            const gearList = char.unitTierList.filter((t) => t.tier >= playerChar.gear);

            const fields = [];
            for (const [ix, g] of gearList.entries()) {
                // Take out any that are already equipped
                if (gearLvl > 0 && g.tier > gearLvl) continue;
                if (g.tier === playerChar.gear) {
                    const toRemove = playerChar.equipped.map((eq) => eq.slot);
                    while (toRemove.length) {
                        g.equipmentSetList.splice(toRemove.pop(), 1);
                    }
                }
                // Take out the unknown ones
                if (g.equipmentSetList.indexOf("???????") > -1) {
                    g.equipmentSetList.splice(g.equipmentSetList.indexOf("???????"), 1);
                }
                if (g.tier === 12 && ix === 0 && g.equipmentSetList.length === 0) {
                    fields.push({
                        name: "Congrats!",
                        value: `Look like you have the gear maxed out for ${character.name}`,
                    });
                } else {
                    if (doExpand) {
                        // If they want all the pieces, work on that
                        const out = await expandPieces(g.equipmentSetList);
                        const outK = Object.keys(out).sort((a, b) => Number.parseInt(out[a].mark, 10) - Number.parseInt(out[b].mark, 10));

                        fields.push({
                            name: `Gear Lvl ${g.tier}`,
                            value: expandSpaces(
                                outK.map((g) => `**${out[g].count}x** ${" ".repeat(3 - out[g].count.toString().length)}${g}`).join("\n"),
                            ),
                        });
                    } else {
                        fields.push({
                            name: `Gear Lvl ${g.tier}`,
                            value: g.equipmentSetList.join("\n"),
                        });
                    }
                }
            }
            if (player.warnings?.length) {
                fields.push({
                    name: "Warnings",
                    value: player.warnings.join("\n"),
                });
            }
            const totalLen = fields.reduce((acc, cur) => {
                return acc + cur.value.length;
            }, 0);
            const footerStr = updatedFooterStr(player.updated, language);
            if (totalLen < 5500) {
                return interaction.reply({
                    embeds: [
                        {
                            author: {
                                name:
                                    gearLvl > 0
                                        ? `${player.name}'s ${character.name} gear til g${gearLvl}`
                                        : `${player.name}'s ${character.name} needs:`,
                            },
                            fields: [...fields, { name: constants.zws, value: footerStr }],
                        },
                    ],
                });
            }
            const half = Math.floor(fields.length / 2);
            await interaction.reply({
                embeds: [
                    {
                        author: {
                            name:
                                gearLvl > 0
                                    ? `${player.name}'s ${character.name} gear til g${gearLvl}`
                                    : `${player.name}'s ${character.name} needs:`,
                        },
                        fields: fields.slice(0, half),
                    },
                ],
            });
            return await interaction.followUp({
                embeds: [
                    {
                        title: constants.zws,
                        fields: [...fields.slice(half), { name: constants.zws, value: footerStr }],
                    },
                ],
            });
        }
    }
}

async function expandPieces(list: string[]) {
    let end = [];
    for (const piece of list) {
        const gr = await cache.get(
            env.MONGODB_SWAPI_DB,
            "gear",
            {
                nameKey: piece,
                language: "eng_us",
            },
            {
                nameKey: 1,
                recipeId: 1,
                _id: 0,
            },
        );

        const pieces = await getParts(gr as never);
        end = end.concat(pieces);
    }

    const out = {};
    for (const g of end) {
        if (out[g.name]) {
            out[g.name].count += g.count;
        } else {
            out[g.name] = {
                count: g.count,
                mark: g.mark,
            };
        }
    }
    return out;
}

// gr is gear recipe?
async function getParts(gr: SWAPIGearRecipe, partList: { name: string; count: number; mark: string }[] = [], amt = 1) {
    if (!gr) return [];
    const gearPiece = Array.isArray(gr) ? gr[0] : gr;
    if (gearPiece.recipeId?.length) {
        const recArr = await cache.get(
            env.MONGODB_SWAPI_DB,
            "recipes",
            {
                id: gearPiece.recipeId,
                language: "eng_us",
            },
            {
                ingredients: 1,
                _id: 0,
            },
        );
        const rec = recArr[0] as SWAPIRecipe;
        if (!rec) return [];
        if (!Array.isArray(rec) && !rec?.ingredients) return [];
        const thisRec = rec.ingredients.filter((r: SWAPIIngredient) => r.id !== "GRIND");
        for (const r of thisRec) {
            const gear = await cache.get(
                env.MONGODB_SWAPI_DB,
                "gear",
                {
                    id: r.id,
                    language: "eng_us",
                },
                {
                    nameKey: 1,
                    recipeId: 1,
                    _id: 0,
                },
            );
            await getParts(gear as never, partList, amt * r.maxQuantity);
        }
    } else {
        let mk = gearPiece.nameKey.split(" ")[1];
        mk = Number.isNaN(mk) ? -20 : mk;
        partList.push({ name: gearPiece.nameKey, count: amt, mark: mk });
    }

    return partList;
}
