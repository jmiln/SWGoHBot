const Command = require("../base/slashCommand");

// Quick mapping of gp to how many teams are needed
const gpMap = {
    //        |   General stuff   |        5v5 Specific stuff           |        3v3 Specific Stuff
    7800000: { div: 1,  fleets: 2, teams5: 11, topX5: 110, kyber5: 44900, teams3: 15, topX3: 90, kyber3: 53200 },
    6650000: { div: 2,  fleets: 2, teams5: 10, topX5: 100, kyber5: 43100, teams3: 14, topX3: 84, kyber3: 51400 },
    6000000: { div: 3,  fleets: 2, teams5: 9,  topX5: 90,  kyber5: 40000, teams3: 13, topX3: 78, kyber3: 51400 },
    5150000: { div: 4,  fleets: 2, teams5: 9,  topX5: 90,  kyber5: 40000, teams3: 12, topX3: 72, kyber3: 50500 },
    4500000: { div: 5,  fleets: 2, teams5: 7,  topX5: 70,  kyber5: 34700, teams3: 11, topX3: 66, kyber3: 43500 },
    3850000: { div: 6,  fleets: 2, teams5: 7,  topX5: 70,  kyber5: 34700, teams3: 11, topX3: 66, kyber3: 42300 },
    3100000: { div: 7,  fleets: 2, teams5: 7,  topX5: 70,  kyber5: 33000, teams3: 10, topX3: 60, kyber3: 39600 },
    2300000: { div: 8,  fleets: 1, teams5: 6,  topX5: 60,  kyber5: 29500, teams3: 8,  topX3: 48, kyber3: 32100 },
    1600000: { div: 9,  fleets: 1, teams5: 5,  topX5: 50,  kyber5: 27700, teams3: 7,  topX3: 42, kyber3: 30300 },
    1000000: { div: 10, fleets: 1, teams5: 4,  topX5: 40,  kyber5: 25800, teams3: 4,  topX3: 24, kyber3: 23300 },
    0:       { div: 11, fleets: 1, teams5: 3,  topX5: 30,  kyber5: 24000, teams3: 3,  topX3: 18, kyber3: 21500 }
};

class GrandArena extends Command {
    constructor(Bot) {
        super(Bot, {
            name: "grandarena",
            category: "SWGoH",
            guildOnly: false,
            aliases: ["ga"],
            permissions: ["EMBED_LINKS"],
            subArgs: {
                faction: {
                    aliases: ["fact", "f"]
                }
            },
            options: [
                {
                    name: "allycode_1",
                    type: "STRING",
                    description: "Ally code for player 1",
                    required: true
                },
                {
                    name: "allycode_2",
                    type: "STRING",
                    description: "Ally code for player 2",
                    required: true
                },
                {
                    name: "characters",
                    type: "STRING",
                    description: "Characters to compare, comma seperated"
                },
                {
                    name: "faction",
                    type: "STRING",
                    description: "A faction to compare for the two players"
                }
            ]
        });
    }

    async run(Bot, interaction, options) { // eslint-disable-line no-unused-vars
        const problemArr = [];

        // Get the first user's ally code if possible
        const user1str = interaction.options.getString("allycode_1");
        let user1 = await Bot.getAllyCode(interaction, user1str);
        if (!user1) {
            if (user1str === "me") {
                problemArr.push(interaction.language.get("COMMAND_GRANDARENA_UNREGISTERED", interaction.guildSettings.prefix));
            } else {
                problemArr.push(interaction.language.get("COMMAND_GRANDARENA_INVALID_USER", 1));
            }
        }

        // Get the second user's ally code if possible
        const user2str = interaction.options.getString("allycode_2");
        let user2 = await Bot.getAllyCode(interaction, user2str);
        if (!user2) {
            if (user2str === "me") {
                problemArr.push(interaction.language.get("COMMAND_GRANDARENA_UNREGISTERED", interaction.guildSettings.prefix));
            } else {
                problemArr.push(interaction.language.get("COMMAND_GRANDARENA_INVALID_USER", 2));
            }
        }

        // If they're looking for specific characters, do what we can to get matches for them
        let characters = interaction.options.getString("characters");
        let charOut = [];
        if (characters?.length) {
            characters = characters.split(",").map(c => c.trim());
            for (const char of characters) {
                let chars = Bot.findChar(char, Bot.characters);
                if (!chars.length) {
                    // If it didn't find a matching character, try checking the ships
                    chars = Bot.findChar(char, Bot.ships, true);
                }
                if (!chars.length) {
                    // It could not find any matches, so let em know
                    problemArr.push(interaction.language.get("COMMAND_GRANDARENA_INVALID_CHAR", char));
                } else {
                    // It found at least one matching character
                    chars.forEach(c => {
                        charOut.push(c.uniqueName);
                    });
                }
            }
        }

        const cooldown = await Bot.getPlayerCooldown(interaction.user.id);
        if (!problemArr.length) {
            // If there are no problems, go ahead and pull the users
            try {
                const users = await Bot.swgohAPI.unitStats([user1, user2], cooldown);
                if (Array.isArray(users)) {
                    user1 = users[0];
                    user2 = users[1];
                }
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
            return super.error(interaction, Bot.codeBlock(problemArr.map(p => "* " + p).join("\n")));
        }

        // If there are no problems, continue
        const checkArr = {};

        // Localized labels for each row
        const labels = interaction.language.get("COMMAND_GRANDARENA_COMP_NAMES");

        // Set of default characters to show
        // const {charChecklist, shipChecklist} = require("../data/unitChecklist");

        // An array to stick all the fields in as we go.
        const fields = [];

        // In case the user wants to look for charcters from a specific faction
        const faction = interaction.options.getString("faction");
        if (faction?.length) {
            const fact = Bot.findFaction(faction);
            if (Array.isArray(fact)) {
                fact.forEach(f => {
                    charOut = charOut.concat(Bot.characters.filter(c => c.factions.find(ch => ch.toLowerCase() === f)).map(c => c.uniqueName));
                });
            } else if (fact) {
                charOut = charOut.concat(Bot.characters.filter(c => c.factions.find(ch => ch.toLowerCase() === fact)).map(c => c.uniqueName));
            } else {
                return super.error(interaction, "Sorry, but I did not find a match for the faction: `" + options.subArgs.faction + "`");
            }
        }

        // Get rid of any duplicates in case
        let charArr = [];
        if (charOut.length) {
            charArr = [...new Set(charOut)];
        }

        // Filter out just the characters
        const user1CharRoster = user1.roster.filter(ch => ch.combatType === 1);
        const user2CharRoster = user2.roster.filter(ch => ch.combatType === 1);

        // Filter out just the ships
        const user1ShipRoster = user1.roster.filter(ch => ch.combatType === 2);
        const user2ShipRoster = user2.roster.filter(ch => ch.combatType === 2);

        // Quick little function to add up all the gp frm a given chunk of roster
        const sumGP = (rosterIn) => {
            return rosterIn.reduce((a, b) => a + b.gp, 0);
        };

        // Get the top X characters from the roster (Sort then slice)
        const getTopX = (rosterIn, x) => {
            // Sort it so the ones with a higher gp are first
            const sortedIn = rosterIn.sort((a, b) => a.gp < b.gp ? 1 : -1);
            return sortedIn.slice(0, x);
        };

        // Get which division info these users will work with
        const getDiv = (gpIn) => {
            const divKeys = Object.keys(gpMap);
            for (const key of divKeys.reverse()) {
                if (gpIn < parseInt(key, 10)) {
                    continue;
                } else {
                    return gpMap[key];
                }
            }
        };

        const getGearStr = (charIn) => {
            // If the character is not unlocked
            if (!charIn?.gear) return "N/A";

            let charGearOut = charIn.gear.toString();
            if (charIn.equipped?.length) {
                charGearOut += `+${charIn.equipped.length}`;
            } else if (charIn?.relic?.currentTier > 2) {
                charGearOut += `r${charIn.relic.currentTier-2}`;
            }
            return charGearOut;
        };


        let overview = [];

        // Arena stats
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
            user1: user1.roster.reduce((a, b) => a + b.skills.filter(s => (s.isZeta && s.tier === s.tiers) || (s.isOmicron && s.tier >= s.tiers-1)).length, 0),
            user2: user2.roster.reduce((a, b) => a + b.skills.filter(s => (s.isZeta && s.tier === s.tiers) || (s.isOmicron && s.tier >= s.tiers-1)).length, 0)
        });
        overview.push({
            check: "Omicrons",
            user1: user1.roster.reduce((a, b) => a + b.skills.filter(s => s.isOmicron && s.tier >= s.tiers).length, 0),
            user2: user2.roster.reduce((a, b) => a + b.skills.filter(s => s.isOmicron && s.tier >= s.tiers).length, 0)
        });
        overview = Bot.codeBlock(Bot.makeTable({
            check: {value: "", align: "left", endWith: "::"},
            user1: {value: "", endWith: "vs", align: "right"},
            user2: {value: "", align: "left"}
        }, overview, {useHeader: false}).join("\n"), "asciiDoc");
        fields.push({
            name: "General Overview",
            value: overview
        });


        // The GP stats
        let gpStats = [];

        // Overall basic gp stats
        gpStats.push({
            check: "Total GP",
            user1: Bot.shortenNum(sumGP(user1.roster), 2),
            user2: Bot.shortenNum(sumGP(user2.roster), 2)
        });
        gpStats.push({
            check: labels.charGP,
            user1: Bot.shortenNum(sumGP(user1CharRoster), 2),
            user2: Bot.shortenNum(sumGP(user2CharRoster), 2)
        });
        gpStats.push({
            check: labels.shipGP,
            user1: Bot.shortenNum(sumGP(user1ShipRoster), 2),
            user2: Bot.shortenNum(sumGP(user2ShipRoster), 2)
        });

        // GA Specific stats for the top however many characters' GP
        const user1GP = sumGP(user1.roster);
        const thisDiv = getDiv(user1GP);

        const user1TopX5 = getTopX(user1CharRoster, thisDiv.topX5);
        const user1TopX3 = getTopX(user1CharRoster, thisDiv.topX3);

        const user2TopX5 = getTopX(user2CharRoster, thisDiv.topX5);
        const user2TopX3 = getTopX(user2CharRoster, thisDiv.topX3);

        gpStats.push({
            check: `Top${thisDiv.topX3} 3v3`,
            user1: Bot.shortenNum(sumGP(user1TopX3), 2),
            user2: Bot.shortenNum(sumGP(user2TopX3), 2),
        });
        gpStats.push({
            check: `Top${thisDiv.topX5} 5v5`,
            user1: Bot.shortenNum(sumGP(user1TopX5), 2),
            user2: Bot.shortenNum(sumGP(user2TopX5), 2),
        });


        gpStats = Bot.codeBlock(Bot.makeTable({
            check: {value: "", align: "left", endWith: "::"},
            user1: {value: "", endWith: "vs", align: "right"},
            user2: {value: "", align: "left"}
        }, gpStats, {useHeader: false}).join("\n"), "asciiDoc");

        fields.push({
            name: "GP Stats Overview",
            value: gpStats
        });


        // Get the overall gear levels for each user
        let gearOverview = [];
        const [u1GearLvls, u1AvgGear] =Bot.summarizeCharLevels(user1, "gear");
        const [u2GearLvls, u2AvgGear] =Bot.summarizeCharLevels(user2, "gear");
        const maxGear = Math.max(Math.max(...Object.keys(u1GearLvls)), Math.max(...Object.keys(u2GearLvls)));
        for (let ix = maxGear-3; ix <= maxGear; ix++) {
            gearOverview.push({
                check: `G${ix}`,
                user1: u1GearLvls[ix] ? u1GearLvls[ix] : "N/A",
                user2: u2GearLvls[ix] ? u2GearLvls[ix] : "N/A"
            });
        }
        gearOverview.push({
            check: "Avg Gear",
            user1: u1AvgGear,
            user2: u2AvgGear
        });
        gearOverview = Bot.codeBlock(Bot.makeTable({
            check: {value: "", align: "left", endWith: "::"},
            user1: {value: "", endWith: "vs", align: "right"},
            user2: {value: "", align: "left"}
        }, gearOverview, {useHeader: false}).join("\n"), "asciiDoc");
        fields.push({
            name: "Character Gear Counts",
            value: "*How many characters at each gear level*" + gearOverview
        });


        // Get the overall rarity levels for each user
        let rarityOverview = [];
        const [u1RarityLvls, u1AvgRarity] =Bot.summarizeCharLevels(user1, "rarity");
        const [u2RarityLvls, u2AvgRarity] =Bot.summarizeCharLevels(user2, "rarity");
        const maxRarity = Math.max(Math.max(...Object.keys(u1RarityLvls)), Math.max(...Object.keys(u2RarityLvls)));
        for (let ix = maxRarity-3; ix <= maxRarity; ix++) {
            rarityOverview.push({
                check: `${ix}*`,
                user1: u1RarityLvls[ix] ? u1RarityLvls[ix] : 0,
                user2: u2RarityLvls[ix] ? u2RarityLvls[ix] : 0
            });
        }
        rarityOverview.push({
            check: "Avg Rarity",
            user1: u1AvgRarity,
            user2: u2AvgRarity
        });
        rarityOverview = Bot.codeBlock(Bot.makeTable({
            check: {value: "", align: "left", endWith: "::"},
            user1: {value: "", endWith: "vs", align: "right"},
            user2: {value: "", align: "left"}
        }, rarityOverview, {useHeader: false}).join("\n"), "asciiDoc");

        fields.push({
            name: "Character Rarity Counts",
            value: "*How many characters at each rarity level*" + rarityOverview
        });


        // Get some general stats for any available galactic legends
        const legendMap = [
            ["GLREY",                   "Rey"],
            ["JEDIMASTERKENOBI",        "JM Kenobi"],
            ["GRANDMASTERLUKE",         "JM Luke"],
            ["SITHPALPATINE",           "SE Emperor"],
            ["SUPREMELEADERKYLOREN",    "SL Kylo Ren"]
        ];
        let glOverview = [];
        for (const gl of legendMap) {
            const u1Char = user1.roster.find(c => c.defId === gl[0]);
            const u2Char = user2.roster.find(c => c.defId === gl[0]);
            glOverview.push({
                check: gl[1],
                user1: `${getGearStr(u1Char)}${u1Char?.purchasedAbilityId?.length > 0 ? "U" : ""}`,
                user2: `${getGearStr(u2Char)}${u2Char?.purchasedAbilityId?.length > 0 ? "U" : ""}`
            });
        }
        glOverview = Bot.codeBlock(Bot.makeTable({
            check: {value: "", align: "left", endWith: "::"},
            user1: {value: "", endWith: "vs", align: "right"},
            user2: {value: "", align: "left"}
        }, glOverview, {useHeader: false}).join("\n"), "asciiDoc");
        fields.push({
            name: "Galactic Legend Overview",
            value:glOverview
        });

        // Get the overall relic levels for each user
        let relicOverview = [];
        const [u1RelicLvls, u1AvgRelic] =Bot.summarizeCharLevels(user1, "relic");
        const [u2RelicLvls, u2AvgRelic] =Bot.summarizeCharLevels(user2, "relic");
        const maxRelic = Math.max(Math.max(...Object.keys(u1RelicLvls)), Math.max(...Object.keys(u2RelicLvls)));
        for (let ix = 1; ix <= maxRelic; ix++) {
            relicOverview.push({
                check: `R${ix}`,
                user1: u1RelicLvls[ix] ? u1RelicLvls[ix] : 0,
                user2: u2RelicLvls[ix] ? u2RelicLvls[ix] : 0
            });
        }
        relicOverview.push({
            check: "Avg Relic",
            user1: u1AvgRelic,
            user2: u2AvgRelic
        });
        relicOverview = Bot.codeBlock(Bot.makeTable({
            check: {value: "", align: "left", endWith: "::"},
            user1: {value: "", endWith: "vs", align: "right"},
            user2: {value: "", align: "left"}
        }, relicOverview, {useHeader: false}).join("\n"), "asciiDoc");
        fields.push({
            name: "Character Relic Counts",
            value: "*How many characters at each relic level*" + relicOverview
        });



        // Get some general mod stats for each user
        const u1Mods = {
            spd15: 0,
            spd20: 0,
            spd25: 0,
            off100: 0
        };
        const u2Mods = {
            spd15: 0,
            spd20: 0,
            spd25: 0,
            off100: 0
        };
        user1.roster.forEach(c => {
            if (c.mods) {
                c.mods.forEach(m => {
                    // 5 is the number for speed, 41 is for offense
                    const spd = m.secondaryStat.find(s => s.unitStat === 5 && s.value >= 15);
                    const off = m.secondaryStat.find(s => s.unitStat === 41 && s.value >= 100);
                    if (spd) {
                        if (spd.value >= 25) {
                            u1Mods.spd25 += 1;
                        } else if (spd.value >= 20) {
                            u1Mods.spd20 += 1;
                        } else {
                            u1Mods.spd15 += 1;
                        }
                    }
                    if (off) u1Mods.off100 += 1;
                });
            }
        });
        user2.roster.forEach(c => {
            if (c.mods) {
                c.mods.forEach(m => {
                    const spd = m.secondaryStat.find(s => s.unitStat === 5 && s.value >= 15);
                    const off = m.secondaryStat.find(s => s.unitStat === 41 && s.value >= 100);
                    if (spd) {
                        if (spd.value >= 25) {
                            u2Mods.spd25 += 1;
                        } else if (spd.value >= 20) {
                            u2Mods.spd20 += 1;
                        } else {
                            u2Mods.spd15 += 1;
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
            check: labels.spd25,
            user1: u1Mods.spd25,
            user2: u2Mods.spd25
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

        fields.push({
            name: "Mod Stats Overview",
            value: modOverview
        });


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
                check: labels.starLvl,
                user1: user1Char ? user1Char.rarity : "N/A",
                user2: user2Char ? user2Char.rarity : "N/A"
            });

            if (!ship) {
                checkArr[cName].push({
                    check: labels.gearLvl,
                    user1: getGearStr(user1Char),
                    user2: getGearStr(user2Char)
                });

                checkArr[cName].push({
                    check: labels.zetas,
                    user1: user1Char ? user1Char.skills.filter(s => (s.isZeta && s.tier === s.tiers) || (s.isOmicron && s.tier >= s.tiers-1)).length.toString() : "N/A",
                    user2: user2Char ? user2Char.skills.filter(s => (s.isZeta && s.tier === s.tiers) || (s.isOmicron && s.tier >= s.tiers-1)).length.toString() : "N/A"
                });
                checkArr[cName].push({
                    check: "Omicrons",
                    user1: user1Char ? user1Char.skills.filter(s => s.isOmicron && s.tier >= s.tiers).length.toString() : "N/A",
                    user2: user2Char ? user2Char.skills.filter(s => s.isOmicron && s.tier >= s.tiers).length.toString() : "N/A"
                });
                checkArr[cName].push({
                    check: labels.speed,
                    user1: (user1Char && user1Char.stats.final.Speed) ? user1Char.stats.final.Speed : "N/A",
                    user2: (user2Char && user2Char.stats.final.Speed) ? user2Char.stats.final.Speed : "N/A"
                });
            }
        }

        let extra = 0;
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
                name: interaction.language.get("COMMAND_GRANDARENA_EXTRAS_HEADER"),
                value: interaction.language.get("COMMAND_GRANDARENA_EXTRAS", extra)
            });
        }

        const footer = Bot.updatedFooter(Math.min(user1.updated, user2.updated), interaction, "player", cooldown);
        return interaction.reply({embeds: [{
            author: {name: interaction.language.get("COMMAND_GRANDARENA_OUT_HEADER", user1.name, user2.name)},
            // description: message.language.get("COMMAND_GRANDARENA_OUT_DESC", overview, modOverview),
            fields: fields,
            footer: footer
        }]});
    }
}


module.exports = GrandArena;
