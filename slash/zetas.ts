import { ApplicationCommandOptionType, InteractionContextType } from "discord.js";
import Command from "../base/slashCommand.ts";
import config from "../config.js";
import constants from "../data/constants/constants.ts";
import { characters } from "../data/constants/units.ts";
import cache from "../modules/cache.ts";
import { chunkArray, findChar, getAllyCode, getBlankUnitImage, msgArray, updatedFooterStr } from "../modules/functions.ts";
import logger from "../modules/Logger.ts";
import patreonFuncs from "../modules/patreonFuncs.ts";
import swgohAPI from "../modules/swapi.ts";
import type { SWAPIGuild, SWAPIPlayer, SWAPIUnit } from "../types/swapi_types.ts";
import type { BotInteraction } from "../types/types.ts";

export default class Zetas extends Command {
    static readonly metadata = {
        name: "zetas",
        description: "See a player's zetas",
        guildOnly: false,
        contexts: [InteractionContextType.Guild, InteractionContextType.BotDM],
        options: [
            {
                name: "guild",
                type: ApplicationCommandOptionType.Subcommand,
                description: "See a list of zetas for your whole guild",
                options: [
                    {
                        name: "allycode",
                        type: ApplicationCommandOptionType.String,
                        required: true,
                        description: "The ally code of a player in the guild you want to see",
                    },
                    {
                        name: "character",
                        autocomplete: true,
                        type: ApplicationCommandOptionType.String,
                        description: "Just show the zeta'd abilities for a specific character",
                    },
                ],
            },
            {
                name: "player",
                type: ApplicationCommandOptionType.Subcommand,
                description: "See a player's zetas",
                options: [
                    {
                        name: "allycode",
                        type: ApplicationCommandOptionType.String,
                        required: true,
                        description: "The ally code of the player you want to see.",
                    },
                    {
                        name: "character",
                        autocomplete: true,
                        type: ApplicationCommandOptionType.String,
                        description: "Just show the zeta'd abilities for a specific character",
                    },
                ],
            },
        ],
    };
    constructor() {
        super(Zetas.metadata);
    }

    async run(interaction: BotInteraction) {
        let allycode = interaction.options.getString("allycode");
        allycode = await getAllyCode(interaction, allycode);
        if (!allycode) {
            return super.error(interaction, "I could not find a match for the provided ally code.");
        }

        await interaction.reply({ content: interaction.language.get("BASE_SWGOH_PLS_WAIT_FETCH", "zetas") });

        const subCommand = interaction.options.getSubcommand(true);

        let character = null;
        const searchChar = interaction.options.getString("character");
        // If a character was entered, see if it can find a match to display later
        if (searchChar) {
            const foundCharacters = findChar(searchChar, characters);

            if (!foundCharacters?.length) {
                // No character found
                return super.error(interaction, interaction.language.get("BASE_SWGOH_NO_CHAR_FOUND", searchChar));
            }
            if (foundCharacters.length > 1) {
                const charL = [];
                const charS = foundCharacters.sort((p, c) => (p.name > c.name ? 1 : -1));
                for (const c of charS) {
                    charL.push(c.name);
                }
                return super.error(interaction, interaction.language.get("COMMAND_GUILDSEARCH_CHAR_LIST", charL.join("\n")));
            }
            character = foundCharacters[0];
        }

        const cooldown = await patreonFuncs.getPlayerCooldown(interaction.user.id, interaction?.guild?.id);

        let player: SWAPIPlayer;
        try {
            const playerRes = await swgohAPI.unitStats(Number.parseInt(allycode, 10), cooldown);
            player = playerRes?.[0] || null;
        } catch (e) {
            logger.error(`Error: Broke while trying to get player data in zetas: ${e}`);
            return super.error(interaction, interaction.language.get("BASE_SWGOH_NO_ACCT"));
        }

        if (!player?.roster) return super.error(interaction, "I cannot get this player's info right now. Please try again later");

        // Filter out all the ships, so it only has to check through characters
        player.roster = player.roster.filter((ch) => ch.combatType === 1);

        if (subCommand === "player") {
            // Display zetas for a single player
            const zetas = {};
            let count = 0;

            // This will grab the character info for any entered character
            const getCharInfo = async (thisChar: SWAPIUnit) => {
                const langedChar = await swgohAPI.langChar(thisChar, interaction.guildSettings.swgohLanguage);
                if (!langedChar.nameKey) {
                    const tmp = characters.filter((c) => c.uniqueName === langedChar.defId);
                    if (tmp.length) {
                        langedChar.nameKey = tmp[0].name;
                    }
                }
                for (const skill of langedChar.skills) {
                    if (
                        (skill.isOmicron && skill.isZeta && skill.tier >= skill.tiers - 1) ||
                        (!skill.isOmicron && skill.isZeta && skill.tier === skill.tiers)
                    ) {
                        count++;
                        // If the character is not already listed, add it
                        if (!zetas[langedChar.nameKey]) {
                            zetas[langedChar.nameKey] = [`\`[${skill.id.charAt(0).toUpperCase()}]\` ${skill.nameKey}`];
                        } else {
                            zetas[langedChar.nameKey].push(`\`[${skill.id.charAt(0).toUpperCase()}]\` ${skill.nameKey}`);
                        }
                    }
                }
            };

            const desc = [];
            const author = { name: "" };
            const fields = [];
            if (character) {
                // Grab just the one character from the roster
                const char = player.roster.find((c) => c.defId === character.uniqueName);
                await getCharInfo(char);
                const sorted = Object.keys(zetas).sort((p, c) => (p > c ? 1 : -1));

                author.name = `${player.name}'s ${character.name} (${count})`;
                if (!zetas[sorted[0]] || zetas[sorted[0]].length === 0) {
                    desc.push(interaction.language.get("COMMAND_ZETA_NO_ZETAS"));
                } else {
                    desc.push(zetas[sorted[0]].join("\n"));
                }
            } else {
                // Loop through and get all of the applicable ones

                // Get all the localiazed character names for the player's units
                const unitDefIdList = player.roster.map((c) => c.defId);
                const langCharNames = await cache.get(
                    config.mongodb.swapidb,
                    "units",
                    { baseId: { $in: unitDefIdList }, language: interaction.guildSettings.swgohLanguage.toLowerCase() },
                    { baseId: 1, nameKey: 1, _id: 0 },
                );

                // Get all the zetas for each character
                for (const char of player.roster) {
                    if (!char?.skills?.length) continue;
                    const zList = char.skills.filter((s) => s.isZeta && s.tier >= s.zetaTier);
                    if (!zList.length) continue;
                    const charName = langCharNames.find((c) => c.baseId === char.defId)?.nameKey;
                    zetas[charName] = zList;
                    count += zList.length;
                }
                const sorted = Object.keys(zetas).sort((p, c) => (p > c ? 1 : -1));
                const formatted = sorted.map((character) => `\`(${zetas[character].length})\` ${character}`);
                const chunked = chunkArray(formatted, 45);

                author.name = interaction.language.get("COMMAND_ZETA_ZETAS_HEADER", player.name, count);
                desc.push("`------------------------------`");
                for (const chunk of chunked) {
                    fields.push({
                        name: constants.zws,
                        value: chunk.join("\n"),
                    });
                }
                fields.push({
                    name: constants.zws,
                    value: interaction.language.get("COMMAND_ZETA_MORE_INFO"),
                });
            }

            if (player.warnings) {
                fields.push({
                    name: "Warnings",
                    value: player.warnings.join("\n"),
                });
            }

            const footerStr = updatedFooterStr(player.updated, interaction);
            fields.push({
                name: constants.zws,
                value: footerStr,
            });
            if (character) {
                const charImg = await getBlankUnitImage(character.uniqueName);
                return interaction.editReply({
                    content: null,
                    embeds: [
                        {
                            color: constants.colors.black,
                            author: author,
                            description: desc.join("\n"),
                            fields: fields,
                            thumbnail: { url: "attachment://image.png" },
                        },
                    ],
                    files: [
                        {
                            attachment: charImg,
                            name: "image.png",
                        },
                    ],
                });
            }
            if (fields.length > 5) {
                await interaction.editReply({
                    content: null,
                    embeds: [
                        {
                            color: constants.colors.black,
                            author: author,
                            description: desc.join("\n"),
                            fields: fields.slice(0, 5),
                        },
                    ],
                });
                await interaction.followUp({
                    content: null,
                    embeds: [
                        {
                            color: constants.colors.black,
                            author: author,
                            description: desc.join("\n"),
                            fields: fields.slice(5),
                        },
                    ],
                });
                return;
            }
            interaction.editReply({
                content: null,
                embeds: [
                    {
                        color: constants.colors.black,
                        author: author,
                        description: desc.join("\n"),
                        fields: fields,
                    },
                ],
            });
            return;
        }
        if (subCommand === "guild") {
            // Display the zetas for the whole guild (Takes a while)
            await interaction.editReply({ content: interaction.language.get("COMMAND_ZETA_WAIT_GUILD") });

            let guild: SWAPIGuild = null;
            let guildGG: SWAPIPlayer[] = null;

            try {
                guild = await swgohAPI.guild(player.allyCode, cooldown);
                // TODO  Lang this
                if (!guild) return super.error(interaction, "Cannot find guild");
                if (!guild.roster) return super.error(interaction, "Cannot find your guild's roster");

                // Filter out members with null allycodes (failed to fetch from API)
                const oldLen = guild.roster.length;
                guild.roster = guild.roster.filter((m) => m.allyCode !== null);
                if (!guild.roster.length) {
                    return super.error(interaction, "Could not get valid ally codes for any members in the guild");
                }
                if (guild.roster.length !== oldLen) {
                    logger.log(`[Zetas] Filtered ${oldLen - guild.roster.length} members with null allycodes`);
                }
            } catch (e) {
                const errorMessage = e instanceof Error ? e.message : String(e);
                logger.error(`[Zetas] Failed to get guild: ${errorMessage}`);
                return super.error(interaction, errorMessage);
            }
            try {
                guildGG = await swgohAPI.unitStats(
                    guild.roster.map((p) => p.allyCode),
                    cooldown,
                );
            } catch (e) {
                const errorMessage = e instanceof Error ? e.message : String(e);
                logger.error(`[Zetas] Failed to get guild stats: ${errorMessage}`);
                return super.error(interaction, errorMessage);
            }

            const zetas = {};

            for (const player of guildGG) {
                for (const char of player.roster) {
                    char.zetas = char.skills.filter(
                        (s) => (s.isOmicron && s.isZeta && s.tier >= s.tiers - 1) || (!s.isOmicron && s.isZeta && s.tier === s.tiers),
                    );
                    if (char.zetas.length) {
                        for (const s of char.zetas) {
                            if (!zetas[char.defId]) {
                                zetas[char.defId] = {};
                            }

                            zetas[char.defId][s.id] ? zetas[char.defId][s.id].push(player.name) : [player.name];
                        }
                    }
                }
            }

            const zOut = [];
            const fields = [];
            if (!character) {
                // They want to see all zetas for the guild
                for (const char of Object.keys(zetas)) {
                    const outObj = { name: "", abilities: "" };
                    outObj.name = `**${characters.find((c) => c.uniqueName === char).name}**`;
                    outObj.abilities = "";
                    for (const skill of Object.keys(zetas[char])) {
                        const s = await swgohAPI.abilities(skill, null, { min: true });
                        outObj.abilities += `\`${zetas[char][skill].length}\`: ${s[0].nameKey}\n`;
                    }
                    zOut.push(outObj);
                }
                const sortedChars = zOut
                    .sort((a, b) => (a.name.toLowerCase() > b.name.toLowerCase() ? 1 : -1))
                    .map((c) => `${c.name}\n${c.abilities}`);
                const MAX_FIELDS = 5;
                const msgArr = msgArray(sortedChars, "", 1000);
                for (const m of msgArr) {
                    fields.push({
                        name: "____",
                        value: m,
                        inline: true,
                    });
                }
                const fieldArrChunks = chunkArray(fields, MAX_FIELDS);
                const footerStr = updatedFooterStr(guild.updated, interaction);
                fields.push({
                    name: constants.zws,
                    value: footerStr,
                });

                for (const [index, fieldChunk] of fieldArrChunks.entries()) {
                    if (index === 0) {
                        return interaction.editReply({
                            content: null,
                            embeds: [
                                {
                                    author: {
                                        name: interaction.language.get("COMMAND_ZETA_ZETAS_HEADER", guild.name),
                                    },
                                    fields: fieldChunk,
                                },
                            ],
                        });
                    }
                    return interaction.followUp({
                        embeds: [
                            {
                                fields: fieldChunk,
                            },
                        ],
                    });
                }
            } else {
                const footerStr = updatedFooterStr(guild.updated, interaction);
                if (!zetas[character.uniqueName]?.length) {
                    return interaction.editReply({
                        embeds: [
                            {
                                author: {
                                    name: interaction.language.get("COMMAND_ZETA_ZETAS_HEADER", guild.name),
                                },
                                description: `It looks like nobody in your guild has any zetas for ${searchChar}.\n\n${footerStr}`,
                            },
                        ],
                    });
                }
                for (const skill of Object.keys(zetas[character.uniqueName])) {
                    const name = await swgohAPI.abilities(skill, null, { min: true });
                    fields.push({
                        name: name[0].nameKey,
                        value: zetas[character.uniqueName][skill].join("\n"),
                    });
                }
                fields.push({
                    name: constants.zws,
                    value: footerStr,
                });
                return interaction.editReply({
                    embeds: [
                        {
                            author: {
                                name: interaction.language.get("COMMAND_ZETA_ZETAS_HEADER", guild.name),
                            },
                            fields: fields,
                        },
                    ],
                });
            }
        }
    }
}
