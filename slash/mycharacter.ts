import { inspect } from "node:util";
import { ApplicationCommandOptionType, codeBlock, InteractionContextType } from "discord.js";
import Command from "../base/slashCommand.ts";
import constants from "../data/constants/constants.ts";
import { characters, ships } from "../data/constants/units.ts";
import { expandSpaces, findChar, getAllyCode, getUnitImage, msgArray, toProperCase, updatedFooterStr } from "../modules/functions.ts";
import logger from "../modules/Logger.ts";
import patreonFuncs from "../modules/patreonFuncs.ts";
import swgohAPI from "../modules/swapi.ts";
import type { SWAPIPlayer } from "../types/swapi_types.ts";
import type { CommandContext } from "../types/types.ts";

export default class MyCharacter extends Command {
    static readonly metadata = {
        name: "mycharacter",
        description: "Display overall stats & mod info for the selected character",
        category: "Gamedata",

        guildOnly: false,
        contexts: [InteractionContextType.Guild, InteractionContextType.BotDM],
        enabled: true,
        options: [
            {
                name: "character",
                description: "Show the stats for a specified character",
                type: ApplicationCommandOptionType.Subcommand,
                options: [
                    {
                        name: "character",
                        autocomplete: true,
                        required: true,
                        type: ApplicationCommandOptionType.String,
                        description: "The character you want to show the stats of",
                    },
                    {
                        name: "allycode",
                        description: "The ally code for whoever you're wanting to look up",
                        type: ApplicationCommandOptionType.String,
                        autocomplete: true,
                    },
                ],
            },
            {
                name: "ship",
                description: "Show the stats for a specified ship",
                type: ApplicationCommandOptionType.Subcommand,
                options: [
                    {
                        name: "ship",
                        autocomplete: true,
                        required: true,
                        type: ApplicationCommandOptionType.String,
                        description: "The ship you want to show the stats of",
                    },
                    {
                        name: "allycode",
                        description: "The ally code for whoever you're wanting to look up",
                        type: ApplicationCommandOptionType.String,
                        autocomplete: true,
                    },
                ],
            },
        ],
    };
    constructor() {
        super(MyCharacter.metadata);
    }

    async run({ interaction, language, swgohLanguage }: CommandContext) {
        const searchType = interaction.options.getSubcommand();
        const searchUnit = searchType === "character" ? interaction.options.getString("character") : interaction.options.getString("ship");
        let allycode = interaction.options.getString("allycode");
        allycode = await getAllyCode(interaction, allycode);

        if (!allycode) {
            return super.error(interaction, "I could not find a valid allycode. Please make sure you're using a valid code.");
        }

        // Get any matching units
        const units = findChar(searchUnit, searchType === "ship" ? ships : characters, true);

        // If there are no results or too many results, let the user know
        if (units.length === 0) {
            return super.error(interaction, language.get("BASE_SWGOH_NO_CHAR_FOUND", searchUnit));
        }
        if (units.length > 1) {
            const sortedUnitList = units.sort((p, c) => (p.name > c.name ? 1 : -1));
            const unitList = sortedUnitList.map((u) => u.name);
            return super.error(interaction, language.get("BASE_SWGOH_CHAR_LIST", unitList.join("\n")));
        }

        // If there's nothing wrong above, grab the single unit and go from there
        const unit = units[0];

        await interaction.reply({ content: "Please wait while I look up your profile." });

        const cooldown = await patreonFuncs.getPlayerCooldown(interaction.user.id, interaction?.guild?.id);
        let player: SWAPIPlayer = null;
        try {
            player = await swgohAPI.player(allycode, cooldown);
        } catch (e) {
            logger.error(`[slash/mycharacter] Error: ${e}`);
            return super.error(interaction, codeBlock(e.message), {
                title: language.get("BASE_SOMETHING_BROKE"),
                footer: "Please try again in a bit.",
            });
        }

        if (!player?.roster || !player?.updated) {
            return super.error(interaction, "I could not find any player with that ally code, please double check that it's correct");
        }

        const pName = player.name;
        const footerStr = updatedFooterStr(player.updated, language);

        const thisUnit = player.roster.find((c) => c.defId === unit.uniqueName);

        // The user doesn't have the unit unlocked, so let em know
        if (!thisUnit) {
            const outStr = language.get("BASE_SWGOH_LOCKED_CHAR");
            return super.error(interaction, outStr || "This character is locked.", {
                title: `${pName}'s ${unit.name}`,
                footer: footerStr,
            });
        }

        const thisLangChar = await swgohAPI.langChar(thisUnit, swgohLanguage);

        const stats = thisUnit.stats;
        const isShip = thisUnit.combatType === 2;

        const abilities = {
            basic: [],
            special: [],
            leader: [],
            unique: [],
            contract: [],
            crew: [],
            hardware: [],
        };

        let gearStr: string;
        if (searchType === "character") {
            gearStr = ["   [0]  [3]", "[1]       [4]", "   [2]  [5]"].join("\n");
            for (const e of thisUnit.equipped) {
                gearStr = gearStr.replace(e.slot.toString(), "X");
            }
            gearStr = gearStr.replace(/[0-9]/g, "  ");
            gearStr = expandSpaces(gearStr);
        }
        if (!thisLangChar.skills) {
            logger.log(JSON.stringify(thisLangChar));
        } else {
            for (const a of thisLangChar.skills) {
                a.type = toProperCase(a.id.split("skill")[0]);
                if (a.tier === a.tiers) {
                    if (a.isOmicron) {
                        // Maxed Omicron ability
                        a.tierStr = "Max O";
                    } else if (a.isZeta) {
                        // Maxed Zeta ability
                        a.tierStr = "Max ✦";
                    } else if (isShip) {
                        a.tierStr = "Max";
                    } else {
                        // Maxed Omega ability
                        a.tierStr = "Max ⭓";
                    }
                } else {
                    // Unmaxed ability
                    a.tierStr = `Lvl ${a.tier}`;
                }
                try {
                    abilities[`${a.type ? a.type.toLowerCase() : a.defId.toLowerCase()}`].push(
                        `\`${a.tierStr} [${a.type ? a.type.charAt(0) : a.defId.charAt(0)}]\` ${a.nameKey}`,
                    );
                } catch (err) {
                    logger.error(`ERROR[MC]: bad ability type: ${inspect(a)} - Error: ${err instanceof Error ? err.message : String(err)}`);
                }
            }
        }

        const abilitiesOut = abilities.basic
            .concat(abilities.special)
            .concat(abilities.leader)
            .concat(abilities.unique)
            .concat(abilities.crew)
            .concat(abilities.contract)
            .concat(abilities.hardware);

        const statNames = {
            "Primary Attributes": ["Strength", "Agility", "Intelligence"],
            General: ["Health", "Protection", "Speed", "Critical Damage", "Potency", "Tenacity", "Health Steal"],
            "Physical Offense": ["Physical Damage", "Physical Critical Chance", "Armor Penetration", "Accuracy"],
            "Physical Survivability": ["Armor", "Dodge Chance", "Critical Avoidance"],
            "Special Offense": ["Special Damage", "Special Critical Chance", "Resistance Penetration", "Accuracy"],
            "Special Survivability": ["Resistance", "Deflection Chance", "Critical Avoidance"],
        };

        const langStr = language.get("BASE_STAT_NAMES");
        const langMap = {
            "Primary Attributes": "PRIMARY",
            Strength: "STRENGTH",
            Agility: "AGILITY",
            Intelligence: "TACTICS",
            General: "GENERAL",
            Health: "HEALTH",
            Protection: "PROTECTION",
            Speed: "SPEED",
            "Critical Damage": "CRITDMG",
            Potency: "POTENCY",
            Tenacity: "TENACITY",
            "Health Steal": "HPSTEAL",
            "Defense Penetration": "DEFENSEPEN",
            "Physical Accuracy": "ACCURACY",
            "Physical Offense": "PHYSOFF",
            "Physical Damage": "PHYSDMG",
            "Physical Critical Chance": "PHYSCRIT",
            "Physical Critical Rating": "PHYSCRIT",
            "Armor Penetration": "ARMORPEN",
            Accuracy: "ACCURACY",
            "Physical Survivability": "PHYSSURV",
            Armor: "ARMOR",
            "Dodge Chance": "DODGECHANCE",
            "Critical Avoidance": "CRITAVOID",
            "Special Offense": "SPECOFF",
            "Special Damage": "SPECDMG",
            "Special Critical Chance": "SPECCRIT",
            "Special Critical Rating": "SPECCRIT",
            "Resistance Penetration": "RESPEN",
            "Special Survivability": "SPECSURV",
            Resistance: "RESISTANCE",
            "Deflection Chance": "DEFLECTION",
        };

        if (!stats) return super.error(interaction, "Something went wrong. Please make sure you have that character unlocked");
        if (!stats.final) return super.error(interaction, "Something went wrong, I couldn't get the stats for that character");

        let keys = Object.keys(stats.final);
        if (keys.indexOf("undefined") >= 0) keys = keys.slice(0, keys.indexOf("undefined"));
        const maxLen = keys?.reduce((long, str) => Math.max(long, langStr[langMap[str]] ? langStr[langMap[str]].length : 0), 0) || 0;

        // Stick in some standatd keys to help it not be wonky
        if (stats.final["Physical Accuracy"] && stats.final["Special Accuracy"]) stats.final.Accuracy = stats.final["Physical Accuracy"];
        if (stats.final["Physical Critical Rating"]) stats.final["Physical Critical Chance"] = stats.final["Physical Critical Rating"];
        if (stats.final["Special Critical Rating"]) stats.final["Special Critical Chance"] = stats.final["Special Critical Rating"];

        const statArr = [];
        for (const sn of Object.keys(statNames)) {
            let statStr = `== ${sn} ==\n`;
            for (let s of statNames[sn]) {
                if (s.indexOf("Rating") >= 0) s = s.replace("Rating", "Chance");
                if (!stats.final[s]) stats.final[s] = 0;
                const thisLangStr = langStr[langMap[s]];
                if (!thisLangStr?.length) {
                    logger.log(
                        `[/mycharacter] Missing stat for ${unit.name}\nLangStr: \n${inspect(s)}\nThisLangMap: ${
                            langMap[s]
                        }\nThisLangStr: ${inspect(thisLangStr)}`,
                    );
                    statStr += `${s.toString().padEnd(8 - s.length)}\n`;
                } else {
                    const rep = maxLen - (thisLangStr?.length || 0);
                    if (s === "Dodge Chance" || s === "Deflection Chance") {
                        statStr += `${langStr[langMap[s]]}${" ".repeat(rep > 0 ? rep : 0)} :: 2.00%\n`;
                    } else {
                        statStr += `${langStr[langMap[s]]}${" ".repeat(rep > 0 ? rep : 0)} :: `;
                        const str = stats.final[s] % 1 === 0 ? stats.final[s].toLocaleString() : `${(stats.final[s] * 100).toFixed(2)}%`;
                        const modStr = isShip
                            ? ""
                            : stats.mods[s]
                              ? stats.mods[s] % 1 === 0
                                  ? `(${stats.mods[s].toLocaleString()})`
                                  : `(${(stats.mods[s] * 100).toFixed(2)}%)`
                              : "";
                        statStr += `${str.toString().padEnd(8 - str.length) + modStr}\n`;
                    }
                }
            }
            statArr.push(expandSpaces(statStr));
        }

        const fields = [];
        msgArray(statArr, "\n", 1000).forEach((m: string, ix: number) => {
            fields.push({
                name: ix === 0 ? "Stats" : "-",
                value: codeBlock("asciidoc", m),
            });
        });

        if (player.warnings) {
            fields.push({
                name: "Warnings",
                value: player.warnings.join("\n"),
            });
        }
        let gearOut = "";
        if (!isShip) {
            // If it's a character, go ahead and work out the gear
            gearOut = `\n${[`${language.get("BASE_GEAR_SHORT")}: ${thisUnit.gear}`, `${gearStr}`].join("\n")}`;
        }

        const unitImg = await getUnitImage(thisUnit.defId, thisUnit);

        fields.push({
            name: constants.zws,
            value: footerStr,
        });

        if (!unitImg) {
            // If it couldn't get an image for the character
            return interaction.editReply({
                content: null,
                embeds: [
                    {
                        author: {
                            name: `${thisUnit.player ? thisUnit.player : player.name}'s ${unit.name}`,
                            url: unit.url || null,
                            icon_url: unit.avatarURL || null,
                        },
                        description: `\`${language.get("BASE_LEVEL_SHORT")} ${thisUnit.level} | ${
                            thisUnit.rarity
                        }* | ${thisUnit.gp} gp\`${gearOut}`,
                        fields: [
                            {
                                name: language.get("COMMAND_MYCHARACTER_ABILITIES"),
                                value: abilitiesOut.length ? abilitiesOut.join("\n") : "Couldn't find abilities",
                            },
                        ].concat(fields),
                    },
                ],
            });
        }

        // But if it could, go ahead and send it
        return interaction.editReply({
            content: null,
            embeds: [
                {
                    author: {
                        name: `${thisUnit.player ? thisUnit.player : player.name}'s ${unit.name}`,
                        url: unit.url,
                    },
                    thumbnail: { url: "attachment://image.png" },
                    description: `\`${language.get("BASE_LEVEL_SHORT")} ${thisUnit.level} | ${
                        thisUnit.rarity
                    }* | ${thisUnit.gp} gp\`${gearOut}`,
                    fields: [
                        {
                            name: language.get("COMMAND_MYCHARACTER_ABILITIES"),
                            value: abilitiesOut.length ? abilitiesOut.join("\n") : "Couldn't find abilities",
                        },
                    ].concat(fields),
                },
            ],
            files: [
                {
                    attachment: unitImg,
                    name: "image.png",
                },
            ],
        });
    }
}
