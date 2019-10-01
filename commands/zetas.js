const Command = require("../base/Command");

class Zetas extends Command {
    constructor(Bot) {
        super(Bot, {
            name: "zetas",
            category: "SWGoH",
            aliases: ["zeta", "z"],
            permissions: ["EMBED_LINKS"],
            flags: {
                "r": {
                    aliases: ["rec", "recommend", "recommendations"]
                },
                "g": {
                    aliases: ["guild"]
                },
                "h": {
                    aliases: ["heroic"]
                }
            }
        });
    }

    async run(Bot, message, args, options) { // eslint-disable-line no-unused-vars
        if (options.flags.g && options.flags.r) {
            return super.error(message, message.language.get("COMMAND_ZETA_CONFLICTING_FLAGS"));
        }

        const filters = ["pit", "pvp", "sith", "tank", "tb", "tw"];

        const {allyCode, searchChar, err} = await super.getUserAndChar(message, args, false);

        if (err) {
            return super.error(message, err);
        }

        if (searchChar && options.flags.r && !filters.includes(searchChar.toLowerCase())) {
            return super.error(message, message.language.get("COMMAND_ZETA_REC_BAD_FILTER", filters.join(", ")));
        }

        let character = null;
        if (searchChar && !options.flags.r) {
            const chars = Bot.findChar(searchChar, Bot.characters);

            if (chars.length > 1) {
                const charL = [];
                const charS = chars.sort((p, c) => p.name > c.name ? 1 : -1);
                charS.forEach(c => {
                    charL.push(c.name);
                });
                return super.error(message, message.language.get("COMMAND_GUILDSEARCH_CHAR_LIST", charL.join("\n")));
            } else if (chars.length === 1) {
                character = chars[0];
            } else {
                // No character found
                return super.error(message, message.language.get("BASE_SWGOH_NO_CHAR_FOUND", searchChar));
            }
        }

        const msg = await message.channel.send(options.flags.g ? message.language.get("COMMAND_ZETA_WAIT_GUILD") : message.language.get("BASE_SWGOH_PLS_WAIT_FETCH", "zetas"));

        const cooldown = await Bot.getPlayerCooldown(message.author.id);
        let player;

        try {
            player = await Bot.swgohAPI.player(allyCode, null, cooldown);
        } catch (e) {
            console.log("Error: Broke while trying to get player data in zetas: " + e);
            return super.error(msg, (message.language.get("BASE_SWGOH_NO_ACCT")), {edit: true});
        }

        player.roster = player.roster.filter(c => !c.crew || !c.crew.length);

        if (!options.flags.r && !options.flags.g) {
            // Just want to see your own zetas
            const zetas = {};
            let count = 0;
            for (let char of player.roster) {
                // If they are not looking for a specific character, check em all
                char = await Bot.swgohAPI.langChar(char, message.guildSettings.swgohLanguage);
                if (!character || character.uniqueName === char.defId) {
                    if (!char.nameKey) {
                        const tmp = Bot.characters.filter(c => c.uniqueName === char.defId);
                        if (tmp.length) {
                            char.nameKey = tmp[0].name;
                        }
                    }
                    char.skills.forEach(skill => {
                        if (skill && skill.isZeta && skill.tier === 8) {
                            count++;
                            // If the character is not already listed, add it
                            if (!zetas[char.nameKey]) {
                                zetas[char.nameKey] = ["`[" + skill.id.charAt(0) + "]` " + skill.nameKey];
                            } else {
                                zetas[char.nameKey].push("`[" + skill.id.charAt(0) + "]` " + skill.nameKey);
                            }
                        }
                    });
                }
            }

            const sorted = Object.keys(zetas).sort((p, c) => p > c ? 1 : -1);
            const desc = [], author = {};
            if (!character) {
                author.name = message.language.get("COMMAND_ZETA_ZETAS_HEADER", player.name, count);
                desc.push("`------------------------------`");
                sorted.forEach(character => {
                    desc.push(`\`(${zetas[character].length})\` ${character}`);
                });
                desc.push("`------------------------------`");
                desc.push(message.language.get("COMMAND_ZETA_MORE_INFO"));
            } else {
                author.name = `${player.name}'s ${character.name} (${count})`;
                author.icon_url = character.avatarURL;
                if (!zetas[sorted[0]] || zetas[sorted[0]].length === 0) {
                    desc.push(message.language.get("COMMAND_ZETA_NO_ZETAS"));
                } else {
                    desc.push(zetas[sorted[0]].join("\n"));
                }
            }

            const fields = [];
            if (options.defaults) {
                fields.push({
                    name: "Default flags used:",
                    value: Bot.codeBlock(options.defaults)
                });
            }
            if (player.warnings) {
                fields.push({
                    name: "Warnings",
                    value: player.warnings.join("\n")
                });
            }

            const footer = Bot.updatedFooter(player.updated, message, "player", cooldown);
            msg.edit({embed: {
                color: 0x000000,
                author: author,
                description: desc.join("\n"),
                fields: fields,
                footer: footer
            }});
        } else if (options.flags.r) {
            // Zeta recommendations
            const zetas = Bot.zetaRec;
            const myZetas = [];

            const sortBy = searchChar ? searchChar : "versa";
            if (!zetas || !zetas.zetas) {
                return super.error(msg, ("Something broke, I can't find the zetas list"), {edit: true});
            }
            const zetaSort = sortBy ? zetas.zetas.sort((a, b) => a[sortBy] - b[sortBy]) : zetas.zetas.sort((a, b) => a.toon - b.toon);
            for (let ix = 0; ix < zetaSort.length; ix ++) {
                if (myZetas.length >= 5) {
                    break;
                }
                if (zetaSort[ix][sortBy] === 0) {
                    continue;
                }
                let charN = await Bot.cache.get(Bot.config.mongodb.swapidb, "units", {nameKey: zetaSort[ix].toon, language: "eng_us"}, {_id: 0, updated: 0});
                if (!charN || !charN.length) continue;
                if (Array.isArray(charN)) charN = charN[0];
                let char = player.roster.find(c => charN.baseId === c.defId);
                let skill = null;
                if (char) {
                    char = await Bot.swgohAPI.langChar(char, "eng_us");
                    skill = char.skills.find(a => a.nameKey === zetaSort[ix].name);
                }
                if (skill && skill.tier < 8 && char.level >= 70 && char.gear >= 8) {
                    if (options.flags.h && char.rarity < 7) continue;
                    skill.toon = char.nameKey;
                    skill.gearLvl = char.gear;
                    skill.lvl = char.level;
                    skill.star = char.rarity;
                    myZetas.push(skill);
                }
            }

            let desc = message.language.get("COMMAND_ZETA_REC_HEADER");
            desc += "\n`" + filters.join(", ") + "`\n`------------------------------`\n";
            if (myZetas.length) {
                myZetas.forEach(z => {
                    desc += `**${z.nameKey}**\n${z.toon}\n\`${message.language.get("BASE_LEVEL_SHORT")}${z.lvl} | ⚙${z.gearLvl} | ${z.star}*\`\n${Bot.zws}\n`;
                });
            } else {
                // They don't have any viable characters (lvl or gear too low)
                desc += "Sorry, but it looks like you don't have any characters that meet the requirements of character lvl 70 and gear lvl 8 at this time.";
            }

            const zetaLen = `${myZetas.length} ${sortBy === "versa" ? "" : sortBy + " "}`;
            const fields = [];
            if (options.defaults) {
                fields.push({
                    name: "Default flags used:",
                    value: Bot.codeBlock(options.defaults)
                });
            }
            if (player.warnings) {
                fields.push({
                    name: "Warnings",
                    value: player.warnings.join("\n")
                });
            }
            const footer = Bot.updatedFooter(player.updated, message, "player", cooldown);
            return msg.edit({embed: {
                author: {
                    name: message.language.get("COMMAND_ZETA_REC_AUTH", zetaLen, player.name)
                },
                description: desc,
                fields: fields,
                footer: footer
            }});
        } else if (options.flags.g) {
            let guild = null;
            let guildGG = null;

            try {
                guild = await Bot.swgohAPI.guild(player.allyCode, null, cooldown);
                // TODO  Lang this
                if (!guild) return super.error(message, "Cannot find guild");
                if (!guild.roster) return super.error(message, "Cannot find your guild's roster");
            } catch (e) {
                return super.error(message, e.message);
            }
            try {
                guildGG = await Bot.swgohAPI.guildGG(guild.roster.map(p => p.allyCode), null, cooldown);
            } catch (e) {
                super.error(msg, e.message, {edit: true});
            }

            const zetas = {};

            for (const char of Object.keys(guildGG.roster)) {
                for (const player of guildGG.roster[char]) {
                    if (player.zetas.length) {
                        player.zetas.forEach(s => {
                            if (!zetas[char]) {
                                zetas[char] = {};
                            }

                            zetas[char][s.id] ? zetas[char][s.id].push(player.player) : zetas[char][s.id] = [player.player];
                        });
                    }
                }
            }

            const sortedZ = Object.keys(zetas).sort();

            const zOut = [];
            const fields = [];
            if (!searchChar || !searchChar.length) {
                // They want to see all zetas for the guild
                for (const char of sortedZ) {
                    let outStr = "**" + Bot.characters.find(c => c.uniqueName === char).name + "**\n";
                    for (const skill of Object.keys(zetas[char])) {
                        const s = await Bot.swgohAPI.abilities(skill, null, null, {min: true});
                        outStr += `**\`${zetas[char][skill].length}\`**: ${s[0].nameKey}\n`;
                    }
                    zOut.push(outStr);
                }
                const msgArr = Bot.msgArray(zOut, "", 1000);
                msgArr.forEach(m => {
                    fields.push({
                        name: "____",
                        value: m,
                        inline: true
                    });
                });
            } else {
                for (const skill of Object.keys(zetas[character.uniqueName])) {
                    const name = await Bot.swgohAPI.abilities(skill, null, null, {min: true});
                    fields.push({
                        name: name[0].nameKey,
                        value: zetas[character.uniqueName][skill].join("\n")
                    });
                }
            }

            if (options.defaults) {
                fields.push({
                    name: "Default flags used:",
                    value: Bot.codeBlock(options.defaults)
                });
            }

            const footer = Bot.updatedFooter(guild.updated, message, "guild", cooldown);
            return msg.edit({embed: {
                author: {
                    name: message.language.get("COMMAND_ZETA_ZETAS_HEADER", guild.name)
                },
                fields: fields,
                footer: footer
            }});

        }
    }
}

module.exports = Zetas;

