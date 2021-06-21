const Command = require("../base/Command");

class GrandArena extends Command {
    constructor(Bot) {
        super(Bot, {
            name: "grandarena",
            category: "SWGoH",
            enabled: true,
            aliases: ["ga"],
            permissions: ["EMBED_LINKS"],
            subArgs: {
                faction: {
                    aliases: ["fact", "f"]
                }
            }
        });
    }

    async run(Bot, message, [user1str, user2str, ...characters], options) { // eslint-disable-line no-unused-vars
        const problemArr = [];

        // Make sure the userStrings are valid
        if (!user1str || (user1str !== "me" && !Bot.isAllyCode(user1str) && !Bot.isUserID(user1str))) {
            problemArr.push(message.language.get("COMMAND_GRANDARENA_INVALID_USER", 1));
        }
        if (!user2str || (user2str !== "me" && !Bot.isAllyCode(user2str) && !Bot.isUserID(user2str))) {
            problemArr.push(message.language.get("COMMAND_GRANDARENA_INVALID_USER", 2));
        }
        if (problemArr.length) {
            return super.error(message, Bot.codeBlock(problemArr.map(p => "* " + p).join("\n")));
        }

        // Get the first user's ally code if possible
        let user1 = await super.getUser(message, user1str, false);
        if (!user1) {
            if (user1str === "me") {
                problemArr.push(message.language.get("COMMAND_GRANDARENA_UNREGISTERED", message.guildSettings.prefix));
            } else {
                problemArr.push(message.language.get("COMMAND_GRANDARENA_INVALID_USER", 1));
            }
        }

        // Get the second user's ally code if possible
        let user2 = await super.getUser(message, user2str, false);
        if (!user2) {
            if (user2str === "me") {
                problemArr.push(message.language.get("COMMAND_GRANDARENA_UNREGISTERED", message.guildSettings.prefix));
            } else {
                problemArr.push(message.language.get("COMMAND_GRANDARENA_INVALID_USER", 2));
            }
        }

        // If they're looking for specific characters, do what we can to get matches for them
        let charOut = [];
        if (characters.length) {
            characters = characters.join(" ").split("|").map(c => c.trim());
            for (const char of characters) {
                let chars = Bot.findChar(char, Bot.characters);
                if (!chars.length) {
                    // If it didn't find a matching character, try checking the ships
                    chars = Bot.findChar(char, Bot.ships, true);
                }
                if (!chars.length) {
                    // It could not find any matches, so let em know
                    problemArr.push(message.language.get("COMMAND_GRANDARENA_INVALID_CHAR", char));
                } else {
                    // It found at least one matching character
                    chars.forEach(c => {
                        charOut.push(c.uniqueName);
                    });
                }
            }
        }

        const cooldown = await Bot.getPlayerCooldown(message.author.id);
        if (!problemArr.length) {
            // If there are no problems, go ahead and pull the users
            try {
                user1 = await Bot.swgohAPI.unitStats(user1, cooldown);
                if (Array.isArray(user1)) user1 = user1[0];
            } catch (e) {
                problemArr.push(e.message);
            }
            try {
                user2 = await Bot.swgohAPI.unitStats(user2, cooldown);
                if (Array.isArray(user2)) user2 = user2[0];
            } catch (e) {
                problemArr.push(e.message);
            }
            if (!user1?.roster?.length) {
                problemArr.push("Could not get user 1");
            }
            if (!user2?.roster?.length) {
                problemArr.push("Could not get user 2");
            }
        }
        if (problemArr.length) {
            // Otherwise, spit out the list of issues
            return super.error(message, Bot.codeBlock(problemArr.map(p => "* " + p).join("\n")));
        }

        // If there are no problems, continue
        const checkArr = {};

        // Localized labels for each row
        const labels = message.language.get("COMMAND_GRANDARENA_COMP_NAMES");

        // Set of default characters to show
        let charArr = [
            "COMMANDERLUKESKYWALKER",
            "ENFYSNEST",
            "GENERALKENOBI",
            "GENERALSKYWALKER",
            "GRANDMASTERYODA",
            "HANSOLO",
            "ANAKINKNIGHT",
            "JEDIKNIGHTREVAN",
            "PADMEAMIDALA",
            "R2D2_LEGENDARY",
            "REYJEDITRAINING",
            "BASTILASHANDARK",
            "BOSSK",
            "DARTHMALAK",
            "DARTHREVAN",
            "DARTHTRAYA",
            "EMPERORPALPATINE",
            "GRIEVOUS",
            "GRANDADMIRALTHRAWN",
            "KYLORENUNMASKED",
            "MOTHERTALZIN"
        ];

        // In case the user wants to look for charcters from a specific faction
        if (options.subArgs.faction) {
            const fact = Bot.findFaction(options.subArgs.faction);
            if (Array.isArray(fact)) {
                fact.forEach(f => {
                    charOut = charOut.concat(Bot.characters.filter(c => c.factions.find(ch => ch.toLowerCase() === f)).map(c => c.uniqueName));
                });
            } else if (fact) {
                charOut = charOut.concat(Bot.characters.filter(c => c.factions.find(ch => ch.toLowerCase() === fact)).map(c => c.uniqueName));
            } else {
                return super.error(message, "Sorry, but I did not find a match for the faction: `" + options.subArgs.faction + "`");
            }
        }

        // Get rid of any duplicates in case
        if (charOut.length) {
            charArr = [...new Set(charOut)];
        }

        let overview = [];
        const charList = Bot.characters.map(c => c.uniqueName);
        const shipList = Bot.ships.map(s => s.uniqueName);

        overview.push({
            check: labels.charGP,
            user1: user1.roster.reduce((a, b) => a + (charList.indexOf(b.defId) > -1 ? b.gp : 0), 0).shortenNum(2),
            user2: user2.roster.reduce((a, b) => a + (charList.indexOf(b.defId) > -1 ? b.gp : 0), 0).shortenNum(2)
        });
        overview.push({
            check: labels.shipGP,
            user1: user1.roster.reduce((a, b) => a + (shipList.indexOf(b.defId) > -1 ? b.gp : 0), 0).shortenNum(2),
            user2: user2.roster.reduce((a, b) => a + (shipList.indexOf(b.defId) > -1 ? b.gp : 0), 0).shortenNum(2)
        });
        if (user1.arena && user2.arena) {
            if (user1.arena.char && user2.arena.char) {
                overview.push({
                    check: labels.cArena,
                    user1: user1.arena.char.rank,
                    user2: user2.arena.char.rank,
                });
            }
            if (user1.arena.ship && user2.arena.ship) {
                overview.push({
                    check: labels.sArena,
                    user1: user1.arena.ship.rank,
                    user2: user2.arena.ship.rank,
                });
            }
        }
        overview.push({
            check: labels.zetas,
            user1: user1.roster.reduce((a, b) => a + b.skills.filter(s => s.tier === s.tiers && s.isZeta).length, 0),
            user2: user2.roster.reduce((a, b) => a + b.skills.filter(s => s.tier === s.tiers && s.isZeta).length, 0)
        });
        overview.push({
            check: labels.star6,
            user1: user1.roster.filter(c => c.rarity === 6).length,
            user2: user2.roster.filter(c => c.rarity === 6).length
        });
        overview.push({
            check: labels.star7,
            user1: user1.roster.filter(c => c.rarity === 7).length,
            user2: user2.roster.filter(c => c.rarity === 7).length
        });
        overview.push({
            check: labels.g11,
            user1: user1.roster.filter(c => c.gear === 11).length,
            user2: user2.roster.filter(c => c.gear === 11).length
        });
        overview.push({
            check: labels.g12,
            user1: user1.roster.filter(c => c.gear === 12).length,
            user2: user2.roster.filter(c => c.gear === 12).length
        });
        overview.push({
            check: labels.g13,
            user1: user1.roster.filter(c => c.gear === 13).length,
            user2: user2.roster.filter(c => c.gear === 13).length
        });

        overview = Bot.codeBlock(Bot.makeTable({
            check: {value: "", align: "left", endWith: "::"},
            user1: {value: "", endWith: "vs", align: "right"},
            user2: {value: "", align: "left"}
        }, overview, {useHeader: false}).join("\n"), "asciiDoc");

        const u1Mods = {
            spd10: 0,
            spd15: 0,
            spd20: 0,
            off100: 0
        };
        const u2Mods = {
            spd10: 0,
            spd15: 0,
            spd20: 0,
            off100: 0
        };
        user1.roster.forEach(c => {
            if (c.mods) {
                c.mods.forEach(m => {
                    // 5 is the number for speed, 41 is for offense
                    const spd = m.secondaryStat.find(s => s.unitStat === 5 && s.value >= 10);
                    const off = m.secondaryStat.find(s => s.unitStat === 41 && s.value >= 100);
                    if (spd) {
                        if (spd.value >= 20) {
                            u1Mods.spd20 += 1;
                        } else if (spd.value >= 15) {
                            u1Mods.spd15 += 1;
                        } else {
                            u1Mods.spd10 += 1;
                        }
                    }
                    if (off) u1Mods.off100 += 1;
                });
            }
        });
        user2.roster.forEach(c => {
            if (c.mods) {
                c.mods.forEach(m => {
                    const spd = m.secondaryStat.find(s => s.unitStat === 5 && s.value >= 10);
                    const off = m.secondaryStat.find(s => s.unitStat === 41 && s.value >= 100);
                    if (spd) {
                        if (spd.value >= 20) {
                            u2Mods.spd20 += 1;
                        } else if (spd.value >= 15) {
                            u2Mods.spd15 += 1;
                        } else {
                            u2Mods.spd10 += 1;
                        }
                    }
                    if (off) u2Mods.off100 += 1;
                });
            }
        });

        let modOverview = [];
        modOverview.push({
            check: labels.mods6,
            user1: user1.roster.reduce((a, b) => a + (b.mods ? b.mods.filter(m => m.pips === 6).length : 0), 0),
            user2: user2.roster.reduce((a, b) => a + (b.mods ? b.mods.filter(m => m.pips === 6).length : 0), 0)
        });
        modOverview.push({
            check: labels.spd10,
            user1: u1Mods.spd10,
            user2: u2Mods.spd10
        });
        modOverview.push({
            check: labels.spd15,
            user1: u1Mods.spd15,
            user2: u2Mods.spd15
        });
        modOverview.push({
            check: labels.spd20,
            user1: u1Mods.spd20,
            user2: u2Mods.spd20
        });
        modOverview.push({
            check: labels.off100,
            user1: u1Mods.off100,
            user2: u2Mods.off100
        });

        modOverview = Bot.codeBlock(Bot.makeTable({
            check: {value: "", align: "left", endWith: "::"},
            user1: {value: "", endWith: "vs", align: "right"},
            user2: {value: "", align: "left"}
        }, modOverview, {useHeader: false}).join("\n"), "asciiDoc");


        for (const char of charArr) {
            const user1Char = user1.roster.find(c => c.defId === char);
            const user2Char = user2.roster.find(c => c.defId === char);
            let cName = Bot.characters.find(c => c.uniqueName === char);
            let ship = false;

            if (!cName) {
                // See if you can get it from the ships
                if (Bot.ships.find(s => s.uniqueName === char)) {
                    cName = Bot.ships.find(s => s.uniqueName === char).name;
                    ship = true;
                } else {
                    continue;
                }
            } else {
                cName = cName.name;
            }

            checkArr[cName] = [];

            // Put in the header/ name
            checkArr[cName].push({
                check: labels.level,
                user1: user1Char ? user1Char.level : "N/A",
                user2: user2Char ? user2Char.level : "N/A"
            });
            checkArr[cName].push({
                check: labels.gearLvl,
                user1: user1Char ? user1Char.gear + `${user1Char.equipped.length ? "+" + user1Char.equipped.length : ""}` : "N/A",
                user2: user2Char ? user2Char.gear + `${user2Char.equipped.length ? "+" + user2Char.equipped.length : ""}` : "N/A"
            });
            checkArr[cName].push({
                check: labels.starLvl,
                user1: user1Char ? user1Char.rarity : "N/A",
                user2: user2Char ? user2Char.rarity : "N/A"
            });

            if (!ship) {
                checkArr[cName].push({
                    check: labels.zetas,
                    user1: user1Char ? user1Char.skills.filter(s => s.tier === s.tiers && s.isZeta).length.toString() : "N/A",
                    user2: user2Char ? user2Char.skills.filter(s => s.tier === s.tiers && s.isZeta).length.toString() : "N/A"
                });
                checkArr[cName].push({
                    check: labels.relics || "Relic",
                    user1: (user1Char && user1Char.relic && user1Char.relic.currentTier && user1Char.relic.currentTier > 2) ? user1Char.relic.currentTier-2 : "N/A",
                    user2: (user2Char && user2Char.relic && user2Char.relic.currentTier && user2Char.relic.currentTier > 2) ? user2Char.relic.currentTier-2 : "N/A"
                });
                checkArr[cName].push({
                    check: labels.speed,
                    user1: (user1Char && user1Char.stats.final.Speed) ? user1Char.stats.final.Speed : "N/A",
                    user2: (user2Char && user2Char.stats.final.Speed) ? user2Char.stats.final.Speed : "N/A"
                });
            }
        }

        let extra = 0;
        const fields = [];
        const len = 18;
        const checkLen = Object.keys(checkArr).length;
        Object.keys(checkArr).forEach((c, ix) => {
            if (checkLen <= 21 || ix < 21) {
                let halfLen = parseInt((len - c.length) / 2, 10);
                if (halfLen < 0) halfLen = 0;
                fields.push({
                    name: "=".repeat(halfLen) + " " + c + " " + "=".repeat(halfLen),
                    value: Bot.codeBlock(Bot.makeTable({
                        check: {value: "", align: "left", endWith: "::"},
                        user1: {value: "", align: "right"},
                        user2: {value: "", align: "left"}
                    }, checkArr[c], {useHeader: false}).map(e => e.replace(" ::", "::")).join("\n"), "asciiDoc"),
                    inline: true
                });
            } else {
                extra++;
            }
        });
        if (extra > 0) {
            fields.push({
                name: message.language.get("COMMAND_GRANDARENA_EXTRAS_HEADER"),
                value: message.language.get("COMMAND_GRANDARENA_EXTRAS", extra)
            });
        }

        const footer = Bot.updatedFooter(Math.min(user1.updated, user2.updated), message, "player", cooldown);
        return message.channel.send({embed: {
            author: {name: message.language.get("COMMAND_GRANDARENA_OUT_HEADER", user1.name, user2.name)},
            description: message.language.get("COMMAND_GRANDARENA_OUT_DESC", overview, modOverview),
            fields: fields,
            footer: footer
        }});
    }
}


module.exports = GrandArena;
