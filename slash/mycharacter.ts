import { inspect } from "node:util";
import {
    type APIEmbedField,
    ApplicationCommandOptionType,
    type ChatInputCommandInteraction,
    codeBlock,
    InteractionContextType,
} from "discord.js";
import type Language from "../base/Language.ts";
import Command from "../base/slashCommand.ts";
import constants from "../data/constants/constants.ts";
import { characters, ships } from "../data/constants/units.ts";
import { charListFromSearch, expandSpaces, findChar, getAllyCode, msgArray, updatedFooterStr } from "../modules/functions.ts";
import logger from "../modules/Logger.ts";
import { fetchPlayerWithCooldown } from "../modules/patreonFuncs.ts";
import swgohAPI from "../modules/swapi.ts";
import { toProperCase } from "../modules/utils/text.ts";
import { getUnitImage } from "../modules/utils/unitImages.ts";
import type { SWAPIPlayer, SWAPIUnit, SWAPIUnitSkill, SWAPIUnitStatTypes } from "../types/swapi_types.ts";
import type { BotUnit, CommandContext } from "../types/types.ts";

export default class MyCharacter extends Command {
    static readonly metadata = {
        name: "mycharacter",
        description: "Display overall stats & mod info for the selected character",
        category: "Gamedata",

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
        const ac = interaction.options.getString("allycode");
        const allyCode = await getAllyCode(interaction, ac);

        if (!allyCode) {
            return super.error(interaction, language.get("BASE_INVALID_ALLY_CODE"));
        }

        // Get any matching units
        const units = searchUnit ? findChar(searchUnit, searchType === "ship" ? ships : characters, true) : [];

        // If there are no results or too many results, let the user know
        if (units.length === 0) {
            return super.error(interaction, language.get("BASE_SWGOH_NO_CHAR_FOUND", searchUnit ?? ""));
        }
        if (units.length > 1) {
            return super.error(interaction, language.get("BASE_SWGOH_CHAR_LIST", charListFromSearch(units)));
        }

        // If there's nothing wrong above, grab the single unit and go from there
        const unit = units[0];

        await interaction.reply({ content: language.get("BASE_SWGOH_PLS_WAIT_FETCH") });

        const player = await fetchPlayerWithCooldown(interaction, allyCode);
        if (!player) {
            return super.error(interaction, language.get("COMMAND_MYCHARACTER_FETCH_ERROR"), {
                title: language.get("BASE_SOMETHING_BROKE"),
            });
        }

        if (!player?.roster || !player?.updatedAt) {
            return super.error(interaction, language.get("COMMAND_MYCHARACTER_ALLY_NOT_FOUND"));
        }

        const pName = player.name;
        const footerStr = updatedFooterStr(player.updatedAt, language);

        const thisUnit = player.roster.find((c) => c.defId === unit.uniqueName);

        // The user doesn't have the unit unlocked, so let em know
        if (!thisUnit) {
            const outStr = language.get("BASE_SWGOH_LOCKED_CHAR");
            return super.error(interaction, outStr || "This character is locked.", {
                title: `${pName}'s ${unit.name}`,
                footer: footerStr,
            });
        }

        return this.showUnit(interaction, language, swgohLanguage, { unit, player, thisUnit, searchType, footerStr });
    }

    private async showUnit(
        interaction: ChatInputCommandInteraction,
        language: Language,
        swgohLanguage: CommandContext["swgohLanguage"],
        {
            unit,
            player,
            thisUnit,
            searchType,
            footerStr,
        }: { unit: BotUnit; player: SWAPIPlayer; thisUnit: SWAPIUnit; searchType: string; footerStr: string },
    ) {
        const thisLangChar = await swgohAPI.langChar(thisUnit, swgohLanguage);

        const stats = thisUnit.stats;
        const isShip = thisUnit.combatType === 2;

        if (!thisLangChar.skills) {
            logger.log(JSON.stringify(thisLangChar));
        }
        const abilitiesOut = abilityLines(thisLangChar.skills ?? [], isShip);

        if (!stats) return super.error(interaction, language.get("COMMAND_MYCHARACTER_NO_STATS"));
        if (!stats.final) return super.error(interaction, language.get("COMMAND_MYCHARACTER_STATS_ERROR"));

        const fields = statFields(stats, isShip, language, unit.name);
        if (player.warnings) {
            fields.push({
                name: "Warnings",
                value: player.warnings.join("\n"),
            });
        }
        fields.push({
            name: constants.zws,
            value: footerStr,
        });

        let gearOut = "";
        if (!isShip) {
            // If it's a character, go ahead and work out the gear
            const gearStr = searchType === "character" ? gearSlotGrid(thisUnit.equipped) : "";
            gearOut = `\n${[`${language.get("BASE_GEAR_SHORT")}: ${thisUnit.gear}`, `${gearStr}`].join("\n")}`;
        }

        const unitImg = await getUnitImage(thisUnit.defId, thisUnit);
        const embed = {
            author: {
                name: `${thisUnit.player ? thisUnit.player : player.name}'s ${unit.name}`,
                url: unit.url || undefined,
            },
            description: `\`${language.get("BASE_LEVEL_SHORT")} ${thisUnit.level} | ${thisUnit.rarity}* | ${thisUnit.gp} gp\`${gearOut}`,
            fields: [
                {
                    name: language.get("COMMAND_MYCHARACTER_ABILITIES"),
                    value: abilitiesOut.length ? abilitiesOut.join("\n") : "Couldn't find abilities",
                },
            ].concat(fields),
        };

        if (!unitImg) {
            // If it couldn't get an image for the character
            return interaction.editReply({
                content: null,
                embeds: [{ ...embed, author: { ...embed.author, icon_url: unit.avatarURL || undefined } }],
            });
        }

        // But if it could, go ahead and send it
        return interaction.editReply({
            content: null,
            embeds: [{ ...embed, thumbnail: { url: "attachment://image.png" } }],
            files: [
                {
                    attachment: unitImg,
                    name: "image.png",
                },
            ],
        });
    }
}

const ABILITY_ORDER = ["basic", "special", "leader", "unique", "crew", "contract", "hardware"];

const statNames: Record<string, string[]> = {
    "Primary Attributes": ["Strength", "Agility", "Intelligence"],
    General: ["Health", "Protection", "Speed", "Critical Damage", "Potency", "Tenacity", "Health Steal"],
    "Physical Offense": ["Physical Damage", "Physical Critical Chance", "Armor Penetration", "Accuracy"],
    "Physical Survivability": ["Armor", "Dodge Chance", "Critical Avoidance"],
    "Special Offense": ["Special Damage", "Special Critical Chance", "Resistance Penetration", "Accuracy"],
    "Special Survivability": ["Resistance", "Deflection Chance", "Critical Avoidance"],
};

const langMap: Record<string, string> = {
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

function gearSlotGrid(equipped: SWAPIUnit["equipped"]): string {
    let gearStr = ["   [0]  [3]", "[1]       [4]", "   [2]  [5]"].join("\n");
    for (const e of equipped) {
        gearStr = gearStr.replace(e.slot.toString(), "X");
    }
    gearStr = gearStr.replace(/[0-9]/g, "  ");
    return expandSpaces(gearStr);
}

function abilityLines(skills: SWAPIUnitSkill[], isShip: boolean): string[] {
    const abilities: Record<string, string[]> = Object.fromEntries(ABILITY_ORDER.map((type) => [type, []]));
    for (const a of skills) {
        const type = toProperCase(a.id.split("skill")[0]);
        const typeKey = type ? type.toLowerCase() : (a.defId?.toLowerCase() ?? "");
        if (!abilities[typeKey]) {
            logger.error(`ERROR[MC]: bad ability type: ${inspect(a)}`);
            continue;
        }
        abilities[typeKey].push(`\`${abilityTierLabel(a, isShip)} [${type ? type.charAt(0) : (a.defId?.charAt(0) ?? "")}]\` ${a.nameKey}`);
    }
    return ABILITY_ORDER.flatMap((type) => abilities[type]);
}

function abilityTierLabel(a: SWAPIUnitSkill, isShip: boolean): string {
    // Unmaxed ability
    if (a.tier !== a.tiers) return `Lvl ${a.tier}`;
    // Maxed Omicron ability
    if (a.isOmicron) return "Max O";
    // Maxed Zeta ability
    if (a.isZeta) return "Max ✦";
    if (isShip) return "Max";
    // Maxed Omega ability
    return "Max ⭓";
}

function statFields(stats: NonNullable<SWAPIUnit["stats"]>, isShip: boolean, language: Language, unitName: string): APIEmbedField[] {
    const final = stats.final as SWAPIUnitStatTypes;
    const langStr = language.get("BASE_STAT_NAMES") as unknown as Record<string, string>;

    let keys = Object.keys(final);
    if (keys.indexOf("undefined") >= 0) keys = keys.slice(0, keys.indexOf("undefined"));
    const maxLen = keys?.reduce((long, str) => Math.max(long, langStr[langMap[str]] ? langStr[langMap[str]].length : 0), 0) || 0;

    // Stick in some standatd keys to help it not be wonky
    if (final["Physical Accuracy"] && final["Special Accuracy"]) final.Accuracy = final["Physical Accuracy"];
    if (final["Physical Critical Rating"]) final["Physical Critical Chance"] = final["Physical Critical Rating"];
    if (final["Special Critical Rating"]) final["Special Critical Chance"] = final["Special Critical Rating"];

    const statArr: string[] = [];
    for (const sn of Object.keys(statNames)) {
        let statStr = `== ${sn} ==\n`;
        for (const s of statNames[sn]) {
            statStr += statLine(s, { final, mods: isShip ? null : stats.mods, langStr, maxLen, unitName });
        }
        statArr.push(expandSpaces(statStr));
    }

    return msgArray(statArr, "\n", 1000).map((m: string, ix: number) => ({
        name: ix === 0 ? "Stats" : "-",
        value: codeBlock("asciidoc", m),
    }));
}

function statLine(
    statName: string,
    {
        final,
        mods,
        langStr,
        maxLen,
        unitName,
    }: { final: SWAPIUnitStatTypes; mods: SWAPIUnitStatTypes | null; langStr: Record<string, string>; maxLen: number; unitName: string },
): string {
    const s = statName.indexOf("Rating") >= 0 ? statName.replace("Rating", "Chance") : statName;
    const sKey = s as keyof SWAPIUnitStatTypes;
    if (!final[sKey]) final[sKey] = 0;
    const thisLangStr = langStr[langMap[s]];
    if (!thisLangStr?.length) {
        logger.log(
            `[/mycharacter] Missing stat for ${unitName}\nLangStr: \n${inspect(s)}\nThisLangMap: ${langMap[s]}\nThisLangStr: ${inspect(thisLangStr)}`,
        );
        return `${s.toString().padEnd(8 - s.length)}\n`;
    }
    const label = `${thisLangStr}${" ".repeat(Math.max(maxLen - thisLangStr.length, 0))} :: `;
    if (s === "Dodge Chance" || s === "Deflection Chance") {
        return `${label}2.00%\n`;
    }
    const str = formatStatValue(final[sKey]);
    const modStr = mods?.[sKey] ? `(${formatStatValue(mods[sKey])})` : "";
    return `${label}${str.toString().padEnd(8 - str.length) + modStr}\n`;
}

function formatStatValue(value: number): string {
    return value % 1 === 0 ? value.toLocaleString() : `${(value * 100).toFixed(2)}%`;
}
