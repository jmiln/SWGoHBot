const Command = require("../base/Command");
const {inspect} = require("util"); // eslint-disable-line no-unused-vars

// To get the player's arena info (Adapted from shittybill#3024's Scorpio)
class MyArena extends Command {
    constructor(client) {
        super(client, {
            name: "myarena",
            category: "SWGoH",
            aliases: ["ma", "userarena", "ua"],
            permissions: ["EMBED_LINKS"],
            flags: {
                stats: {
                    aliases: ["s"]
                }
            }
        });
    }

    async run(client, message, [user], options) { // eslint-disable-line no-unused-vars
        const lang = message.guildSettings.swgohLanguage;
        const allyCodes = await client.getAllyCode(message, user);
        if (!allyCodes.length) {
            return super.error(message, message.language.get("BASE_SWGOH_NO_ALLY", message.guildSettings.prefix));
        } else if (allyCodes.length > 1) {
            return super.error(message, "Found " + allyCodes.length + " matches. Please try being more specific");
        }
        const allyCode = allyCodes[0];

        const cooldown = client.getPlayerCooldown(message.author.id);
        let player;
        try {
            // player = await client.swgohAPI.getPlayer(allyCode, lang);
            player = await client.swgohAPI.player(allyCode, lang, cooldown);
        } catch (e) {
            console.log("Broke getting player in myarena: " + e);
        }

        if (!player.arena) {
            return super.error(message, "Something broke when getting your info, please try again in a bit.");
        }         

        const fields = [];
        const positions = [ "L|", "2|", "3|", "4|", "5|" ];
        const sPositions = [ "L|", "2|", "3|", "4|", "B|", "B|", "B|", "B|" ];

        if (!options.flags.stats && player.arena.ship.squad && player.arena.ship.squad.length) {
            const sArena = [];
            for (let ix = 0; ix < player.arena.ship.squad.length; ix++) {
                const ship = player.arena.ship.squad[ix];
                let thisShip = player.roster.find(s => s.defId === ship.defId);
                thisShip = await client.swgohAPI.langChar(thisShip, message.guildSettings.swgohLanguage);
                if (thisShip.name && !thisShip.nameKey) thisShip.nameKey = thisShip.name;
                sArena.push(`\`${sPositions[ix]}\` ${thisShip.nameKey}`);
            }
            fields.push({
                name: message.language.get("COMMAND_MYARENA_FLEET", player.arena.ship.rank),
                value: sArena.join("\n") + "\n`------------------------------`",
                inline: true
            });
        }

        let desc = "";
        if (!options.flags.stats) {
            const cArena = [];
            for (let ix = 0; ix < player.arena.char.squad.length; ix++) {
                const char = player.arena.char.squad[ix];
                let thisChar = player.roster.find(c => c.defId === char.defId);        // Get the character
                thisChar = await client.swgohAPI.langChar(thisChar, message.guildSettings.swgohLanguage);
                const thisZ = thisChar.skills.filter(s => s.isZeta && s.tier === 8);    // Get the zetas of that character
                if (thisChar.name && !thisChar.nameKey) thisChar.nameKey = thisChar.name;
                cArena.push(`\`${positions[ix]}\` ${"z".repeat(thisZ.length)}${thisChar.nameKey}`);
            }
            fields.push({
                name: message.language.get("COMMAND_MYARENA_ARENA", player.arena.char.rank),
                value: cArena.join("\n") + "\n`------------------------------`",
                inline: true
            });
        } else {
            let playerStats = null;
            try {
                playerStats = await client.swgohAPI.unitStats(allyCode, cooldown);
            } catch (e) {
                console.error(e);
                return super.error(message, client.codeBlock(e.message), {
                    title: message.language.get("BASE_SOMETHING_BROKE"), 
                    footer: "Please try again in a bit."
                });
            }
            const chars = [];
            // player.arena.char.squad.forEach((char, ix) => {
            for (let ix = 0; ix < player.arena.char.squad.length; ix++) {
                const char = player.arena.char.squad[ix];
                let thisChar = player.roster.find(c => c.defId === char.defId);        // Get the character
                thisChar = await client.swgohAPI.langChar(thisChar, message.guildSettings.swgohLanguage);
                const thisCharStats = playerStats.stats.find(c => c.unit.defId === char.defId);        // Get the character
                const thisZ = thisChar.skills.filter(s => s.isZeta && s.tier === 8);    // Get the zetas of that character
                if (thisChar.name && !thisChar.nameKey) thisChar.nameKey = thisChar.name;
                const cName = `${"z".repeat(thisZ.length)}${thisChar.nameKey}`;
                const speed = thisCharStats.stats.final.Speed;
                const health = thisCharStats.stats.final.Health;
                const prot = thisCharStats.stats.final.Protection;
                chars.push({
                    pos: positions[ix],
                    speed: speed,
                    health: health,
                    prot: prot,
                    name: cName
                });
            }
            desc = client.makeTable({
                pos: {value: "", startWith: "`"},
                speed:{value:  "Spd", startWith: "[", endWith: "|"},
                health: {value: "HP", endWith: "|"},
                prot: {value: "Prot", endWith: "]`"},
                name: {value: "", align: "left"}
            }, chars).join("\n");
        }

        if (player.warnings) {
            fields.push({
                name: "Warnings",
                value: player.warnings.join("\n")
            });
        }

        const footer = client.updatedFooter(player.updated, message, "player", cooldown);
        return message.channel.send({embed: {
            author: {
                name: message.language.get("COMMAND_MYARENA_EMBED_HEADER", player.name)
            },
            description: desc,
            fields: fields,
            footer: footer
        }});
    }
}

module.exports = MyArena;

