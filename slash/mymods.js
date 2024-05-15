const Command = require("../base/slashCommand");
const { ApplicationCommandOptionType, PermissionsBitField, codeBlock } = require("discord.js");
const statEnums = require("../data/statEnum.js");
const emoteStrings = require("../data/emoteStrings.js");

const modSlots = ["square", "arrow", "diamond", "triangle", "circle", "cross"];

class MyMods extends Command {
    constructor(Bot) {
        super(Bot, {
            name: "mymods",
            guildOnly: false,
            description: "Show the current mods for a given character",
            options: [
                {
                    name: "character",
                    description: "Show the mod stat for the specified character",
                    type: ApplicationCommandOptionType.Subcommand,
                    options: [
                        {
                            name: "character",
                            autocomplete: true,
                            required: true,
                            type: ApplicationCommandOptionType.String,
                            description: "The character you want to check",
                        },
                        {
                            name: "allycode",
                            description: "The ally code for whoever you're wanting to look up",
                            type: ApplicationCommandOptionType.String,
                        },
                    ],
                },
                {
                    name: "best",
                    type: ApplicationCommandOptionType.Subcommand,
                    description: "Show the characters that have the best of a stat",
                    options: [
                        {
                            name: "stat",
                            required: true,
                            description: "Which stat you want it to show",
                            type: ApplicationCommandOptionType.String,
                            choices: [
                                { name: "Accuracy", value: "Accuracy" },
                                { name: "Armor", value: "Armor" },
                                { name: "Critical Damage", value: "Critical Damage" },
                                { name: "Health", value: "Health" },
                                { name: "Physical Critical Chance", value: "Physical Critical Chance" },
                                { name: "Physical Damage", value: "Physical Damage" },
                                { name: "Potency", value: "Potency" },
                                { name: "Protection", value: "Protection" },
                                { name: "Resistance", value: "Resistance" },
                                { name: "Special Critical Chance", value: "Special Critical Chance" },
                                { name: "Special Damage", value: "Special Damage" },
                                { name: "Speed", value: "Speed" },
                                { name: "Tenacity", value: "Tenacity" },
                            ],
                        },
                        {
                            name: "allycode",
                            description: "The ally code for whoever you're wanting to look up",
                            type: ApplicationCommandOptionType.String,
                        },
                        {
                            name: "total",
                            type: ApplicationCommandOptionType.Boolean,
                            description: "Show the total stat, instead of just what the mods add on",
                        },
                    ],
                },
                {
                    name: "bestmods",
                    type: ApplicationCommandOptionType.Subcommand,
                    description: "Show the mods that have the best of a stat",
                    options: [
                        {
                            name: "stat",
                            required: true,
                            description: "Which stat you want it to show",
                            type: ApplicationCommandOptionType.String,
                            choices: [
                                { name: "Crit Chance %", value: "Critical Chance" }, // Crit Chance, 53
                                { name: "Defense", value: "Defense" }, // Defense, 42
                                { name: "Health %", value: "Health %" }, // Health %, 55
                                { name: "Health", value: "Health" }, // Health flat value, 1
                                { name: "Offense %", value: "Offense %" }, // Offense %, 48
                                { name: "Offense", value: "Offense" }, // Offense flat value, 41
                                { name: "Potency %", value: "Potency" }, // Potency %, 17
                                { name: "Protection %", value: "Protection %" }, // Protection %, 56
                                { name: "Protection", value: "Protection" }, // Protection flat value, 28
                                { name: "Speed", value: "Speed" }, // Speed, 5
                                { name: "Tenacity %", value: "Tenacity" }, // Tenacity %, 18
                            ],
                        },
                        {
                            name: "allycode",
                            description: "The ally code for whoever you're wanting to look up",
                            type: ApplicationCommandOptionType.String,
                        },
                    ],
                },
                {
                    name: "missing",
                    type: ApplicationCommandOptionType.Subcommand,
                    description: "Show which characters have missing or underleveled mods.",
                },
            ],
        });
    }

    async run(Bot, interaction) {
        const cooldown = await Bot.getPlayerCooldown(interaction.user.id, interaction?.guild?.id);

        const subCommand = interaction.options.getSubcommand();
        let allycode = interaction.options.getString("allycode");
        allycode = await Bot.getAllyCode(interaction, allycode);

        if (!allycode) {
            return super.error(interaction, "I could not find a match for the provided ally code.");
        }
        await interaction.reply({ content: interaction.language.get("COMMAND_MYMODS_WAIT") });

        let player;
        try {
            player = await Bot.swgohAPI.unitStats(allycode, cooldown);
            if (Array.isArray(player)) player = player[0];
        } catch (e) {
            return super.error(interaction, codeBlock(e.message), {
                title: interaction.language.get("BASE_SOMETHING_BROKE"),
                footer: "Please try again in a bit.",
            });
        }
        if (!player?.roster) {
            // If there's no characters, then there's nothing to show...
            return super.error(interaction, "Unable to retrieve roster.", {
                title: interaction.language.get("BASE_SOMETHING_BROKE"),
                footer: "Please try again in a bit.",
            });
        }
        const footerStr = Bot.updatedFooterStr(player.updated, interaction) || "";

        if (subCommand === "character") {
            const searchChar = interaction.options.getString("character");

            let character;
            if (!searchChar) {
                return interaction.editReply({ content: interaction.language.get("BASE_SWGOH_MISSING_CHAR") });
            }

            const chars = Bot.findChar(searchChar, Bot.characters);
            if (chars.length === 0) {
                return interaction.editReply({ content: interaction.language.get("BASE_SWGOH_NO_CHAR_FOUND", searchChar) });
            }
            if (chars.length > 1) {
                const charList = chars.sort((p, c) => (p.name > c.name ? 1 : -1)).map((c) => c.name);
                return super.error(interaction, interaction.language.get("BASE_SWGOH_CHAR_LIST", charList.join("\n")), { edit: true });
            }
            character = chars[0];

            const thisChar = player.roster.find((c) => c.defId === character.uniqueName);
            if (!thisChar) {
                return super.error(interaction, "Looks like you don't have that character activated yet.");
            }

            const langChar = await Bot.swgohAPI.langChar(thisChar, interaction.guildSettings.swgohLanguage);
            if (!langChar) {
                return interaction.editReply({
                    content: null,
                    embeds: [
                        {
                            author: {
                                name: `${player.name}'s ${character.name}`,
                            },
                            description: `${interaction.language.get("BASE_SWGOH_LOCKED_CHAR")}\n${footerStr}`,
                        },
                    ],
                });
            }

            const charMods = langChar.mods;
            const slots = {};

            const sets = interaction.language.get("BASE_MODSETS_FROM_GAME");
            const stats = interaction.language.get("BASE_MODS_FROM_GAME");

            for (const mod of charMods) {
                slots[mod.slot] = {
                    stats: [],
                    type: sets[mod.set],
                    lvl: mod.level,
                    pip: mod.pips,
                };

                // Add the primary in
                slots[mod.slot].stats.push(
                    `${mod.primaryStat.value} ${stats[mod.primaryStat.unitStat].replace(/\+/g, "").replace(/%/g, "")}`,
                );

                // Then all the secondaries
                for (const s of mod.secondaryStat) {
                    let t = stats[s.unitStat];
                    if (t.indexOf("%") > -1) {
                        t = t.replace(/%/g, "").trim();
                        s.value = `${s.value.toFixed(2)}%`;
                    }

                    let statStr = s.value;
                    if (s.roll > 0) statStr = `(${s.roll}) ${statStr}`;
                    statStr += ` ${t}`;
                    slots[mod.slot].stats.push(statStr);
                }
            }

            const fields = [];
            for (const mod of Object.keys(slots)) {
                // Set some default strings in case we don't have perms to use external emotes
                let typeIcon = slots[mod].type;
                let shapeIcon = Bot.toProperCase(modSlots[Number.parseInt(mod, 10) - 1]);

                const stats = slots[mod].stats;
                // If the bot has the right perms to use external emotes, go ahead and set it to use them
                if (
                    !interaction.guild ||
                    interaction.channel?.permissionsFor(interaction.client.user).has([PermissionsBitField.Flags.UseExternalEmojis])
                ) {
                    const shapeIconString = `${modSlots[Number.parseInt(mod, 10) - 1]}Mod${slots[mod].pip === 6 ? "Gold" : ""}`;
                    shapeIcon = emoteStrings[shapeIconString] || shapeIcon;

                    const typeIconString = `modset${slots[mod].type.replace(/\s*/g, "")}`;
                    typeIcon = emoteStrings[typeIconString] || typeIcon;
                }

                fields.push({
                    name: `${shapeIcon} ${typeIcon} (${slots[mod].pip}* Lvl: ${slots[mod].lvl})`,
                    value: `**${stats.shift()}**\n${stats.join("\n")}\n\`${"-".repeat(23)}\``,
                    inline: true,
                });
            }

            return interaction.editReply({
                content: null,
                embeds: [
                    {
                        author: {
                            name: `${player.name}'s ${character.name}`,
                            icon_url: character.avatarURL,
                        },
                        color: Bot.getSideColor(character.side),
                        fields: [...fields, { name: Bot.constants.zws, value: footerStr }],
                    },
                ],
            });
        }
        if (subCommand === "best") {
            const statToCheck = interaction.options.getString("stat");
            const showTotal = interaction.options.getBoolean("total");

            // Filter the player's roster so it's just characters
            const charList = player.roster.filter((unit) => unit.combatType !== 2);
            for (const c of charList) {
                if (!c?.stats) c.stats = { final: {}, mods: {} };
                if (!c.stats?.final?.[statToCheck]) {
                    c.stats.final[statToCheck] = 0;
                }
                if (!c.stats?.mods?.[statToCheck]) {
                    c.stats.mods[statToCheck] = 0;
                }
            }

            // Sort it all by the totoal
            let sortedCharList = charList.sort((p, c) => {
                if (p.stats?.final?.[statToCheck] && c.stats?.final?.[statToCheck]) {
                    return p.stats.final[statToCheck] < c.stats.final[statToCheck] ? 1 : -1;
                }
                if (!p.stats?.final?.[statToCheck]) {
                    return -1;
                }
                return 1;
            });

            // Then if we want it sorted by mods, do that after
            if (!showTotal) {
                sortedCharList = charList.sort((p, c) => {
                    if (p.stats?.mods?.[statToCheck] && c.stats?.mods?.[statToCheck]) {
                        return p.stats.mods[statToCheck] < c.stats.mods[statToCheck] ? 1 : -1;
                    }
                    if (!p.stats?.mods?.[statToCheck]) {
                        return 1;
                    }
                    return -1;
                });
            }

            // Slice it down to a proper size, then grab the localized strings
            sortedCharList = sortedCharList.slice(0, 20);
            for (const charIx in sortedCharList) {
                sortedCharList[charIx] = await Bot.swgohAPI.langChar(sortedCharList[charIx], interaction.guildSettings.swgohLanguage);
            }

            const out = sortedCharList.map((c) => {
                let finalStat = "0";
                let modStat = null;
                if (c.stats?.final[statToCheck] % 1 === 0) {
                    // If it's a full number, give that
                    finalStat = c.stats.final[statToCheck].toLocaleString();
                    if (c.stats?.mods[statToCheck]) {
                        modStat = c.stats.mods[statToCheck].toLocaleString();
                    }
                } else {
                    if (c.stats?.final[statToCheck]) {
                        finalStat = `${(c.stats.final[statToCheck] * 100).toFixed(2)}%`.toLocaleString();
                    }
                    if (c.stats?.mods[statToCheck]) {
                        modStat = `${(c.stats.mods[statToCheck] * 100).toFixed(2)}%`.toLocaleString();
                    }
                }

                return {
                    stat: `${finalStat}${modStat?.toString().length ? ` (${modStat})` : ""}`,
                    name: c.nameKey,
                };
            });
            const longest = out.reduce((max, s) => Math.max(max, s.stat.length), 0);
            let outStr = "";
            for (const outChar of out) {
                outStr += `\`${outChar?.stat}${` ${Bot.constants.zws}`.repeat(longest - (outChar.stat?.length || 3))}\`** : ${
                    outChar.name
                }**\n`;
            }

            const fields = [];
            if (charList.warnings) {
                fields.push({
                    name: "Warnings",
                    value: charList.warnings.join("\n"),
                });
            }

            return interaction.editReply({
                content: null,
                embeds: [
                    {
                        author: {
                            name: interaction.language.get(
                                `COMMAND_MYMODS_HEADER_${showTotal ? "TOTAL" : "MODS"}`,
                                player.name,
                                statToCheck,
                            ),
                        },
                        description: `==============================\n${outStr}==============================`,
                        fields: [...fields, { name: Bot.constants.zws, value: footerStr }],
                    },
                ],
            });
        }
        if (subCommand === "bestmods") {
            // Check for best individual mods of a stat
            const statToCheck = interaction.options.getString("stat");
            const statIndex = statEnums.stats.indexOf(statToCheck);

            // Go through the player's roster and get a list of each stat per mod
            const statMap = [];
            for (const character of player.roster) {
                // For each character
                for (const mod of character.mods) {
                    // For each mod on the character
                    for (const stat of mod.secondaryStat) {
                        // For each stat on the mod
                        if (stat.unitStat === statIndex) {
                            // If it's the stat the user wants, go ahead and grab it with the characters defId
                            statMap.push({
                                slot: mod.slot,
                                value: stat.value,
                                defId: character.defId,
                            });
                        }
                    }
                }
            }

            // Sort mods, chop off the top x, then grab matching names for the character they're on
            const sortedMods = statMap.sort((a, b) => b.value - a.value);
            const topSorted = sortedMods.slice(0, 20);
            const namedSorted = topSorted.map((mod) => {
                const charName = Bot.characters.find((char) => char.uniqueName === mod.defId);
                mod.name = charName?.name;
                return mod;
            });

            // Grab the longest any mod value will be
            const maxLen = Math.max(...statMap.map((stat) => stat.value.toLocaleString().length));

            // Format everything into the needed string
            let outStr = "";
            for (const mod of namedSorted) {
                const shapeIconString = `${modSlots[mod.slot - 1]}Mod`;
                const value = mod.value % 1 === 0 ? mod.value : `${mod.value.toFixed(2)}%`;
                outStr += `**\`${value.toLocaleString().padEnd(maxLen)}\`** ${emoteStrings[shapeIconString]} | ${mod.name}\n`;
            }

            // Send it on back to the user
            return interaction.editReply({
                content: null,
                embeds: [
                    {
                        author: {
                            name: `${player.name}'s top ${statToCheck} values`,
                        },
                        description: `==============================\n${outStr}==============================\n${footerStr}`,
                    },
                ],
            });
        }
        if (subCommand === "missing") {
            // Check all g10+ characters that have missing or mods that are under lvl 15 (Max lvl)
            const outArr = [];
            for (const character of player.roster.filter((unit) => unit.combatType !== 2)) {
                if (character?.gear < 10) continue;
                const missingMods = 6 - (character.mods?.length || 0);
                const lowerLvl = 6 - (character.mods?.filter((m) => !m || m.level >= 15).length || 0) - missingMods;

                if (missingMods || lowerLvl) {
                    const langChar = await Bot.swgohAPI.langChar(character, interaction.guildSettings.swgohLanguage);
                    outArr.push(`\`[${missingMods}][${lowerLvl}]\` ${langChar.nameKey || langChar.defId}`);
                }
            }
            if (!outArr.length) return super.success(interaction, "It looks like your characters all have well leveled mods!");

            const topDesc = "`[x]: Number of mods missing     `\n`[▼]: Number of mods below lvl 15`";
            return super.success(interaction, `${topDesc}\n\n__**\`[x][▼]\` Name**__\n${outArr.join("\n")}`, {
                title: `${player.name || interaction.user.name}'s mod issues for gear 10+`,
                description: footerStr,
            });
        }
    }
}

module.exports = MyMods;
