const Command = require("../base/slashCommand");
const { ApplicationCommandOptionType } = require("discord.js");

class Charactergear extends Command {
    constructor(Bot) {
        super(Bot, {
            name: "charactergear",
            description: "Show the gear required for a specified character",
            guildOnly: false,
            options: [
                {
                    name: "character",
                    autocomplete: true,
                    type: ApplicationCommandOptionType.String,
                    description: "The character you want to see the gear of",
                    required: true
                },
                {
                    name: "allycode",
                    type: ApplicationCommandOptionType.String,
                    description: "An ally code to check the character against"
                },
                {
                    name: "expand",
                    type: ApplicationCommandOptionType.Boolean,
                    description: "Expand the gear pieces to show their parts instead of the whole"
                },
                {
                    name: "gearlevel",
                    type: ApplicationCommandOptionType.Integer,
                    description: "The gear level you want to see the requirements for",
                    minValue: 1,
                    maxValue: 13,
                }
            ]
        });
    }

    async run(Bot, interaction) {
        // Grab the various options
        const doExpand   = interaction.options.getBoolean("expand");
        const gearLvl    = interaction.options.getInteger("gearlevel") || 0;
        const searchChar = interaction.options.getString("character");
        let allycode     = interaction.options.getString("allycode");

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

        let character;
        if (!chars.length) {
            return interaction.channel.send({content: interaction.language.get("BASE_SWGOH_NO_CHAR_FOUND", searchChar)});
        } else if (chars.length > 1) {
            const charL = [];
            const charS = chars.sort((p, c) => p.name > c.name ? 1 : -1);
            charS.forEach(c => {
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
                char.unitTierList.forEach(gTier => {
                    if (doExpand) {
                        allGearList = allGearList.concat(gTier.equipmentSetList);
                    } else {
                        gTier.equipmentSetList.forEach(g => {
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
                        let aNum = parseInt(a.split(" ")[1], 10);
                        let bNum = parseInt(b.split(" ")[1]);
                        if (isNaN(aNum)) aNum = 0;
                        if (isNaN(bNum)) bNum = 0;

                        return aNum - bNum;
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
                const gearList = char.unitTierList.filter(t => t.tier >= gearLvl);
                const fields = [];
                for (const g of gearList) {
                    let f;
                    if (doExpand) {
                        const out = await expandPieces(Bot, g.equipmentSetList);
                        const outK = Object.keys(out).sort((a, b) => parseInt(out[a].mark, 10) - parseInt(out[b].mark, 10));

                        f = {
                            name: `Gear Lvl ${g.tier}`,
                            value: Bot.expandSpaces(outK.map(g =>  "**" + out[g].count + "x** " + " ".repeat(3 - out[g].count.toString().length) + g).join("\n"))
                        };
                    } else {
                        f = {
                            name: "Gear " + g.tier,
                            value: g.equipmentSetList.filter(gname => gname !== "???????").join("\n")
                        };
                    }
                    if (f.value.length > 0) {
                        fields.push(f);
                    }
                }
                return interaction.reply({
                    embeds: [{
                        color: Bot.getSideColor(character.side),
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
            const cooldown = await Bot.getPlayerCooldown(interaction.user.id, interaction?.guild?.id);
            let player = await Bot.swgohAPI.unitStats(allycode, cooldown);
            if (Array.isArray(player)) player = player[0];
            const playerChar = player.roster.find(c => c.defId === character.uniqueName);

            if (!playerChar) {
                return super.error(interaction, "Looks like you don't have this character unlocked");
            } else {
                // They do have the character unlocked.
                // Need to filter out the gear that they already have assigned to the character, then show them what's left

                if (gearLvl && gearLvl < playerChar.gear) {
                    return super.error(interaction, "Looks like you already have all the gear equipped for that level", {title: "Already There"});
                }

                const gearList = char.unitTierList.filter(t => t.tier >= playerChar.gear);

                const fields = [];
                for (const [ix, g] of gearList.entries()) {
                    // Take out any that are already equipped
                    if (gearLvl > 0 && g.tier > gearLvl) return;
                    if (g.tier === playerChar.gear) {
                        const toRemove = playerChar.equipped.map(eq => eq.slot);
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
                            value: "Look like you have the gear maxed out for " + character.name
                        });
                    } else {
                        if (doExpand) {
                            // If they want all the pieces, work on that
                            const out = await expandPieces(Bot, g.equipmentSetList);
                            const outK = Object.keys(out).sort((a, b) => parseInt(out[a].mark, 10) - parseInt(out[b].mark, 10));

                            fields.push({
                                name: `Gear Lvl ${g.tier}`,
                                value: Bot.expandSpaces(outK.map(g =>  "**" + out[g].count + "x** " + " ".repeat(3 - out[g].count.toString().length) + g).join("\n"))
                            });
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
                const totalLen = fields.reduce((acc, cur) => {return acc + cur.value.length;}, 0);
                const footerStr = Bot.updatedFooterStr(player.updated, interaction);
                if (totalLen < 5500) {
                    return interaction.reply({embeds: [{
                        author: {
                            name: (gearLvl > 0) ? `${player.name}'s ${character.name} gear til g${gearLvl}` : `${player.name}'s ${character.name} needs:`
                        },
                        fields: [...fields, {name: Bot.constants.zws, value: footerStr}]
                    }]});
                } else {
                    const half = parseInt(fields.length/2, 10);
                    await interaction.reply({embeds: [{
                        author: {
                            name: (gearLvl > 0) ? `${player.name}'s ${character.name} gear til g${gearLvl}` : `${player.name}'s ${character.name} needs:`
                        },
                        fields: fields.slice(0, half),
                    }]});
                    return await interaction.followUp({embeds: [{
                        title: Bot.constants.zws,
                        fields: [...fields.slice(half), {name: Bot.constants.zws, value: footerStr}]
                    }]});
                }
            }
        }
    }
}

module.exports = Charactergear;

async function expandPieces(Bot, list) {
    let end = [];
    for (const piece of list) {
        const gr = await Bot.cache.get(Bot.config.mongodb.swapidb, "gear", {
            nameKey: piece,
            language: "eng_us"
        }, {
            nameKey: 1,
            recipeId: 1,
            _id: 0
        });

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

async function getParts(Bot, gr, partList=[], amt=1) {
    if (Array.isArray(gr)) gr = gr[0];
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
        if (!rec) return [];
        if (!Array.isArray(rec) && !rec?.ingredientsList) return [];
        if (rec?.ingredientsList) rec = rec.ingredientsList.filter(r => r.id !== "GRIND");
        for (const r of rec) {
            const gear = await Bot.cache.get(Bot.config.mongodb.swapidb, "gear", {
                id: r.id,
                language: "eng_us"
            }, {
                nameKey: 1,
                recipeId: 1,
                _id: 0
            });
            await getParts(Bot, gear, partList, amt * r.maxQuantity);
        }
    } else {
        let mk = gr.nameKey.split(" ")[1];
        mk = isNaN(mk) ? -20 : mk;
        partList.push({name: gr.nameKey, count: amt, mark: mk});
    }

    return partList;
}
