const Command = require("../base/Command");

class Faction extends Command {
    constructor(client) {
        super(client, {
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

    async run(client, message, args, options) {
        const charList = client.characters;
        let allyCode = null;
        if (!args[0]) {
            return super.error(message, message.language.get("COMMAND_FACTION_USAGE", message.guildSettings.prefix), {title: message.language.get("COMMAND_FACTION_MISSING_FACTION"), example: "faction sith"});
        } 
        if (args[0].toLowerCase() === "me" || client.isAllyCode(args[0]) || client.isUserID(args[0])) {
            allyCode = args.splice(0, 1);
            allyCode = await client.getAllyCode(message, allyCode);
        }

        const searchName = String(args.join(" ")).toLowerCase().replace(/[^\w\s]/gi, "");

        if (!searchName || !searchName.length || searchName === "") {
            return super.error(message, message.language.get("COMMAND_FACTION_USAGE", message.guildSettings.prefix), {title: message.language.get("COMMAND_FACTION_MISSING_FACTION"), example: "faction sith"});
        }

        const factionChars = [];
        const search = searchName.replace(/[^\w]/g, "").replace(/s$/, "");
        const query = new RegExp(`^(?!.*selftag).*${search}.*`, "gi");
        let chars = await client.cache.get("swapi", "units", {categoryIdList: query, language: message.guildSettings.swgohLanguage.toLowerCase()}, {_id: 0, baseId: 1, nameKey: 1});

        // Filter out any ships that show up
        chars = chars.filter(c => charList.find(char => char.uniqueName === c.baseId));

        // Filter out 
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
                const char = await client.swgohAPI.getCharacter(c.baseId, message.guildSettings.swgohLanguage);
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
                const cooldown = client.getPlayerCooldown(message.author.id);
                const player = await client.swgohAPI.player(allyCode, null, cooldown);
                const playerChars = [];
                for (const c of chars) {
                    let found = player.roster.find(char => char.defId === c);
                    if (found) {
                        found = await client.swgohAPI.langChar(found, message.guildSettings.swgohLanguage); 
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
                const msgArray = client.msgArray(factionChars, "\n", 1000);
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

                const footer = client.updatedFooter(player.updated, message, "player", cooldown);
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
