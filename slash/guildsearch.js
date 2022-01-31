const Command = require("../base/slashCommand");
// const {inspect} = require('util');

class GuildSearch extends Command {
    constructor(Bot) {
        super(Bot, {
            name: "guildsearch",
            guildOnly: false,
            category: "SWGoH",
            aliases: ["search", "gs"],
            description: "Display stats for a guild's character",
            permissions: ["EMBED_LINKS"],
            options: [
                // STRING ac, character, sort, stat
                {
                    name: "character",
                    description: "The character you want to display",
                    type: "STRING",
                    required: true
                },
                {
                    name: "allycode",
                    description: "An ally code to determine which guild you're wanting to look up",
                    type: "STRING"
                },
                {
                    name: "sort",
                    description: "Choose what to sort by",
                    type: "STRING",
                    choices: [
                        { name: "Gear", value: "gear" },
                        { name: "GP", value: "gp" },
                        { name: "Name", value: "name" }
                    ]
                },
                {
                    name: "stat",
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
                // INTEGER: top, rarity/ stars
                {
                    name: "top",
                    description: "View only the top x in the list (1-50)",
                    type: "INTEGER",
                    min_value: 0,
                    max_value: 50,
                },
                {
                    name: "rarity",
                    description: "View only X rarity (Star lvl) and above. (1-7)",
                    type: "INTEGER",
                    min_value: 0,
                    max_value: 7,
                },
                // BOOL: ship, reverse, zetas
                {
                    name: "ship",
                    description: "Force it to look for just ships",
                    type: "BOOLEAN"
                },
                {
                    name: "reverse",
                    description: "Reverse the sort order",
                    type: "BOOLEAN"
                },
                {
                    name: "zetas",
                    description: "Show only results that have zeta'd abilities",
                    type: "BOOLEAN"
                },
            ]
        });
    }

    async run(Bot, interaction, args, options) { // eslint-disable-line no-unused-vars
        // Get all the string options
        const searchChar = interaction.options.getString("character");
        const sort       = interaction.options.getString("sort");
        const stat       = interaction.options.getString("stat");
        let allycode     = interaction.options.getString("allycode");

        // If an ally code is supplied, try using it
        // If not, it'll try grabbing the primary registered code of the author
        allycode = await Bot.getAllyCode(interaction, allycode, true);

        if (!allycode) {
            return super.error(interaction, "I could not find a valid ally code for you. Please make sure to supply one.");
        }

        // Get the one integer option
        const top = interaction.options.getInteger("top");
        if (top && (isNaN(top) || top <= 0 || top > 50)) {
            return super.error(interaction, "Invalid argument for top. Must be between 1 and 50");
        }

        const starLvl = interaction.options.getInteger("rarity") || 0;
        if (starLvl < 0 || starLvl > 7) {
            return super.error(interaction, interaction.language.get("COMMAND_GUILDSEARCH_BAD_STAR"));
        }

        // Get the boolean options
        const isShip    = interaction.options.getBoolean("ship");
        const doReverse = interaction.options.getBoolean("reverse");
        const doZeta    = interaction.options.getBoolean("zetas");

        const rarityMap = {
            "ONESTAR":   1,
            "TWOSTAR":   2,
            "THREESTAR": 3,
            "FOURSTAR":  4,
            "FIVESTAR":  5,
            "SIXSTAR":   6,
            "SEVENSTAR": 7
        };

        if (isShip && stat) {
            return super.error(interaction, interaction.language.get("COMMAND_GUILDSEARCH_SHIP_STATS"));
        }

        let character = null, chars = null;
        if (isShip) {
            chars = Bot.findChar(searchChar, Bot.ships, true);
        } else {
            chars = Bot.findChar(searchChar, Bot.characters);
            if (!chars?.length) {
                chars = Bot.findChar(searchChar, Bot.ships, true);
            }
        }

        if (!chars?.length) {
            // No character found, so error
            return super.error(interaction, interaction.language.get("COMMAND_GUILDSEARCH_NO_RESULTS", searchChar));
        } else if (chars.length > 1) {
            // Too many characters found, give a list of possible matches
            const charSorted = chars
                .sort((p, c) => p.name > c.name ? 1 : -1)   // Sort the characters by name
                .map(c => c.name);                          // Map it to just show the name strings
            return super.error(interaction, interaction.language.get("COMMAND_GUILDSEARCH_CHAR_LIST", charSorted.join("\n")));
        } else {
            // If there's just one match, use it
            character = chars[0];
        }

        await interaction.reply({content: interaction.language.get("COMMAND_GUILDSEARCH_PLEASE_WAIT")});
        const cooldown = await Bot.getPlayerCooldown(interaction.user.id);

        let guild = null;
        try {
            guild = await Bot.swgohAPI.guild(allycode, null, cooldown);
        } catch (e) {
            if (e.toString().indexOf("player is not in a guild") > -1) {
                return super.error(interaction, "Sorry, but it looks like that player is not in a guild");
            }
            return super.error(interaction, Bot.codeBlock(e) + "Please try again in a bit.", {title: "Something Broke while getting your guild's roster"});
        }
        if (!guild || !guild.roster || !guild.roster.length) {
            return interaction.editReply({content: interaction.language.get("BASE_SWGOH_NO_GUILD")});
        } else {
            interaction.editReply({content: "Found guild `" + guild.name + "`!"});

            const oldLen = guild.roster.length;
            guild.roster = guild.roster.filter(m => m.allyCode !== null);
            if (guild.roster.length !== oldLen) {
                guild.warnings = guild.warnings || [];
                guild.warnings.push(`Could not get info for ${oldLen - guild.roster.length} players`);
            }
        }

        if (stat) {
            // Looking for a stat
            const outArr = [];

            const gAllycodes = guild.roster.sort((a, b) => a.name.toLowerCase() > b.name.toLowerCase() ? 1 : -1).map(m => m.allyCode);

            if (!gAllycodes.length) {
                return super.error(interaction, "I can't find any players in the requested guild.", {edit: true});
            }
            const gStats = await Bot.swgohAPI.guildStats(gAllycodes, character.uniqueName, cooldown);

            let sortedMembers = gStats.filter(gChar => gChar?.gp).sort((a, b) => {
                if (!a.stats || !a.stats.final) return -1;
                if (!b.stats || !b.stats.final) return 1;
                if (!a.stats.final[stat]) a.stats.final[stat] = 0;
                if (!b.stats.final[stat]) b.stats.final[stat] = 0;
                return a.stats.final[stat] < b.stats.final[stat] ? 1 : -1;
            });

            if (top) {
                // if (!doReverse) sortedMembers = sortedMembers.reverse();
                const start = doReverse ? sortedMembers.length - top : 0;
                const end   = doReverse ? sortedMembers.length       : top;
                sortedMembers = sortedMembers.slice(start, end);
                if (doReverse) {
                    sortedMembers = sortedMembers.reverse();
                }
            }

            sortedMembers.forEach( member => {
                const stats = member.stats;
                if (!stats?.final) {
                    return;
                }
                Object.keys(stats.final).forEach(s => {
                    if (stats.final[s] % 1 !== 0) {
                        stats[s] = (stats.final[s] * 100).toFixed(2) + "%";
                    } else {
                        stats[s] = stats.final[s] ? stats.final[s].toLocaleString() : "N/A";
                    }
                });
                stats.player = guild.roster.find(m => m.allyCode === member.allyCode).name;
                stats.gp     = member.gp ? member.gp.toLocaleString() : 0;
                stats.gear   = member.gear;
                if (!stats.Protection) stats.Protection = 0;
                outArr.push(stats);
            });

            const checkableStats = {
                "Health":                   { short: "HP" },
                "Protection":               { short: "Prot" },
                "Speed":                    { short: "Spd" },
                "Potency":                  { short: "Pot" },
                "Physical Critical Chance": { short: "CC" },
                "Physical Damage":          { short: "PD" },
                "Special Critical Chance":  { short: "CC" },
                "Special Damage":           { short: "SD" },
                "Critical Damage":          { short: "CD" },
                "Tenacity":                 { short: "Ten" },
                "Accuracy":                 { short: "Acc" },
                "Armor":                    { short: "Arm" },
                "Resistance":               { short: "Res" }
            };

            const fields = [];
            if (!outArr.length) {
                fields.push({
                    name: character.name,
                    value: interaction.language.get("COMMAND_GUILDSEARCH_NO_CHARACTER")
                });
            } else {
                const header = {
                    gear: {value: "⚙", startWith: "`[", endWith: "|", align: "right"},
                    gp: {value: "GP", endWith: "|", align: "right"}
                };
                header[stat] = {value: checkableStats[stat].short, endWith: "]`", align: "right"};
                header.player = {value:"", align: "left"};

                const outTable = Bot.makeTable(header, outArr);

                if (outTable.length) {
                    const outMsgArr = Bot.msgArray(outTable, "\n", 700);
                    outMsgArr.forEach((m, ix) => {
                        const name = (ix === 0) ? interaction.language.get("COMMAND_GUILDSEARCH_SORTED_BY", character.name, stat, doReverse) : interaction.language.get("BASE_CONT_STRING");
                        fields.push({
                            name: name,
                            value: m
                        });
                    });
                } else {
                    fields.push({
                        name: "-",
                        value: interaction.language.get("BASE_SWGOH_GUILD_LOCKED_CHAR")
                    });
                }
            }

            const footer = Bot.updatedFooter(guild.updated, interaction, "guild", cooldown);
            return interaction.editReply({embeds: [{
                author: {
                    name: guild.name
                },
                fields: fields,
                footer: footer
            }]});
        }  else {
            // Not looking for stat info
            const sortType = sort ? sort : "name";
            let guildChar;
            try {
                guildChar = await Bot.swgohAPI.guildStats(guild.roster.map(p => p.allyCode), character.uniqueName, cooldown);
            } catch (e) {
                return super.error(interaction, Bot.codeBlock(e), {title: "Something Broke while getting your guild's characters", footer: "Please try again in a bit", edit: true});
            }

            for (const ch of guildChar) {
                ch.zetas = ch.skills.filter(s => s.isZeta && s.tier === s.tiers);
            }

            if (!guildChar || guildChar.length === 0 || (starLvl > 0 && !guildChar.filter(c => c.rarity >= starLvl).length) || (doZeta && !guildChar.filter(c => c.zetas.length > 0).length)) {
                let desc = "";
                if (doZeta && !guildChar.filter(c => c.zetas.length > 0).length) {
                    desc = interaction.language.get("COMMAND_GUILDSEARCH_NO_ZETAS");
                } else if (isShip && starLvl > 0) {
                    desc = interaction.language.get("COMMAND_GUILDSEARCH_NO_SHIP_STAR", starLvl);
                } else if (starLvl > 0) {
                    desc = interaction.language.get("COMMAND_GUILDSEARCH_NO_CHARACTER_STAR", starLvl);
                } else if (isShip) {
                    desc = interaction.language.get("COMMAND_GUILDSEARCH_NO_SHIP");
                } else {
                    desc = interaction.language.get("COMMAND_GUILDSEARCH_NO_CHARACTER");
                }
                return super.error(interaction, desc, {
                    title: interaction.language.get("BASE_SWGOH_NAMECHAR_HEADER", guild.name, character.name),
                    footer: interaction.language.get("BASE_SWGOH_LAST_UPDATED", Bot.duration(guild.updated, interaction)),
                    edit: true
                });
            }

            const totalUnlocked = guildChar.filter(c => c.rarity > 0).length;

            // Can get the order from abilities table => skillReferenceList
            let maxZ = 0;
            const zetas = [];
            let apiChar;
            try {
                apiChar = await Bot.swgohAPI.getCharacter(character.uniqueName);
            } catch (e) {
                return super.error(interaction, "Couldn't get the character - " + e);
            }
            for (const ab of apiChar.skillReferenceList) {
                if (ab.cost && ab.cost.AbilityMatZeta > 0) {
                    maxZ = maxZ + 1;
                    zetas.push(ab.skillId);
                }
            }

            let sortedGuild = [];
            if (sortType === "name") {
                // Sort by name
                sortedGuild = guildChar.sort((p, c) => p.player.toLowerCase() > c.player.toLowerCase() ? 1 : -1);
            } else if (["gp", "gear"].includes(sortType)) {
                // Sort by whichever it needs to
                sortedGuild = guildChar.sort((p, c) => p[sortType] > c[sortType] ? 1 : -1);
            }

            if (top) {
                const start = !doReverse ? sortedGuild.length - top : 0;
                const end   = !doReverse ? sortedGuild.length       : top;
                sortedGuild = sortedGuild.slice(start, end);
            }
            if (doReverse) {
                sortedGuild = sortedGuild.reverse();
            }

            const charOut = {};
            const hasRelic = sortedGuild.filter(mem => mem?.relic?.currentTier > 2).length;
            for (const member of sortedGuild) {
                if (doZeta && !member.zetas.length) continue;

                if (isNaN(parseInt(member.rarity, 10))) member.rarity = rarityMap[member.rarity];

                const gearStr = Bot.getGearStr(member, "⚙").padEnd(hasRelic ? 5 : 3);
                let z = " | ";
                zetas.forEach((zeta, ix) => {
                    const pZeta = member.zetas.find(pz => pz.id === zeta);
                    if (!pZeta) {
                        z += " ";
                    } else {
                        z += (ix + 1).toString();
                    }
                });
                const gpStr = parseInt(member.gp, 10).toLocaleString();

                let uStr;
                if (member.rarity > 0) {
                    if (isShip) {
                        uStr = `**\`[Lvl ${member.level} | ${gpStr + " ".repeat(6 - gpStr.length)}${maxZ > 0 ? z : ""}]\`** ${member.player}`;
                    } else {
                        uStr = `**\`[${gearStr} | ${gpStr + " ".repeat(6 - gpStr.length)}${maxZ > 0 ? z : ""}]\`** ${member.player}`;
                    }
                } else {
                    uStr = member.player;
                }

                uStr = Bot.expandSpaces(uStr);

                if (!charOut[member.rarity]) {
                    charOut[member.rarity] = [uStr];
                } else {
                    charOut[member.rarity].push(uStr);
                }
            }

            const fields = [];
            let outArr;

            if (top) {
                outArr = Object.keys(charOut);
            } else {
                if (doReverse) {
                    outArr = Object.keys(charOut).reverse();
                } else {
                    outArr = Object.keys(charOut);
                }
            }

            outArr.forEach(star => {
                if (star >= starLvl) {
                    const msgArr = Bot.msgArray(charOut[star], "\n", 700);
                    msgArr.forEach((msg, ix) => {
                        const name = star === 0 ? interaction.language.get("COMMAND_GUILDSEARCH_NOT_ACTIVATED", charOut[star].length) : interaction.language.get("COMMAND_GUILDSEARCH_STAR_HEADER", star, charOut[star].length);
                        fields.push({
                            name: msgArr.length > 1 ? name + ` (${ix+1}/${msgArr.length})` : name,
                            value: msgArr[ix]
                        });
                    });
                }
            });
            if (guild.warnings) {
                let warn = guild.warnings.join("\n");
                if (warn.length < 1024) {
                    warn = warn.slice(0,1000) + "...";
                }
                fields.push({
                    name: "Guild Roster Warnings",
                    value: warn
                });
            }
            if (guildChar.warnings) {
                let warn = guildChar.warnings.join("\n");
                if (warn.length < 1024) {
                    warn = warn.slice(0,1000) + "...";
                }
                fields.push({
                    name: "Guild Character Warnings",
                    value: warn
                });
            }

            fields.forEach(f => {
                if (f.value.length > 1000) {
                    f.value = f.value.slice(0,1000) +  "...";
                }
            });

            const footer = Bot.updatedFooter(guildChar.updated, interaction, "guild", cooldown);
            try {
                interaction.editReply({embeds: [{
                    author: {
                        name: interaction.language.get("BASE_SWGOH_NAMECHAR_HEADER_NUM", guild.name, character.name, totalUnlocked)
                    },
                    fields: fields,
                    footer: footer
                }]});
            } catch (e) {
                Bot.logger.error("ERROR", "Error sending message in guildsearch - " + e);
                Bot.logger.error(fields);
            }
        }
    }
}

module.exports = GuildSearch;
