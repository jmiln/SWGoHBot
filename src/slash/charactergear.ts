import { Interaction } from "discord.js";
import SlashCommand from "../base/slashCommand";
import { APIUnitObj, BotInteraction, BotType, TierSkill, UnitObj } from "../modules/types";

import {inspect} from "util";

class Charactergear extends SlashCommand {
    constructor(Bot: BotType) {
        super(Bot, {
            name: "charactergear",
            description: "Show the gear required for a specified character",
            category: "Star Wars",
            guildOnly: false,
            permissions: ["EMBED_LINKS"],
            options: [
                {
                    name: "character",
                    type: Bot.constants.optionType.STRING,
                    description: "The character you want to see the gear of",
                    required: true
                },
                {
                    name: "allycode",
                    type: Bot.constants.optionType.INTEGER,
                    description: "An ally code to check the character against"
                },
                {
                    name: "expand",
                    type: Bot.constants.optionType.BOOLEAN,
                    description: "Expand the gear pieces to show their parts instead of the whole"
                },
                {
                    name: "gearlevel",
                    type: Bot.constants.optionType.INTEGER,
                    description: "The gear level you want to see the requirements for",
                    min_value: 1,
                    max_value: 13,
                }
            ]
        });
    }

    async run(Bot: BotType, interaction: BotInteraction) {
        // Grab the various options
        const doExpand   = interaction.options.getBoolean("expand");
        const gearLvl    = interaction.options.getInteger("gearlevel") || 0;
        const searchChar = interaction.options.getString("character");
        let allycode     = interaction.options.getInteger("allycode");

        // The current max possible gear level
        const MAX_GEAR = 13;

        // Go through and verify as possible
        if (allycode) {
            allycode = await Bot.getAllyCode(interaction, allycode, true);
        }
        if (gearLvl < 0 || gearLvl > MAX_GEAR) {
            return super.error(interaction, `${gearLvl} is not a valid gear level. It must be between 1 and ${MAX_GEAR}`);
        }

        const chars = Bot.findChar(searchChar, Bot.characters);

        let character: UnitObj;
        if (!chars.length) {
            return interaction.channel.send({content: interaction.language.get("BASE_SWGOH_NO_CHAR_FOUND", searchChar)});
        } else if (chars.length > 1) {
            const charL = [];
            const charS = chars.sort((p: UnitObj, c: UnitObj) => p.name > c.name ? 1 : -1);
            charS.forEach((c: UnitObj) => {
                charL.push(c.name);
            });
            return interaction.reply({content: interaction.language.get("BASE_SWGOH_CHAR_LIST", charL.join("\n"))});
        } else {
            character = chars[0];
        }

        const char = await Bot.swgohAPI.getCharacter(character.uniqueName);
        if (!allycode) {
            if (!gearLvl) {
                const allGear = {};
                let allGearList = [];
                char.unitTierList.forEach((gTier: {equipmentSetList: string[]}) => {
                    if (doExpand) {
                        allGearList = allGearList.concat(gTier.equipmentSetList);
                    } else {
                        gTier.equipmentSetList.forEach((g: string) => {
                            if (g === "???????") return;
                            if (!allGear[g]) { // If it's not been checked yet
                                allGear[g] = 1;
                            } else { // It's already in there
                                allGear[g] = allGear[g] + 1;
                            }
                        });
                    }
                });

                let gearString = "";
                if (doExpand) {
                    allGearList = allGearList.filter(g => g !== "???????");
                    const out = await expandPieces(Bot, allGearList);
                    const outK = Object.keys(out).sort((a, b) => parseInt(out[a].mark, 10) - parseInt(out[b].mark, 10));
                    gearString = Bot.expandSpaces(outK.map(g =>  "* " + " ".repeat(3 - out[g].count.toString().length) + out[g].count + "x " + g).join("\n"));
                } else {
                    const sortedGear = Object.keys(allGear).sort((a, b) => {
                        a = a.split(" ")[1];
                        b = b.split(" ")[1];

                        return a > b ? 1 : -1;
                    });
                    for (var key of sortedGear) {
                        gearString += `* ${allGear[key]}x ${key}\n`;
                    }
                }
                const msgArr = Bot.msgArray(interaction.language.get("COMMAND_CHARACTERGEAR_GEAR_ALL", character.name, gearString), "\n", 1900);
                for (const [ix, msg] of msgArr.entries()) {
                    if (ix === 0) {
                        await interaction.reply({content: Bot.codeBlock(msg, "md")});
                    } else if (ix > 0) {
                        await interaction.followUp({content: Bot.codeBlock(msg, "md")});
                    }
                }
            } else {
                // Format and send the requested data back
                const gearList = char.unitTierList.filter((t: {tier: number}) => t.tier >= gearLvl);
                const fields = [];
                for (const g of gearList) {
                    let field: {name: string, value: string};
                    if (doExpand) {
                        const out = await expandPieces(Bot, g.equipmentSetList);
                        const outK = Object.keys(out).sort((a, b) => parseInt(out[a].mark, 10) - parseInt(out[b].mark, 10));

                        field = {
                            name: `Gear Lvl ${g.tier}`,
                            value: Bot.expandSpaces(outK.map(g =>  "**" + out[g].count + "x** " + " ".repeat(3 - out[g].count.toString().length) + g).join("\n"))
                        };
                    } else {
                        field = {
                            name: "Gear " + g.tier,
                            value: g.equipmentSetList.filter((gname: string) => gname !== "???????").join("\n")
                        };
                    }
                    if (field.value.length > 0) {
                        fields.push(field);
                    }
                }
                return interaction.reply({
                    embeds: [{
                        "color": `${character.side === "light" ? "#5114e0" : "#e01414"}`,
                        "author": {
                            "name": character.name,
                            "url": character.url,
                            "icon_url": character.avatarURL
                        },
                        "fields": fields
                    }]
                });
            }
        } else {
            // Looking for a player's remaining needed gear
            await interaction.reply("Please wait while I find your info.");
            const cooldown = await Bot.getPlayerCooldown(interaction.user.id);
            let player = await Bot.swgohAPI.unitStats(allycode, cooldown);
            if (Array.isArray(player)) player = player[0];
            const playerChar = player.roster.find((c: APIUnitObj) => c.defId === character.uniqueName);

            if (!playerChar) {
                return super.error(interaction, "Looks like you don't have this character unlocked");
            } else {
                // They do have the character unlocked.
                // Need to filter out the gear that they already have assigned to the character, then show them what's left

                if (gearLvl && gearLvl < playerChar.gear) {
                    return super.error(interaction, "Looks like you already have all the gear equipped for that level", {title: "Already There"});
                }

                const gearList = char.unitTierList.filter((t: {tier: number}) => t.tier >= playerChar.gear);

                const fields = [];
                for (const [ix, g] of gearList.entries()) {
                    if (g.tier === 13) continue;
                    // Take out any that are already equipped
                    if (gearLvl > 0 && g.tier > gearLvl) return;
                    if (g.tier === playerChar.gear) {
                        const toRemove = playerChar.equipped.map((eq: {slot: number}) => eq.slot);
                        while (toRemove.length) {
                            g.equipmentSetList.splice(toRemove.pop(), 1);
                        }
                    }

                    if (g.tier === 12 && ix === 0 && g.equipmentSetList.length === 0) {
                        fields.push({
                            name: "Congrats!",
                            value: "Look like you have the gear maxed out for " + character.name
                        });
                    } else {
                        if (doExpand) {
                        // If they want all the pieces, work on that
                            const out = await expandPieces(Bot, g.equipmentSetList);
                            const outK = Object.keys(out).sort((a, b) => parseInt(out[a].mark, 10) - parseInt(out[b].mark, 10));

                            const formattedOut = outK.map(g =>  "**" + out[g].count + "x** " + " ".repeat(3 - out[g].count.toString().length) + g)
                            const fieldChunks = Bot.chunkArray(formattedOut, 1024);
                            for (const [ ix, chunk ] of fieldChunks.entries()) {
                                fields.push({
                                    name: ix === 0 ? `Gear Lvl ${g.tier}` : "-",
                                    value: chunk.join("\n")
                                });
                            }
                        } else {
                            fields.push({
                                name: `Gear Lvl ${g.tier}`,
                                value: g.equipmentSetList.join("\n")
                            });
                        }
                    }
                }
                if (player.warnings) {
                    fields.push({
                        name: "Warnings",
                        value: player.warnings.join("\n")
                    });
                }
                const footer = Bot.updatedFooter(player.updated, interaction, "player", cooldown);
                return interaction.editReply({embeds: [{
                    author: {
                        name: (gearLvl > 0) ? `${player.name}'s ${character.name} gear til g${gearLvl}` : `${player.name}'s ${character.name} needs:`
                    },
                    fields: fields,
                    footer: footer
                }]});
            }
        }
    }
}

module.exports = Charactergear;

async function expandPieces(Bot: BotType, list: string[]) {
    let end = [];
    for (const piece of list) {
        let gr = await Bot.cache.get(Bot.config.mongodb.swapidb, "gear", {
            nameKey: piece,
            language: "eng_us"
        }, {
            nameKey: 1,
            recipeId: 1,
            _id: 0
        });

        if (Array.isArray(gr)) {
            gr = gr[0];
        }
        const pieces = await getParts(Bot, gr);
        end = end.concat(pieces);
    }

    const out = {};
    end.forEach(g => {
        if (out[g.name]) {
            out[g.name].count += g.count;
        } else {
            out[g.name] = {
                count: g.count,
                mark: g.mark
            };
        }
    });
    return out;
}

async function getParts(Bot: BotType, gr: TierSkill, partList=[], amt=1) {
    if (!gr) return;
    if (gr.recipeId?.length) {
        let rec = await Bot.cache.get(Bot.config.mongodb.swapidb, "recipes", {
            id: gr.recipeId,
            language: "eng_us"
        },
        {
            ingredientsList: 1,
            _id: 0
        });
        if (Array.isArray(rec)) rec = rec[0];
        if (rec.ingredientsList) rec = rec.ingredientsList.filter((r: {id: string}) => r.id !== "GRIND");
        for (const r of rec) {
            let gear = await Bot.cache.get(Bot.config.mongodb.swapidb, "gear", {
                id: r.id,
                language: "eng_us"
            }, {
                nameKey: 1,
                recipeId: 1,
                _id: 0
            });
            if (Array.isArray(gear)) gear = gear[0];
            await getParts(Bot, gear, partList, amt * r.maxQuantity);
        }
    } else {
        let mk: string | number = gr.nameKey.split(" ")[1];
        mk = isNaN(parseInt(mk, 10)) ? -20 : mk;
        partList.push({name: gr.nameKey, count: amt, mark: mk});
    }

    return partList;
}
