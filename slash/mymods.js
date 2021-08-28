const Command = require("../base/slashCommand");
require("moment-duration-format");

class MyMods extends Command {
    constructor(Bot) {
        super(Bot, {
            name: "mymods",
            category: "SWGoH",
            guildOnly: false,
            aliases: ["charactermods", "charmods", "cmods", "cm", "mm"],
            permissions: ["EMBED_LINKS"],
            options: [
                {
                    name: "character",
                    description: "Show the mod stat for the specified character",
                    type: "SUB_COMMAND",
                    options: [
                        {
                            name: "character",
                            required: true,
                            type: "STRING",
                            description: "The character you want to check"
                        },
                        {
                            name: "allycode",
                            description: "The ally code for whoever you're wanting to look up",
                            type: "STRING"
                        },
                    ]
                },
                {
                    name: "best",
                    type: "SUB_COMMAND",
                    description: "Show the characters that have the best of a stat",
                    options: [
                        {
                            name: "stat",
                            required: true,
                            description: "Which stat you want it to show",
                            type: "STRING",
                            choices: [
                                { name: "Health", value: "Health" },
                                { name: "Protection", value: "Protection" },
                                { name: "Speed", value: "Speed" },
                                { name: "Potency", value: "Potency" },
                                { name: "Physical Critical Chance", value: "Physical Critical Chance" },
                                { name: "Physical Damage", value: "Physical Damage" },
                                { name: "Special Critical Chance", value: "Special Critical Chance" },
                                { name: "Special Damage", value: "Special Damage" },
                                { name: "Critical Damage", value: "Critical Damage" },
                                { name: "Tenacity", value: "Tenacity" },
                                { name: "Accuracy", value: "Accuracy" },
                                { name: "Armor", value: "Armor" },
                                { name: "Resistance", value: "Resistance" }
                            ]
                        },
                        {
                            name: "allycode",
                            description: "The ally code for whoever you're wanting to look up",
                            type: "STRING"
                        },
                        {
                            name: "total",
                            type: "BOOLEAN",
                            description: "Show the total stat, instead of just what the mods add on"
                        }
                    ]
                }
            ]
        });
    }

    async run(Bot, interaction, options) { // eslint-disable-line no-unused-vars
        const cooldown = await Bot.getPlayerCooldown(interaction.user.id);

        const subCommand = interaction.options.getSubcommand();
        let allycode = interaction.options.getString("allycode");
        allycode = await Bot.getAllyCode(interaction, allycode);

        if (!allycode) {
            return super.error(interaction, "I could not find a match for the provided ally code.");
        }
        await interaction.reply({content: interaction.language.get("COMMAND_MYMODS_WAIT")});

        if (subCommand === "character") {
            const searchChar = interaction.options.getString("character");

            let character;
            if (!searchChar) {
                return interaction.editReply({content: interaction.language.get("BASE_SWGOH_MISSING_CHAR")});
            }

            const chars = Bot.findChar(searchChar, Bot.characters);
            if (chars.length === 0) {
                return interaction.editReply({content: interaction.language.get("BASE_SWGOH_NO_CHAR_FOUND", searchChar)});
            } else if (chars.length > 1) {
                const charL = [];
                const charS = chars.sort((p, c) => p.name > c.name ? 1 : -1);
                charS.forEach(c => {
                    charL.push(c.name);
                });
                return super.error(interaction, (interaction.language.get("BASE_SWGOH_CHAR_LIST", charL.join("\n"))), {edit: true});
            } else {
                character = chars[0];
            }

            let player;
            try {
                player = await Bot.swgohAPI.unitStats(allycode, cooldown);
                if (Array.isArray(player)) player = player[0];
            } catch (e) {
                Bot.logger.error(e);
            }

            if (!player) {
                // TODO Lang this
                return super.error(interaction, ("Sorry, but I could not load your profile at this time."), {edit: true});
            }

            const footer = Bot.updatedFooter(player.updated, interaction, "player", cooldown);

            let charMods = player.roster.find(c => c.defId === character.uniqueName);

            if (!charMods) {
                return super.error(interaction, "Looks like you don't have that character activated yet.");
            }

            charMods = await Bot.swgohAPI.langChar(charMods, interaction.guildSettings.swgohLanguage);

            if (charMods) {
                charMods = charMods.mods;
                const slots = {};

                const sets = interaction.language.get("BASE_MODSETS_FROM_GAME");
                const stats = interaction.language.get("BASE_MODS_FROM_GAME");

                charMods.forEach(mod => {
                    slots[mod.slot] = {
                        stats: [],
                        type: sets[mod.set],
                        lvl: mod.level,
                        pip: mod.pips
                    };

                    // Add the primary in
                    slots[mod.slot].stats.push(`${mod.primaryStat.value} ${stats[mod.primaryStat.unitStat].replace("+", "").replace("%", "")}`);

                    // Then all the secondaries
                    mod.secondaryStat.forEach(s => {
                        let t = stats[s.unitStat];
                        if (t.indexOf("%") > -1) {
                            t = t.replace("%", "").trim();
                            s.value = s.value.toFixed(2) + "%";
                        }

                        let statStr = s.value;
                        if (s.roll > 0) statStr = `(${s.roll}) ${statStr}`;
                        statStr +=  " " + t;
                        slots[mod.slot].stats.push(statStr);
                    });
                });

                const fields = [];
                const modSlots = ["square", "arrow", "diamond", "triangle", "circle", "cross"];
                Object.keys(slots).forEach(mod => {
                    let typeIcon  = slots[mod].type;
                    let shapeIcon = modSlots[mod-1].toProperCase();
                    const stats = slots[mod].stats;
                    // If the bot has the right perms to use external emotes, go for it
                    if (!interaction.guild || interaction.channel.permissionsFor(interaction.guild.me).has("USE_EXTERNAL_EMOJIS")) {
                        const shapeIconString = `${modSlots[mod-1]}Mod${slots[mod].pip === 6 ? "Gold" : ""}`;
                        shapeIcon = Bot.emotes[shapeIconString] || shapeIcon;

                        const typeIconString = `modset${slots[mod].type.replace(/\s*/g, "")}`;
                        typeIcon = Bot.emotes[typeIconString] || typeIcon;
                    }
                    fields.push({
                        name: `${shapeIcon} ${typeIcon} (${slots[mod].pip}* Lvl: ${slots[mod].lvl})`,
                        value: `**${stats.shift()}**\n${stats.join("\n")}\n\`${"-".repeat(23)}\``,
                        inline: true
                    });
                });

                return interaction.editReply({content: null, embeds: [{
                    author: {
                        name: `${player.name}'s ${character.name}`,
                        icon_url: character.avatarURL
                    },
                    fields: fields,
                    footer: footer
                }]});
            } else {
                // They don't have the character
                return interaction.editReply({content: null, embeds: [{
                    author: {
                        name: player.name + "'s " + character.name
                    },
                    description: interaction.language.get("BASE_SWGOH_LOCKED_CHAR"),
                    footer: footer
                }]});
            }
        } else if (subCommand === "best") {
            const statToCheck = interaction.options.getString("stat");
            const showTotal = interaction.options.getBoolean("total");

            let player;
            try {
                player = await Bot.swgohAPI.unitStats(allycode, cooldown);
                if (Array.isArray(player)) player = player[0];
            } catch (e) {
                return super.error(interaction, Bot.codeBlock(e.message), {
                    title: interaction.language.get("BASE_SOMETHING_BROKE"),
                    footer: "Please try again in a bit."
                });
            }

            let updated, stats;
            if (player && player.roster) {
                updated = player.updated;
                stats = player.roster;
            }

            // Get rid of the ship listings
            const delArr = [];
            for (const c in stats) {
                if (Bot.ships.find(s => s.uniqueName === stats[c].defId)) {
                    delArr.push(c);
                }
            }
            for (const ix of delArr.reverse()) {
                stats.splice(ix, 1);
            }

            stats.forEach(c => {
                if (c.stats && c.stats.final && !c.stats.final[statToCheck]) {
                    c.stats.final[statToCheck] = 0;
                }
                if (c.stats && c.stats.mods && !c.stats.mods[statToCheck]) {
                    c.stats.mods[statToCheck] = 0;
                }
            });

            let sorted;
            if (showTotal) {  // If looking for the total stats
                sorted = stats.sort((p, c) => {
                    if (p.stats && c.stats && p.stats.final[statToCheck] && c.stats.final[statToCheck]) {
                        return c.stats.final[statToCheck] - p.stats.final[statToCheck];
                    } else if (!c.stats || !c.stats.final[statToCheck]) {
                        return -1;
                    } else {
                        return 1;
                    }
                });
            } else {  // Or if looking for just the amount added by mods
                sorted = stats.sort((p, c) => {
                    if (p.stats && c.stats && p.stats.mods  && c.stats.mods && p.stats.mods[statToCheck] && c.stats.mods[statToCheck]) {
                        return c.stats.mods[statToCheck] - p.stats.mods[statToCheck];
                    } else if (!c.stats || !c.stats.mods[statToCheck]) {
                        return -1;
                    } else {
                        return 1;
                    }
                });
            }


            for (const c in sorted) {
                sorted[c] = await Bot.swgohAPI.langChar(sorted[c], interaction.guildSettings.swgohLanguage);
            }

            const out = sorted.map(c => {
                const finalStat = c.stats && c.stats.final[statToCheck] ? (!c.stats.final[statToCheck] % 1 === 0 ? c.stats.final[statToCheck] : (c.stats.final[statToCheck] * 100).toFixed(2)+"%") : 0;
                const modStat = c.stats && c.stats.final[statToCheck] ? (!c.stats.final[statToCheck] % 1 === 0 ? `(${parseInt(c.stats.mods[statToCheck], 10)})` : `(${(c.stats.mods[statToCheck] * 100).toFixed(2)}%)`) : "";
                return {
                    stat: `${finalStat}${modStat.length ? " " + modStat : ""}`,
                    name: `: ${c.nameKey}`
                };
            });
            const longest = out.reduce((max, s) => Math.max(max, s.stat.length), 0);
            let outStr = "";
            for (let ix = 0; ix < 10; ix++) {
                outStr += "`" + out[ix].stat + ` ${Bot.zws}`.repeat(longest-out[ix].stat.length) + "`**" + out[ix].name + "**\n";
            }
            const author = {};
            if (showTotal) {
                // ${playerName}'s Highest ${stat} Characters
                author.name = interaction.language.get("COMMAND_MYMODS_HEADER_TOTAL", player.name, statToCheck);
            } else {
                // ${playerName}'s Best ${stat} From Mods
                author.name = interaction.language.get("COMMAND_MYMODS_HEADER_MODS", player.name, statToCheck);
            }

            const fields = [];
            if (stats.warnings) {
                fields.push({
                    name: "Warnings",
                    value: stats.warnings.join("\n")
                });
            }

            return interaction.editReply({content: null, embeds: [{
                author: author,
                description: "==============================\n" + outStr + "==============================",
                fields: fields,
                footer: {
                    text: updated ? interaction.language.get("BASE_SWGOH_LAST_UPDATED", Bot.duration(updated, interaction)) : ""
                }
            }]});
        }
    }
}

module.exports = MyMods;
