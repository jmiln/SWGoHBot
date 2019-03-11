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
            return super.error(message, message.language.get("BASE_SWGOH_NO_ALLY", message.guildSettings.prefix));
        } else if (allyCodes.length > 1) {
            return super.error(message, "Found " + allyCodes.length + " matches. Please try being more specific");
        }
        const allyCode = allyCodes[0];

        const cooldown = client.getPlayerCooldown(message.author.id);
        let player;
        try {
            player = await client.swgohAPI.player(allyCode, null, cooldown);
        } catch (e) {
            console.log("Broke getting player in myprofile: " + e);
            return super.error(message, "Please make sure you are registered with a valid ally code");
        }

        if (!player || !player.stats) {
            return super.error(message, "Sorry, but I could not find that player right now.");
        }

        const gpFull = player.stats.find(s => s.nameKey === "Galactic Power:" || s.nameKey === "STAT_GALACTIC_POWER_ACQUIRED_NAME").value;
        const gpChar = player.stats.find(s => s.nameKey === "Galactic Power (Characters):" || s.nameKey === "STAT_CHARACTER_GALACTIC_POWER_ACQUIRED_NAME").value;
        const gpShip = player.stats.find(s => s.nameKey === "Galactic Power (Ships):" || s.nameKey === "STAT_SHIP_GALACTIC_POWER_ACQUIRED_NAME").value;

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

        // Get the mod stats
        const mods = {
            sixPip: 0,
            spd15: 0,
            spd20: 0,
            off100: 0
        };
        player.roster.forEach(c => {
            if (c.mods) {
                const six = c.mods.filter(p => p.pips === 6);
                if (six.length) {
                    mods.sixPip += six.length;
                }
                c.mods.forEach(m => {
                    const spd = m.secondaryStat.find(s => (s.unitStat === 5  || s.unitStat === "UNITSTATSPEED")  && s.value >= 15);
                    const off = m.secondaryStat.find(o => (o.unitStat === 41 || o.unitStat === "UNITSTATOFFENSE") && o.value >= 100);

                    if (spd) {
                        if (spd.value >= 20) {
                            mods.spd20 += 1;
                        } else {
                            mods.spd15 += 1;
                        }                             }
                    if (off) mods.off100 += 1;
                });
            }
        });
        Object.keys(mods).forEach(k => {
            if (mods[k] === 0) mods[k] = "0";
        });

        const modOut = message.language.get("COMMAND_MYPROFILE_MODS", mods);
        fields.push({
            name: " " + modOut.header,
            value: [
                "```asciidoc",
                modOut.modStrs,
                "```"
            ].join("\n")
        });


        // Get the Character stats
        let zetaCount = 0;
        const charList = player.roster.filter(u => u.combatType === "CHARACTER" || u.combatType === 1);
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

        // Get the ship stats
        const shipList = player.roster.filter(u => u.combatType === "SHIP" || u.combatType === 2);
        const shipOut = message.language.get("COMMAND_MYPROFILE_SHIPS", gpShip.toLocaleString(), shipList);
        fields.push({
            name: shipOut.header,
            value: [
                "```asciidoc",
                shipOut.stats,
                "```"
            ].join("\n")
        });

        if (player.warnings) {
            fields.push({
                name: "Warnings",
                value: player.warnings.join("\n")
            });
        }

        const footer = client.updatedFooter(player.updated, message, "player", cooldown);
        return message.channel.send({embed: {
            author: {
                name: message.language.get("COMMAND_MYPROFILE_EMBED_HEADER", player.name, player.allyCode),
            },
            // Need 6*, 15/20 spd, and 100 off
            description: message.language.get("COMMAND_MYPROFILE_DESC", player.guildName, player.level, player.arena.char.rank, player.arena.ship.rank, gpFull.toLocaleString(), mods),
            fields: fields,
            footer: footer
        }});
    }
}

module.exports = MyProfile;
