const Command = require("../base/Command");

class Faction extends Command {
    constructor(Bot) {
        super(Bot, {
            name: "faction",
            aliases: ["factions"],
            category: "Star Wars",
            permissions: ["EMBED_LINKS"],
            flags: {
                leader: {
                    aliases: ["leaders", "l"]
                },
                zetas: {
                    aliases: ["zeta", "z"]
                }
            }
        });
    }

    async run(Bot, message, args, options) {
        const charList = Bot.characters;
        let allyCode = null;
        if (!args[0]) {
            return super.error(message, message.language.get("COMMAND_FACTION_USAGE", message.guildSettings.prefix), {title: message.language.get("COMMAND_FACTION_MISSING_FACTION"), example: "faction sith"});
        }
        if (args[0].toLowerCase() === "me" || Bot.isAllyCode(args[0]) || Bot.isUserID(args[0])) {
            allyCode = args.splice(0, 1);
            try {
                allyCode = await Bot.getAllyCode(message, allyCode);
            } catch (e) {
                return super.error(message, e.message);
            }
        }

        const searchName = String(args.join(" ")).toLowerCase().replace(/[^\w\s]/gi, "");

        if (!searchName || !searchName.length || searchName === "") {
            return super.error(message, message.language.get("COMMAND_FACTION_USAGE", message.guildSettings.prefix), {title: message.language.get("COMMAND_FACTION_MISSING_FACTION"), example: "faction sith"});
        }

        const factionChars = [];
        let search = searchName.replace(/[^\w]/g, "").replace(/s$/, "");
        if (searchName.toLowerCase() === "galactic republic") search = "affiliation_republic";
        const query = new RegExp(`^(?!.*selftag).*${search}.*`, "gi");
        let chars = await Bot.cache.get(Bot.config.mongodb.swapidb, "units", {categoryIdList: query, language: message.guildSettings.swgohLanguage.toLowerCase()}, {_id: 0, baseId: 1, nameKey: 1});

        // Filter out any ships that show up
        chars = chars.filter(c => charList.find(char => char.uniqueName === c.baseId));

        if (!chars.length) {
            return super.error(message, message.language.get("COMMAND_FACTION_USAGE", message.guildSettings.prefix), {title: message.language.get("COMMAND_FACTION_INVALID_FACTION"), example: "faction sith"});
        } else if (chars.length > 40) {
            return super.error(message, "Your query came up with too many results, please try and be more specific");
        } else {
            chars = chars.sort((a, b) => a.nameKey.toLowerCase() > b.nameKey.toLowerCase() ? 1 : -1);
        }

        // If they want just characters with leader abilities or zetas, filter em out
        if (options.flags.leader || options.flags.zetas) {
            const units = [];

            for (const c of chars) {
                const char = await Bot.swgohAPI.getCharacter(c.baseId, message.guildSettings.swgohLanguage);
                units.push(char);
            }

            if (options.flags.leader) {
                chars = chars.filter(c => {
                    const char = units.find(u => u.baseId === c.baseId);
                    const leader = char.skillReferenceList.filter(s => s.skillId.startsWith("leader"));
                    if (leader.length) return true;
                    return false;
                });
            }
            if (options.flags.zetas) {
                chars = chars.filter(c => {
                    const char = units.find(u => u.baseId === c.baseId);
                    const zetas = char.skillReferenceList.filter(s => s.cost.AbilityMatZeta > 0);
                    if (zetas.length > 0) return true;
                    return false;
                });
            }
        }
        if (allyCode) {
            if (chars.length) {
                chars = chars.map(c => c.baseId);
                const cooldown = await Bot.getPlayerCooldown(message.author.id);
                let player;
                try {
                    player = await Bot.swgohAPI.unitStats(allyCode, cooldown);
                    if (Array.isArray(player)) player = player[0];
                } catch (e) {
                    return super.error(message, e.message);
                }
                const playerChars = [];
                for (const c of chars) {
                    let found = player.roster.find(char => char.defId === c);
                    if (found) {
                        found = await Bot.swgohAPI.langChar(found, message.guildSettings.swgohLanguage);
                        found.gp = found.gp.toLocaleString();
                        playerChars.push(found);
                    }
                }

                const gpMax   = Math.max(...playerChars.map(c => c.gp.length));
                const gearMax = Math.max(...playerChars.map(c => c.gear.toString().length));
                const lvlMax  = Math.max(...playerChars.map(c => c.level.toString().length));

                factionChars.push(`**\`[ * | Lvl${" ".repeat(lvlMax)}|   GP  ${" ".repeat(gpMax-5)}| ⚙${" ".repeat(gearMax)}]\`**`);
                factionChars.push("**`=================" + "=".repeat(lvlMax + gpMax + gearMax) + "`**");

                playerChars.forEach(c => {
                    const lvlStr  = " ".repeat(lvlMax  - c.level.toString().length) + c.level;
                    const gpStr   = " ".repeat(gpMax   - c.gp.length) + c.gp;
                    const gearStr = " ".repeat(gearMax - c.gear.toString().length) + c.gear;
                    const zetas   = "z".repeat(c.skills.filter(s => s.isZeta && s.tier === 8).length);
                    factionChars.push(`**\`[ ${c.rarity} |  ${lvlStr}  | ${gpStr} | ${gearStr} ]\` ${zetas}${c.nameKey}**`);
                });
                const msgArray = Bot.msgArray(factionChars, "\n", 1000);
                const fields = [];
                let desc;
                if (msgArray.length > 1) {
                    msgArray.forEach((m, ix) => {
                        fields.push({
                            name: ix+1,
                            value: m
                        });
                    });
                } else {
                    desc = msgArray[0];
                }
                if (options.defaults) {
                    fields.push({
                        name: "Default flags used:",
                        value: Bot.codeBlock(options.defaults)
                    });
                }

                const footer = Bot.updatedFooter(player.updated, message, "player", cooldown);
                return message.channel.send({embed: {
                    author: {
                        name: player.name + "'s matches for " + searchName.toProperCase()
                    },
                    description: desc,
                    fields: fields,
                    footer: footer
                }});
            } else {
                return super.error(message, message.language.get("COMMAND_FACTION_USAGE", message.guildSettings.prefix), {title: message.language.get("COMMAND_FACTION_INVALID_FACTION"), example: "faction sith"});
            }
        } else {
            return message.channel.send({embed: {
                author: {
                    name: "Matches for " + searchName.toProperCase()
                },
                description: chars.map(c => c.nameKey).join("\n")
            }});
        }
    }
}

module.exports = Faction;
