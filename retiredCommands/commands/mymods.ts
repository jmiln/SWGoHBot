const Command = require("../base/Command");

class MyMods extends Command {
    constructor(Bot) {
        super(Bot, {
            name: "mymods",
            category: "SWGoH",
            guildOnly: false,
            aliases: ["charactermods", "charmods", "cmods", "cm", "mm"],
            permissions: ["EMBED_LINKS"],
            subArgs: {
                b: {
                    aliases: ["best"]
                }
            },
            flags: {
                t: {
                    aliases: ["total"]
                }
            }
        });
    }

    async run(Bot, message, args, options) { // eslint-disable-line no-unused-vars
        const cooldown = await Bot.getPlayerCooldown(message.author.id);

        const {allyCode, searchChar, err} = await super.getUserAndChar(message, args, false);

        if (err) {
            return message.channel.send({embeds: [{
                author: {
                    name: "Error"
                },
                description: err
            }]});
        }

        const msg = await message.channel.send({content: message.language.get("COMMAND_MYMODS_WAIT")});

        if (!options.subArgs.b) {
            let character;
            if (!searchChar) {
                return msg.edit({content: message.language.get("BASE_SWGOH_MISSING_CHAR")});
            }

            const chars = Bot.findChar(searchChar, Bot.characters);
            if (chars.length === 0) {
                return msg.edit({content: message.language.get("BASE_SWGOH_NO_CHAR_FOUND", searchChar)});
            } else if (chars.length > 1) {
                const charL = [];
                const charS = chars.sort((p, c) => p.name > c.name ? 1 : -1);
                charS.forEach(c => {
                    charL.push(c.name);
                });
                return super.error(msg, (message.language.get("BASE_SWGOH_CHAR_LIST", charL.join("\n"))), {edit: true});
            } else {
                character = chars[0];
            }

            let player;
            try {
                player = await Bot.swgohAPI.unitStats(allyCode, cooldown);
                if (Array.isArray(player)) player = player[0];
            } catch (e) {
                Bot.logger.error(e);
            }

            if (!player) {
                // TODO Lang this
                return super.error(msg, ("Sorry, but I could not load your profile at this time."), {edit: true});
            }

            const footer = Bot.updatedFooter(player.updated, message, "player", cooldown);

            let charMods = player.roster.find(c => c.defId === character.uniqueName);

            if (!charMods) {
                return super.error(msg, "Looks like you don't have that character activated yet.");
            }

            charMods = await Bot.swgohAPI.langChar(charMods, message.guildSettings.swgohLanguage);

            if (charMods) {
                charMods = charMods.mods;
                const slots = {};

                const sets = message.language.get("BASE_MODSETS_FROM_GAME");
                const stats = message.language.get("BASE_MODS_FROM_GAME");

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
                    let shapeIcon = Bot.toProperCase(modSlots[mod-1]);
                    const stats = slots[mod].stats;
                    // If the bot has the right perms to use external emotes, go for it
                    if (!message.guild || message.channel.permissionsFor(message.guild.me).has("USE_EXTERNAL_EMOJIS")) {
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

                if (options.defaults) {
                    fields.push({
                        name: "Default flags used:",
                        value: Bot.codeBlock(options.defaults)
                    });
                }

                msg.edit({embeds: [{
                    author: {
                        name: `${player.name}'s ${character.name}`,
                        icon_url: character.avatarURL
                    },
                    fields: fields,
                    footer: footer
                }]});
            } else {
                // They don't have the character
                msg.edit({embeds: [{
                    author: {
                        name: player.name + "'s " + character.name
                    },
                    description: message.language.get("BASE_SWGOH_LOCKED_CHAR"),
                    footer: footer
                }]});
            }
        } else {
            const checkableStats = {
                "Health": {
                    aliases: ["HP"]
                },
                "Protection": {
                    aliases: ["Prot"]
                },
                "Speed": {
                    aliases: ["spd"]
                },
                "Potency": {
                    aliases: ["Pot"]
                },
                "Physical Critical Chance": {
                    aliases: ["PCC", "CC", "Crit Chance", "Critical Chance", "Physical Crit Chance"],
                },
                "Special Critical Chance": {
                    aliases: ["SCC", "Special Crit Chance"]
                },
                "Critical Damage": {
                    aliases: ["CD", "Crit Damage"]
                },
                "Tenacity": {
                    aliases: ["Ten"]
                },
                "Accuracy": {
                    aliases: []
                },
                "Armor": {
                    aliases: []
                },
                "Resistance": {
                    aliases: ["Res", "Resist"]
                }
            };
            let found = false;
            if (searchChar && searchChar.length) options.subArgs.b = options.subArgs.b + " " + searchChar;
            if (Object.keys(checkableStats).filter(c => c.toLowerCase() === options.subArgs.b.toLowerCase()).length > 0) {
                options.subArgs.b = Bot.toProperCase(options.subArgs.b);
                found = true;
            } else {
                Object.keys(checkableStats).forEach(s => {
                    if (checkableStats[s].aliases.filter(c => c.toLowerCase() === options.subArgs.b.toLowerCase()).length > 0) {
                        options.subArgs.b = s;
                        found = true;
                        return;
                    }
                });
            }
            if (!found) {
                return super.error(msg, (message.language.get("COMMAND_MYMODS_BAD_STAT", Bot.codeBlock(Object.keys(checkableStats).join("\n")))), {edit: true});
            }
            const statToCheck = options.subArgs.b;
            let player;
            try {
                player = await Bot.swgohAPI.unitStats(allyCode, cooldown);
                if (Array.isArray(player)) player = player[0];
            } catch (e) {
                return super.error(message, Bot.codeBlock(e.message), {
                    title: message.language.get("BASE_SOMETHING_BROKE"),
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
            if (options.flags.t) {  // If looking for the total stats
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
                sorted[c] = await Bot.swgohAPI.langChar(sorted[c], message.guildSettings.swgohLanguage);
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
            if (options.flags.t) {
                // ${playerName}'s Highest ${stat} Characters
                author.name = message.language.get("COMMAND_MYMODS_HEADER_TOTAL", player.name, options.subArgs.b);
            } else {
                // ${playerName}'s Best ${stat} From Mods
                author.name = message.language.get("COMMAND_MYMODS_HEADER_MODS", player.name, options.subArgs.b);
            }

            const fields = [];
            if (options.defaults) {
                fields.push({
                    name: "Default flags used:",
                    value: Bot.codeBlock(options.defaults)
                });
            }
            if (stats.warnings) {
                fields.push({
                    name: "Warnings",
                    value: stats.warnings.join("\n")
                });
            }

            return msg.edit({embeds: [{
                author: author,
                description: "==============================\n" + outStr + "==============================",
                fields: fields,
                footer: {
                    text: updated ? message.language.get("BASE_SWGOH_LAST_UPDATED", Bot.duration(updated, message)) : ""
                }
            }]});
        }
    }
}

module.exports = MyMods;
