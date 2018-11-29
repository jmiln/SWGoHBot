const Command = require("../base/Command");

class Faction extends Command {
    constructor(client) {
        super(client, {
            name: "faction",
            aliases: ["factions"],
            category: "Star Wars",
            permissions: ["EMBED_LINKS"]
        });
    }

    async run(client, message, args) {
        const charList = client.characters;
        let allyCode = null;
        if (!args[0]) {
            return message.channel.send(message.language.get("COMMAND_FACTION_INVALID_CHAR", message.guildSettings.prefix));
        } 
        if (args[0].toLowerCase() === "me" || client.isAllyCode(args[0]) || client.isUserID(args[0])) {
            allyCode = args.splice(0, 1);
            allyCode = await client.getAllyCode(message, allyCode);
        }

        let searchName = String(args.join(" ")).toLowerCase().replace(/[^\w\s]/gi, "");

        if (searchName === "") {
            return message.channel.send(message.language.get("COMMAND_FACTION_INVALID_CHAR", message.guildSettings.prefix));
        }

        // Add in common misspellings
        if (searchName === "rebels") searchName = "rebel";
        // else if (searchName === "")

        const factionChars = [];
        let chars = charList.filter(c => c.factions.map(ch => ch.toLowerCase()).includes(searchName.toLowerCase()));
        if (allyCode) {
            if (chars.length) {
                chars = chars.map(c => c.uniqueName);
                const cooldown = client.getPlayerCooldown(message.author.id);
                const player = await client.swgohAPI.player(allyCode, null, cooldown);
                const playerChars = [];
                chars.forEach(c => {
                    const found = player.roster.find(char => char.defId === c);
                    if (found) {
                        found.gp = found.gp.toLocaleString();
                        playerChars.push(found);
                    }
                });

                const gpMax   = Math.max(...playerChars.map(c => c.gp.length));
                const gearMax = Math.max(...playerChars.map(c => c.gear.toString().length));
                const lvlMax  = Math.max(...playerChars.map(c => c.level.toString().length));
                
                factionChars.push(`**\`[ * | Lvl${" ".repeat(lvlMax)}|   GP  ${" ".repeat(gpMax-5)}| ⚙${" ".repeat(gearMax)}]\`**`);
                factionChars.push("**`=================" + "=".repeat(lvlMax + gpMax + gearMax) + "`**");

                playerChars.forEach(c => {
                    const lvlStr  = " ".repeat(lvlMax  - c.level.toString().length) + c.level;
                    const gpStr   = " ".repeat(gpMax   - c.gp.length) + c.gp;
                    const gearStr = " ".repeat(gearMax - c.gear.toString().length) + c.gear;
                    factionChars.push(`**\`[ ${c.rarity} |  ${lvlStr}  | ${gpStr} | ${gearStr} ]\` ${c.nameKey}**`);
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
                        name: player.name + "'s " + searchName.toProperCase() + " Faction"
                    },
                    description: desc,
                    fields: fields,
                    footer: footer
                }});
            } else {
                return message.channel.send(message.language.get("COMMAND_FACTION_INVALID_CHAR", message.guildSettings.prefix));
            }
        } else {
            return message.channel.send({embed: {
                author: {
                    name: searchName.toProperCase()
                },
                description: chars.map(c => c.name).join("\n")
            }});
        }
    }
}

module.exports = Faction;
