const Command = require("../base/Command");
// const moment = require("moment");
// const {inspect} = require("util");

class MyProfile extends Command {
    constructor(client) {
        super(client, {
            name: "myprofile",
            category: "SWGoH",
            aliases: ["mp", "userprofile", "up"],
            permissions: ["EMBED_LINKS"]    // Starts with ["SEND_MESSAGES", "VIEW_CHANNEL"] so don't need to add them
        });
    }

    async run(client, message, [user], level) { // eslint-disable-line no-unused-vars
        // const lang = message.guildSettings.swgoghLanguage;
        const allyCodes = await client.getAllyCode(message, user);
        if (!allyCodes.length) {
            return message.channel.send(message.language.get("BASE_SWGOH_NO_ALLY", message.guildSettings.prefix));
        } else if (allyCodes.length > 1) {
            return message.channel.send("Found " + allyCodes.length + " matches. Please try being more specific");
        }
        const allyCode = allyCodes[0];

        const cooldown = client.getPlayerCooldown(message.author.id);
        let player;
        try {
            player = await client.swgohAPI.player(allyCode, null, cooldown);
        } catch (e) {
            console.log("Broke getting player in myprofile: " + e);
            return message.channel.send("ERROR: Please make sure you are registered with a valid ally code");
        }

        // const gpFull = player.stats.find(s => s.nameKey === "STAT_GALACTIC_POWER_ACQUIRED_NAME").value;
        // const gpChar = player.stats.find(s => s.nameKey === "STAT_CHARACTER_GALACTIC_POWER_ACQUIRED_NAME").value;
        // const gpShip = player.stats.find(s => s.nameKey === "STAT_SHIP_GALACTIC_POWER_ACQUIRED_NAME").value;
        const gpFull = player.stats.find(s => s.nameKey === "Galactic Power:").value;
        const gpChar = player.stats.find(s => s.nameKey === "Galactic Power (Characters):").value;
        const gpShip = player.stats.find(s => s.nameKey === "Galactic Power (Ships):").value;

        const rarityMap = {
            "ONESTAR": 1,
            "TWOSTAR": 2,
            "THREESTAR": 3,
            "FOURSTAR": 4,
            "FIVESTAR": 5,
            "SIXSTAR": 6,
            "SEVENSTAR": 7
        };

        player.roster.forEach(c => {
            if (!parseInt(c.rarity)) {
                c.rarity = rarityMap[c.rarity];
            }
        });

        const fields = [];
        // const charList = player.roster.filter(u => u.type === "CHARACTER");
        const charList = player.roster.filter(u => u.combatType === "CHARACTER");
        let zetaCount = 0;
        charList.forEach(char => {
            const thisZ = char.skills.filter(s => s.isZeta && s.tier === 8);    // Get all zetas for that character
            zetaCount += thisZ.length;
        });
        const charOut = message.language.get("COMMAND_MYPROFILE_CHARS", gpChar.toLocaleString(), charList, zetaCount);
        fields.push({
            name: charOut.header,
            value: [
                "```asciidoc",
                charOut.stats,
                "```"
            ].join("\n")
        });

        // const shipList = player.roster.filter(u => u.type === "SHIP");
        const shipList = player.roster.filter(u => u.combatType === "SHIP");
        const shipOut = message.language.get("COMMAND_MYPROFILE_SHIPS", gpShip.toLocaleString(), shipList);
        fields.push({
            name: shipOut.header,
            value: [
                "```asciidoc",
                shipOut.stats,
                "```"
            ].join("\n")
        });
        const footer = client.updatedFooter(player.updated, message, "player", cooldown);
        return message.channel.send({embed: {
            author: {
                name: message.language.get("COMMAND_MYPROFILE_EMBED_HEADER", player.name, player.allyCode),
            },
            description: message.language.get("COMMAND_MYPROFILE_DESC", player.guildName, player.level, player.arena.char.rank, player.arena.ship.rank, gpFull.toLocaleString()),
            fields: fields,
            footer: footer
        }});
    }
}

module.exports = MyProfile;
