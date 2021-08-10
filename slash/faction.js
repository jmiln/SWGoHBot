const Command = require("../base/slashCommand");

class Faction extends Command {
    constructor(Bot) {
        super(Bot, {
            name: "faction",
            aliases: ["factions"],
            category: "Star Wars",
            permissions: ["EMBED_LINKS"],
            options: [
                {
                    name: "faction",
                    description: "The faction you want to look up",
                    type: "STRING",
                    required: true
                },
                {
                    name: "allycode",
                    description: "Ally code to look up the info for.",
                    type: "STRING",
                },
                {
                    name: "leader",
                    description: "Limit results to characters with the leader tag.",
                    type: "BOOLEAN"
                },
                {
                    name: "zeta",
                    description: "Limit results to characters with abilities that can be zeta'd.",
                    type: "BOOLEAN"
                }
            ]
        });
    }

    async run(Bot, interaction) {
        const charList = Bot.characters;

        const faction = interaction.options.getString("faction");
        const isLeader = interaction.options.getBoolean("leader");
        const isZeta = interaction.options.getBoolean("zeta");
        let allycode = interaction.options.getString("allycode");

        let extra = "";
        if (isLeader && isZeta) {
            extra = " with the Leader tag & Zeta abilities";
        } else if (isLeader) {
            extra = " with the Leader tag";
        } else if (isZeta) {
            extra = " with zeta abilities";
        }

        if (allycode) {
            try {
                allycode = await Bot.getAllyCode(interaction, allycode);
            } catch (e) {
                return super.error(interaction, e.message);
            }
        }

        const searchName = faction.toLowerCase().replace(/[^\w\s]/gi, "");

        if (!searchName || !searchName.length) {
            return super.error(interaction, interaction.language.get("COMMAND_FACTION_USAGE", interaction.guildSettings.prefix), {title: interaction.language.get("COMMAND_FACTION_MISSING_FACTION"), example: "faction sith"});
        }

        const factionChars = [];
        let search = searchName.replace(/[^\w\s]/g, "").replace(/s$/, "");
        if (search === "galactic republic") search = "affiliation_republic";
        const query = new RegExp(`^(?!.*selftag).*${search}.*`, "gi");
        let chars = await Bot.cache.get(Bot.config.mongodb.swapidb, "units", {categoryIdList: query, language: interaction.guildSettings.swgohLanguage.toLowerCase()}, {_id: 0, baseId: 1, nameKey: 1});

        // Filter out any ships that show up
        chars = chars.filter(c => charList.find(char => char.uniqueName === c.baseId));

        if (!chars.length) {
            return super.error(interaction, interaction.language.get("COMMAND_FACTION_USAGE", interaction.guildSettings.prefix), {title: interaction.language.get("COMMAND_FACTION_INVALID_FACTION"), example: "faction sith"});
        } else if (chars.length > 40) {
            return super.error(interaction, "Your query came up with too many results, please try and be more specific");
        } else {
            chars = chars.sort((a, b) => a.nameKey.toLowerCase() > b.nameKey.toLowerCase() ? 1 : -1);
        }

        // If they want just characters with leader abilities or zetas, filter em out
        if (isLeader || isZeta) {
            const units = [];

            for (const c of chars) {
                const char = await Bot.swgohAPI.getCharacter(c.baseId, interaction.guildSettings.swgohLanguage);
                units.push(char);
            }

            if (isLeader) {
                chars = chars.filter(c => {
                    const char = units.find(u => u.baseId === c.baseId);
                    const leader = char.skillReferenceList.filter(s => s.skillId.startsWith("leader"));
                    if (leader.length) return true;
                    return false;
                });
            }
            if (isZeta) {
                chars = chars.filter(c => {
                    const char = units.find(u => u.baseId === c.baseId);
                    const zetas = char.skillReferenceList.filter(s => s.cost.AbilityMatZeta > 0);
                    if (zetas.length > 0) return true;
                    return false;
                });
            }
        }
        if (allycode) {
            if (chars.length) {
                chars = chars.map(c => c.baseId);
                const cooldown = await Bot.getPlayerCooldown(interaction.user.id);
                let player;
                try {
                    player = await Bot.swgohAPI.unitStats(allycode, cooldown);
                    if (Array.isArray(player)) player = player[0];
                } catch (e) {
                    return super.error(interaction, e.message);
                }
                const playerChars = [];
                for (const c of chars) {
                    let found = player.roster.find(char => char.defId === c);
                    if (found) {
                        found = await Bot.swgohAPI.langChar(found, interaction.guildSettings.swgohLanguage);
                        found.gp = found.gp.toLocaleString();
                        playerChars.push(found);
                    }
                }

                const gpMax   = Math.max(...playerChars.map(c => c.gp.length));
                const gearMax = Math.max(...playerChars.map(c => c.gear.toString().length));
                const lvlMax  = Math.max(...playerChars.map(c => c.level.toString().length));

                factionChars.push(`**\`[ * | Lvl${" ".repeat(lvlMax)}|   GP  ${" ".repeat((gpMax > 5 ?  6 : gpMax) -5)}| ⚙${" ".repeat(gearMax)}]\`**`);
                factionChars.push("**`=================" + "=".repeat(lvlMax + gpMax + gearMax) + "`**");

                playerChars.forEach(c => {
                    const lvlStr  = " ".repeat(lvlMax  - c.level.toString().length) + c.level;
                    const gpStr   = " ".repeat(gpMax   - c.gp.length) + c.gp;
                    const gearStr = " ".repeat(gearMax - c.gear.toString().length) + c.gear;
                    const zetas   = "z".repeat(c.skills.filter(s => s.isZeta && s.tier === s.tiers).length);
                    factionChars.push(`**\`[ ${c.rarity} |  ${lvlStr}  | ${gpStr} | ${gearStr} ]\` ${zetas}${c.nameKey}**`);
                });
                const msgArray = Bot.msgArray(factionChars, "\n", 1000);
                const fields = [];
                let desc;
                if (msgArray.length > 1) {
                    msgArray.forEach((m, ix) => {
                        fields.push({
                            name: `${ix+1}`,
                            value: m
                        });
                    });
                } else {
                    desc = msgArray[0];
                }

                const footer = Bot.updatedFooter(player.updated, interaction, "player", cooldown);
                return interaction.reply({embeds: [{
                    author: {
                        name: player.name + "'s matches for " + searchName.toProperCase() + extra
                    },
                    description: desc,
                    fields: fields,
                    footer: footer
                }]});
            } else {
                return super.error(interaction, interaction.language.get("COMMAND_FACTION_USAGE", interaction.guildSettings.prefix), {title: interaction.language.get("COMMAND_FACTION_INVALID_FACTION"), example: "faction sith"});
            }
        } else {
            return interaction.reply({embeds: [{
                author: {
                    name: "Matches for " + searchName.toProperCase() + extra
                },
                description: chars.map(c => c.nameKey).join("\n")
            }]});
        }
    }
}

module.exports = Faction;
