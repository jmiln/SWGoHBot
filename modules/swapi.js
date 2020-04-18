const {inspect} = require("util");
const snekfetch = require("snekfetch");
// const nodeFetch = require("node-fetch");
const statEnums = require("../data/statEnum.js");

const statLang = { "0": "None", "1": "Health", "2": "Strength", "3": "Agility", "4": "Tactics", "5": "Speed", "6": "Physical Damage", "7": "Special Damage", "8": "Armor", "9": "Resistance", "10": "Armor Penetration", "11": "Resistance Penetration", "12": "Dodge Chance", "13": "Deflection Chance", "14": "Physical Critical Chance", "15": "Special Critical Chance", "16": "Critical Damage", "17": "Potency", "18": "Tenacity", "19": "Dodge", "20": "Deflection", "21": "Physical Critical Chance", "22": "Special Critical Chance", "23": "Armor", "24": "Resistance", "25": "Armor Penetration", "26": "Resistance Penetration", "27": "Health Steal", "28": "Protection", "29": "Protection Ignore", "30": "Health Regeneration", "31": "Physical Damage", "32": "Special Damage", "33": "Physical Accuracy", "34": "Special Accuracy", "35": "Physical Critical Avoidance", "36": "Special Critical Avoidance", "37": "Physical Accuracy", "38": "Special Accuracy", "39": "Physical Critical Avoidance", "40": "Special Critical Avoidance", "41": "Offense", "42": "Defense", "43": "Defense Penetration", "44": "Evasion", "45": "Critical Chance", "46": "Accuracy", "47": "Critical Avoidance", "48": "Offense", "49": "Defense", "50": "Defense Penetration", "51": "Evasion", "52": "Accuracy", "53": "Critical Chance", "54": "Critical Avoidance", "55": "Health", "56": "Protection", "57": "Speed", "58": "Counter Attack", "59": "UnitStat_Taunt", "61": "Mastery" };

module.exports = (Bot) => {
    const swgoh = Bot.swgoh;
    const cache = Bot.cache;
    const costs = Bot.abilityCosts;
    const statCalculator = Bot.statCalculator;

    // Set the max cooldowns (In minutes)
    const playerMinCooldown = 1;    // 1 min
    const playerMaxCooldown = 180;  // 2 hours
    const guildMinCooldown  = 3*60; // 4 hours
    const guildMaxCooldown  = 6*60; // 6 hours
    const eventCooldown     = 4*60; // 4 hours
    const zetaCooldown =   7*24*60; // 7 days

    return {
        // player: player,
        fastPlayer: fastPlayer,
        players: players,
        playerByName: playerByName,
        unitStats: unitStats,
        langChar: langChar,
        guildStats: guildStats,
        abilities: abilities,
        getCharacter: getCharacter,
        character: character,
        gear: gear,
        battles: battles,
        units: units,
        recipes: recipes,
        materials: materials,
        guild: guild,
        guildByName: guildByName,
        guildGG: guildGG,
        zetaRec: zetaRec,
        events: events,
        register: register,
        unregister: unregister,
        whois: whois
    };

    async function fastPlayer(allycode) {
        try {
            if (allycode) allycode = allycode.toString();
            if ( !allycode || isNaN(allycode) || allycode.length !== 9 ) { throw new Error("Please provide a valid allycode"); }
            allycode = parseInt(allycode);

            let player;
            try {
                player = await snekfetch.get(Bot.config.premiumIP_Port + "/pipe/player/" + allycode);
                player = JSON.parse(player.text);
            } catch (err) {
                // Probably API timeout
                player = null;
                console.log("ERROR(FP): " + err.message);
            }

            if (!player || !player.roster || !player.name) {
                if (player.error) {
                    throw new Error("Broke getting fastPlayer: " + inspect(player.error));
                }
                throw new Error("Broke getting fastPlayer: " + inspect(player));
            }

            // Just update the arena data, and not the updated time, so it can still update everything like normal
            await cache.put(Bot.config.mongodb.swapidb, "playerStats", {allyCode: allycode}, {"arena": player.arena}, false);
            return player;
        } catch (e) {
            console.log("SWAPI Broke getting player: " + e);
            throw e;
        }
    }

    async function players(allycodes) {
        if (!Array.isArray(allycodes)) {
            allycodes = [allycodes];
        }

        const players = await cache.get(Bot.config.mongodb.swapidb, "playerStats", {allyCode:{ $in: allycodes}});

        return players || [];
    }

    async function playerByName(name) {
        try {
            if (!name || !name.length) return null;
            if (typeof name !== "string") name = name.toString();

            /** Try to get player's ally code from cache */
            const player = await cache.get(Bot.config.mongodb.swapidb, "playerStats", {name:name}, {allyCode: 1, _id: 0});

            return player;
        } catch (e) {
            console.log("SWAPI Broke getting player: " + e);
            throw e;
        }
    }

    async function unitStats(allycodes, cooldown, options={}) {
        // Make sure the allycode(s) are in an array
        if (!Array.isArray(allycodes)) {
            if (!allycodes) {
                return false;
            }
            allycodes = [allycodes];
        }

        // Check the cooldown to see if it should update stuff or not
        if (allycodes.length > 5) {
            if (cooldown && cooldown.guild) {
                if (cooldown) {
                    cooldown = cooldown.guild;
                    if (cooldown > guildMaxCooldown) cooldown = guildMaxCooldown;
                    if (cooldown < guildMinCooldown) cooldown = guildMinCooldown;
                } else {
                    cooldown = guildMaxCooldown;
                }
            }
        } else if (cooldown && cooldown.player) {
            if (cooldown) {
                cooldown = cooldown.player;
                if (cooldown > playerMaxCooldown) cooldown = playerMaxCooldown;
                if (cooldown < playerMinCooldown) cooldown = playerMinCooldown;
            } else {
                cooldown = playerMaxCooldown;
            }
        }
        let playerStats = [];
        try {
            if (allycodes && allycodes.length) allycodes = allycodes.filter(a => !!a).map(a => a.toString()).filter(a => a.length === 9);
            if (!allycodes.length) throw new Error("No valid ally code(s) entered");
            allycodes = allycodes.map(a => parseInt(a));

            let players;
            if (options && options.defId) {
                players = await cache.get(Bot.config.mongodb.swapidb, "playerStats", {allyCode: {$in: allycodes}}, {_id: 0, name: 1, allyCode: 1, roster: {$elemMatch: {defId: options.defId}}, updated: 1});
            } else {
                players = await cache.get(Bot.config.mongodb.swapidb, "playerStats", {allyCode: {$in: allycodes}});
            }
            const updated = players.filter(p => !isExpired(p.updated, cooldown));
            const updatedAC = updated.map(p => p.allyCode);
            const needUpdating = allycodes.filter(a => !updatedAC.includes(a));

            playerStats = playerStats.concat(updated);

            let warning;
            if (needUpdating.length) {
                let updatedBare;
                try {
                    let tempBare;
                    if (needUpdating.length <= 20) {
                        // If it's not a ton of players at a time
                        tempBare = await swgoh.fetchPlayer({
                            allycode: needUpdating
                        });
                        if (tempBare.warning) warning = tempBare.warning;
                        if (tempBare.error) throw new Error(tempBare.error);
                        updatedBare = tempBare.result;
                    } else {
                        // If it's a lot of users
                        // Get the first half of the list
                        tempBare = await swgoh.fetchPlayer({
                            allycode: needUpdating.slice(0, Math.floor(needUpdating.length/2))
                        });
                        updatedBare = tempBare.result;

                        // Then get the 2nd half
                        tempBare = await swgoh.fetchPlayer({
                            allycode: needUpdating.slice(Math.floor(needUpdating.length/2), needUpdating.length)
                        });
                        updatedBare = updatedBare.concat(tempBare.result);
                    }
                } catch (error) {
                    // Couldn't get the data from the api, so send old stuff
                    console.log("Error getting player(s) in unitStats: " + error);
                    return players;
                }
                for (const bareP of updatedBare) {
                    try {
                        await statCalculator.calcRosterStats( bareP.roster , {
                            gameStyle: true,
                            language: statLang
                        }, {calcGP: true});
                    } catch (error) {
                        throw new Error("Error getting player stats: " + error);
                    }

                    const charStats = await cache.put(Bot.config.mongodb.swapidb, "playerStats", {allyCode: bareP.allyCode}, bareP);
                    charStats.warnings = warning;
                    playerStats.push(charStats);
                }
                if (options && options.defId) {
                    playerStats.forEach(p => {
                        if (!p.roster) return;
                        p.roster = p.roster.filter(ch => ch.defId === options.defId);
                    });
                }
            }
            return playerStats;
        } catch (error) {
            console.log("SWAPI Broke getting playerStats: " + error);
            throw error;
        }
    }

    async function langChar(char, lang) {
        lang = lang ? lang.toLowerCase() : "eng_us";
        if (!char) throw new Error("Missing Character");

        if (char.defId) {
            const nameKey = await this.units(char.defId);
            char.nameKey = nameKey ? nameKey.nameKey : null;
        }

        if (char.mods) {
            for (const mod of char.mods) {
                // If they've got the numbers instead of enums, enum em
                if (mod.primaryStat.unitStatId) mod.primaryStat.unitStat = mod.primaryStat.unitStatId;
                if (!isNaN(mod.primaryStat.unitStat)) {
                    mod.primaryStat.unitStat = statEnums.enums[mod.primaryStat.unitStat];
                }
                for (const stat of mod.secondaryStat) {
                    if (stat.unitStatId) stat.unitStat = stat.unitStatId;
                    if (!isNaN(stat.unitStat)) {
                        stat.unitStat = statEnums.enums[stat.unitStat];
                    }
                }
            }
        }

        // In case it has skillReferenceList
        for (const skill in char.skillReferenceList) {
            let skillName = await cache.get(Bot.config.mongodb.swapidb, "abilities", {skillId: char.skillReferenceList[skill].skillId, language: lang}, {nameKey: 1, _id: 0});
            if (Array.isArray(skillName)) skillName = skillName[0];
            if (!skillName) throw new Error("Cannot find skillName for " + char.skillReferenceList[skill].skillId);
            char.skillReferenceList[skill].nameKey = skillName.nameKey;
        }

        // In case it doesn't
        for (const skill in char.skills) {
            let skillName = await cache.get(Bot.config.mongodb.swapidb, "abilities", {skillId: char.skills[skill].id, language: lang}, {nameKey: 1, _id: 0});
            if (Array.isArray(skillName)) skillName = skillName[0];
            if (!skillName) throw new Error("Cannot find skillName for " + char.skills[skill].id);
            char.skills[skill].nameKey = skillName.nameKey;
        }
        return char;
    }

    async function guildStats( allyCodes, defId, cooldown ) {
        if (cooldown && cooldown.guild) {
            if (cooldown.guild > guildMaxCooldown) cooldown.guild = guildMaxCooldown;
            if (cooldown.guild < guildMinCooldown) cooldown.guild = guildMinCooldown;
        } else {
            cooldown.guild = guildMaxCooldown;
        }

        const outStats = [];
        const players = await Bot.swgohAPI.unitStats(allyCodes, cooldown, {defId: defId});
        if (!players.length) throw new Error("Couldn't get your stats");

        for (const player of players) {
            let unit;

            if (!player.roster) {
                unit = {
                    defId: defId,
                    gear: 0,
                    gp: 0,
                    level: 0,
                    rarity: 0,
                    skills: [],
                    zetas: [],
                    relic: {currentTier: 0},
                    equipped: [],
                    stats: {}
                };
            } else {
                unit = player.roster.find(c => c.defId === defId);
                if (!unit) {
                    unit = {
                        defId: defId,
                        gear: 0,
                        gp: 0,
                        level: 0,
                        rarity: 0,
                        skills: [],
                        zetas: [],
                        relic: {currentTier: 0},
                        equipped: []
                    };
                }
            }
            unit.player = player.name;
            unit.allyCode = player.allyCode;
            unit.updated = player.updated;
            outStats.push(unit);
        }
        return outStats;
    }

    async function abilities( skillArray, lang, update=false, opts ) {
        lang = lang || "eng_us";
        if (!opts) opts = {};
        if (!skillArray) {
            throw new Error("You need to have a list of abilities here");
        } else if (!Array.isArray(skillArray)) {
            skillArray = [skillArray];
        }

        if (update) {
            const ab = [];
            let skillList = await Bot.swgoh.fetchAPI("/swgoh/data", {
                "collection": "skillList",
                "language": lang,
                "enums":true,
                "project": {
                    "id":1,
                    "abilityReference":1,
                    "isZeta":1,
                    "tierList": 1
                }
            });
            skillList = skillList.result;

            let abilities = await Bot.swgoh.fetchAPI("/swgoh/data", {
                "collection": "abilityList",
                "language": lang,
                "enums":true,
                "project": {
                    "id":1,
                    "type":1,
                    "nameKey":1,
                    "descKey":1,
                    "cooldown":1,
                    "tierList": {
                        descKey: 1
                    }
                }
            });

            abilities = abilities.result;

            if (!abilities) return console.log("No abilities for " + lang);
            if (!skillList) return console.log("No skillList for " + lang);

            abilities.forEach(a => {
                const skill = skillList.find(s => s.abilityReference === a.id);
                if (a.tierList && a.tierList.length > 0) {
                    a.descKey = a.tierList[a.tierList.length - 1].descKey;
                    delete a.tierList;
                }
                if (skill) {
                    a.isZeta = skill.isZeta;
                    a.skillId = skill.id;
                    a.tierList = skill.tierList;
                    a.language = lang.toLowerCase();
                }
            });

            for (const ability of abilities) {
                if (skillArray.includes(ability.skillId)) {
                    ab.push(ability);
                }
                await cache.put(Bot.config.mongodb.swapidb, "abilities", {skillId: ability.skillId, language: ability.language}, ability);
            }
            return ab;
        } else {
            // All the skills should be loaded, so just get em from the cache
            if (opts.min) {
                const skillOut = await cache.get(Bot.config.mongodb.swapidb, "abilities", {skillId: {$in: skillArray}, language: lang.toLowerCase()}, {nameKey: 1, _id: 0});
                return skillOut;
            } else {
                const skillOut = await cache.get(Bot.config.mongodb.swapidb, "abilities", {skillId: {$in: skillArray}, language: lang.toLowerCase()}, {_id: 0, updated: 0});
                return skillOut;
            }
        }
    }

    async function getCharacter(defId, lang) {
        lang = lang ? lang.toLowerCase() : "eng_us";
        if (!defId) throw new Error("[getCharacter] Missing character ID.");

        const char = await this.character(defId);

        if (!char) {
            throw new Error("[SWGoH-API getCharacter] Missing Character");
        } else if (!char.skillReferenceList) {
            throw new Error("[SWGoH-API getCharacter] Missing character abilities");
        }

        for (const s of char.skillReferenceList) {
            let skill = await this.abilities([s.skillId], lang);
            if (Array.isArray(skill)) {
                skill = skill[0];
            }
            s.name = skill.nameKey
                .replace(/\\n/g, " ")
                .replace(/(\[\/*c*-*\]|\[[\w\d]{6}\])/g,"");
            s.cooldown = skill.cooldown;
            s.desc = skill.descKey
                .replace(/\\n/g, " ")
                .replace(/(\[\/*c*-*\]|\[[\w\d]{6}\])/g,"");
            if (skill.tierList.length) {
                s.cost = costs[skill.tierList[skill.tierList.length - 1].recipeId];
            }
        }

        for (const tier of char.unitTierList) {
            const eqList = await this.gear(tier.equipmentSetList, lang);
            tier.equipmentSetList.forEach((e, ix) => {
                const eq = eqList.find(equipment => equipment.id === e);
                if (!eq) {
                    console.log("Missing equipment for char " + char.name + ", make sure to update the gear lang stuff");
                    console.log(e);
                    return;
                }
                tier.equipmentSetList.splice(ix, 1, eq.nameKey);
            });
        }

        return char;
    }

    async function character( defId, update=false) {
        const factionMap = {
            bountyhunter : "bounty hunter",
            cargoship    : "cargo ship",
            light        : "light side",
            dark         : "dark side"
        };
        let outChar = null;
        if (update) {
            let baseCharacters = await Bot.swgoh.fetchAPI("/swgoh/data", {
                "collection": "unitsList",
                "match": {
                    "rarity": 7,
                    "obtainable": true,
                    "obtainableTime": 0
                },
                "project": {
                    "baseId": 1,
                    "skillReferenceList": 1,
                    "categoryIdList": 1,
                    "unitTierList": {
                        "tier": 1,
                        "equipmentSetList": 1
                    },
                    crewList: 1
                }
            });

            baseCharacters = baseCharacters.result;

            if (!baseCharacters) return console.log("No baseCharacters");

            for (const char of baseCharacters) {
                char.factions = [];
                if (!char.categoryIdList) return console.log("Missing baseCharacter abilities");
                char.categoryIdList.forEach(c => {
                    if (c.startsWith("alignment_") || c.startsWith("profession_") || c.startsWith("affiliation_") || c.startsWith("role_") || c.startsWith("shipclass_")) {
                        let faction = c.split("_")[1];
                        if (factionMap[faction]) faction = factionMap[faction];
                        faction = faction.replace(/s$/, "");
                        char.factions.push(faction);
                    }
                });
                delete char.categoryIdList;
                char.crew = [];
                if (char.crewList.length) {
                    for (const c of char.crewList) {
                        char.crew.push(c.unitId);
                        char.skillReferenceList = char.skillReferenceList.concat(c.skillReferenceList);
                    }
                }
                delete char.crewList;
                if (defId === char.baseId) outChar = char;
                if (char && char._id) delete char._id;
                await cache.put(Bot.config.mongodb.swapidb, "characters", {baseId: char.baseId}, char);
            }
        } else {
            outChar = await cache.get(Bot.config.mongodb.swapidb, "characters", {baseId: defId}, {_id: 0, updated: 0});
        }
        if (outChar && outChar[0]) {
            return outChar[0];
        } else {
            return outChar;
        }
    }

    async function gear( gearArray, lang, update=false ) {
        lang = lang || "eng_us";
        lang = lang.toLowerCase();
        if (!gearArray) {
            throw new Error("You need to have a list of gear here");
        } else if (!Array.isArray(gearArray)) {
            gearArray = [gearArray];
        }

        if (update) {
            const gOut = [];
            let gearList = await Bot.swgoh.fetchAPI("/swgoh/data", {
                "collection": "equipmentList",
                "language": "eng_us",
                "enums":true,
                "project": {
                    "id": 1,
                    "nameKey": 1,
                    "recipeId": 1,
                    "mark": 1
                }
            });
            gearList = gearList.result;

            if (!gearList) return console.log("Missing gearList for " + lang);

            for (const gearPiece of gearList) {
                gearPiece.language = lang.toLowerCase();
                if (gearArray.includes(gearPiece.id)) {
                    gOut.push(gearPiece);
                }
                if (gearPiece && gearPiece._id) delete gearPiece._id;
                await cache.put(Bot.config.mongodb.swapidb, "gear", {id: gearPiece.id, language: lang}, gearPiece);
            }
            return gOut;
        } else {
            // All the skills should be loaded, so just get em from the cache
            const gOut = await cache.get(Bot.config.mongodb.swapidb, "gear", {id: {$in: gearArray}, language: lang.toLowerCase()}, {_id: 0, updated: 0});
            return gOut;
        }
    }

    async function units( defId, lang, update=false ) {
        lang = lang || "eng_us";
        lang = lang.toLowerCase();
        if (!defId && !update) {
            throw new Error("You need to specify a defId");
        }

        if (update) {
            let uOut;
            let unitList = await Bot.swgoh.fetchAPI("/swgoh/data", {
                "collection": "unitsList",
                "language": lang,
                "enums":true,
                "match": {
                    "rarity": 7,
                    "obtainable": true,
                    "obtainableTime": 0
                },
                "project": {
                    "baseId": 1,
                    "nameKey": 1,
                    "categoryIdList": 1,
                    skillReferenceList: 1,
                    "unitTierList": {
                        "tier": 1,
                        "equipmentSetList": 1
                    },
                    crewList: 1,
                    "creationRecipeReference": 1
                }
            });
            unitList = unitList.result;

            if (!unitList) return console.log("No unitList for " + lang);

            for (const unit of unitList) {
                unit.language = lang.toLowerCase();
                if (unit.baseId === defId) {
                    uOut = unit.nameKey;
                }
                if (unit && unit._id) delete unit._id;
                await cache.put(Bot.config.mongodb.swapidb, "units", {baseId: unit.baseId, language: lang}, unit);
            }
            return uOut;
        } else {
            // All the skills should be loaded, so just get em from the cache
            let uOut = await cache.get(Bot.config.mongodb.swapidb, "units", {baseId: defId, language: lang.toLowerCase()}, {_id: 0, updated: 0});
            if (Array.isArray(uOut)) uOut = uOut[0];
            return uOut;
        }
    }

    async function recipes( recArray, lang, update=false ) {
        lang = lang || "eng_us";
        if (!recArray) {
            throw new Error("You need to have a list of gear here");
        } else if (!Array.isArray(recArray)) {
            recArray = [recArray];
        }

        if (update) {
            const rOut = [];
            let recList = await Bot.swgoh.fetchAPI("/swgoh/data", {
                "collection": "recipeList",
                "language": "eng_us",
                "enums":true,
                "project": {
                    "id": 1,
                    "nameKey": 1,
                    "descKey": 1,
                    "result": 1,
                    "ingredientsList": 1
                }
            });

            recList = recList.result;

            if (!recList) return console.log("No recList for " + lang);

            for (const rec of recList) {
                rec.language = lang.toLowerCase();
                if (recArray.includes(rec.id)) {
                    rOut.push(rec);
                }
                await cache.put(Bot.config.mongodb.swapidb, "recipes", {id: rec.id, language: lang}, rec);
            }
            return rOut;
        } else {
            // All the skills should be loaded, so just get em from the cache
            const rOut = await cache.get(Bot.config.mongodb.swapidb, "recipes", {id: {$in: recArray}, language: lang.toLowerCase()}, {_id: 0, updated: 0});
            return rOut;
        }
    }

    async function battles( batId, update=false ) {
        if (!batId) throw new Error("Missing batId");
        if (update) {
            let bOut;
            let battleList = await Bot.swgoh.fetchAPI("/swgoh/battles", {
                "language": "eng_us",
                "enums":true
            });

            const errors = battleList.error;
            if (errors) console.log("Error: " + errors);
            const warnings = battleList.warning;
            if (warnings) console.log("Warning: " + warnings);
            battleList = battleList.result.battles;

            for (const battle of battleList) {
                if (battle.id === batId) bOut = battle;
                await cache.put(Bot.config.mongodb.swapidb, "battles", {id: battle.id}, battle);
            }
            return bOut;
        } else {
            // All the skills should be loaded, so just get em from the cache
            const bOut = await cache.get(Bot.config.mongodb.swapidb, "battles", {id: batId}, {_id: 0, updated: 0});
            return bOut;
        }
    }

    async function materials( matArray, lang, update=false ) {
        lang = lang || "eng_us";
        if (!matArray) {
            throw new Error("You need to have a list of materials here");
        } else if (!Array.isArray(matArray)) {
            matArray = [matArray];
        }

        if (update) {
            const mOut = [];
            let matList = await Bot.swgoh.fetchAPI("/swgoh/data", {
                "collection": "materialList",
                "language": "eng_us",
                "enums":true,
                "project": {
                    "id": 1,
                    "nameKey": 1,
                    "descKey": 1,
                    "lookupMissionList": 1,
                    "raidLookupList": 1
                }
            });
            matList = matList.result;

            for (const mat of matList) {
                mat.language = lang.toLowerCase();
                if (matArray.includes(mat.id)) {
                    mOut.push(mat);
                }
                await cache.put(Bot.config.mongodb.swapidb, "materials", {id: mat.id, language: lang}, mat);
            }
            return mOut;
        } else {
            // All the skills should be loaded, so just get em from the cache
            const mOut = await cache.get(Bot.config.mongodb.swapidb, "materials", {id: {$in: matArray}, language: lang.toLowerCase()}, {_id: 0, updated: 0});
            return mOut;
        }
    }

    async function guild( allycode, lang="ENG_US", cooldown ) {
        lang = lang || "ENG_US";

        if (cooldown) {
            cooldown = cooldown.guild;
            if (cooldown > guildMaxCooldown) cooldown = guildMaxCooldown;
            if (cooldown < guildMinCooldown) cooldown = guildMinCooldown;
        } else {
            cooldown = guildMaxCooldown;
        }
        let warnings;
        try {
            if (allycode) allycode = allycode.toString();
            if ( !allycode || isNaN(allycode) || allycode.length !== 9 ) { throw new Error("Please provide a valid allycode"); }
            allycode = parseInt(allycode);

            /** Get player from cache */
            let player = await Bot.swgohAPI.unitStats(allycode);
            if (Array.isArray(player)) player = player[0];
            if (!player) { throw new Error("I don't know this player, make sure they're registered first"); }
            if (!player.guildRefId) throw new Error("Sorry, that player is not in a guild");

            let guild  = await cache.get(Bot.config.mongodb.swapidb, "guilds", {id: player.guildRefId});

            /** Check if existance and expiration */
            if ( !guild || !guild[0] || isExpired(guild[0].updated, cooldown, true) ) {
                /** If not found or expired, fetch new from API and save to cache */
                let tempGuild;
                try {
                    tempGuild = await swgoh.fetchGuild({
                        allycode: allycode,
                        language: lang,
                        enums: true
                    });
                    if (tempGuild.warning) warnings = tempGuild.warning;
                    if (tempGuild.error) throw new Error(tempGuild.error.description);
                    tempGuild = tempGuild.result;
                } catch (err) {
                    // Probably API timeout
                    // console.log("[SWAPI-guild] Couldn't update guild for: " + player.name);
                    throw new Error(err);
                }
                // console.log(`Updated ${player.name} from ${tempGuild[0] ? tempGuild[0].name + ", updated: " + tempGuild[0].updated : "????"}`);

                if (tempGuild && tempGuild[0]) {
                    tempGuild = tempGuild[0];
                    if (tempGuild && tempGuild._id) delete tempGuild._id;  // Delete this since it's always whining about it being different
                }

                if (!tempGuild || !tempGuild.roster || !tempGuild.name) {
                    if (guild[0] && guild[0].roster) {
                        return guild[0];
                    } else {
                        // console.log("Broke getting tempGuild: " + inspect(tempGuild.error));
                        // throw new Error("Could not find your guild. The API is likely overflowing.");
                    }
                }

                guild = await cache.put(Bot.config.mongodb.swapidb, "guilds", {name: tempGuild.name}, tempGuild);
                if (warnings) guild.warnings = warnings;
            } else {
                /** If found and valid, serve from cache */
                guild = guild[0];
            }
            return guild;
        } catch (e) {
            console.log("SWAPI(guild) Broke getting guild: " + e);
            throw e;
        }
    }

    async function guildByName( gName ) {
        try {
            const guild  = await cache.get(Bot.config.mongodb.swapidb, "guilds", {name:gName});

            if ( !guild || !guild[0] ) {
                return null;
            }
            return guild[0];
        } catch (e) {
            console.log("SWAPI(guild) Broke getting guild: " + e);
            throw e;
        }
    }

    async function guildGG( allyCodes, lang, cooldown ) {
        lang = lang || "ENG_US";
        if (cooldown && cooldown.guild) {
            cooldown = cooldown.guild;
            if (cooldown.guild > guildMaxCooldown) cooldown = guildMaxCooldown;
            if (cooldown.guild < guildMinCooldown) cooldown = guildMinCooldown;
        } else {
            cooldown = guildMaxCooldown;
        }
        let warnings;
        const players = await cache.get(Bot.config.mongodb.swapidb, "pUnits", {allyCode:{ $in: allyCodes}});

        const fresh = [];
        players.forEach(p => {
            // Take out anyone who's recent enough to not need to be updated
            if (p && !isExpired(p.updated, cooldown, true)) {
                allyCodes.splice(allyCodes.indexOf(p.allyCode), 1);
                fresh.push(p);
            }
        });

        if (allyCodes.length > 0) {
            let rosters = await swgoh.fetchRoster({
                "allycodes": allyCodes,
                "language": lang,
                "enums": true,
                "project": {
                    "player": 1,
                    "allyCode": 1,
                    "type": 1,
                    "gp": 1,
                    "starLevel": 1,
                    "level": 1,
                    "gearLevel": 1,
                    "gear": 1,
                    "zetas": 1,
                    "mods": 0
                }
            });
            if (rosters.warning) warnings = rosters.warning;
            if (rosters.error) throw new Error(rosters.error);
            rosters = rosters.result;

            for (const p of rosters) {
                // Get the updated/ ally code from Jedi Consular since everyone is guaranteed to have him
                Object.keys(p).forEach(c => {
                    if (Array.isArray(p[c])) {
                        p[c] = p[c][0];
                    }
                });
                const pNew = {
                    allyCode: p.JEDIKNIGHTCONSULAR.allyCode,
                    updated: p.JEDIKNIGHTCONSULAR.updated,
                    roster: p
                };
                fresh.push(pNew);
                await cache.put(Bot.config.mongodb.swapidb, "pUnits", {allyCode: pNew.allyCode}, pNew);
            }
        }

        const gg = {};
        const roster = {};
        gg.updated = Math.max(...fresh.map(p => parseInt(p.updated)));
        fresh.forEach(p => {
            Object.keys(p.roster).forEach(unit => {
                if (!roster[unit]) {
                    roster[unit] = [p.roster[unit]];
                } else {
                    roster[unit].push(p.roster[unit]);
                }
            });
        });

        gg.roster = roster;
        if (warnings) gg.warnings = warnings;

        return gg;
    }

    async function zetaRec( lang="ENG_US" ) {
        let zetas = await cache.get(Bot.config.mongodb.swapidb, "zetaRec", {lang:lang});

        /** Check if existance and expiration */
        if ( !zetas || !zetas[0] || !zetas[0].zetas || isExpired(zetas[0].zetas.updated, zetaCooldown) ) {
            /** If not found or expired, fetch new from API and save to cache */
            try {
                zetas =  await swgoh.fetchAPI("/swgoh/zetas", {
                    language: lang,
                    enums: true,
                    "project": {
                        zetas: 1,
                        credits: 1,
                        updated: 1
                    }
                });
                if (zetas.error) throw new Error(zetas.error);
                zetas = zetas.result;
            } catch (e) {
                console.log("[SWGoHAPI] Could not get zeta recs: " + e.message);
            }
            if (Array.isArray(zetas)) {
                zetas = zetas[0];
            }
            zetas = {
                lang: lang,
                zetas: zetas
            };
            zetas = await cache.put(Bot.config.mongodb.swapidb, "zetaRec", {lang:lang}, zetas);
            zetas = zetas.zetas;
        } else {
            /** If found and valid, serve from cache */
            zetas = zetas[0].zetas;
        }
        return zetas;
    }

    async function events( lang="ENG_US" ) {
        /** Get events from cache */
        let events = await cache.get(Bot.config.mongodb.swapidb, "events", {lang:lang});

        /** Check if existance and expiration */
        if ( !events || !events[0] || isExpired(events[0].updated, eventCooldown) ) {
            /** If not found or expired, fetch new from API and save to cache */
            try {
                events =  await swgoh.fetchAPI("/swgoh/events", {
                    language: lang,
                    enums: true
                });
                events = events.result;
            } catch (e) {
                console.log("[SWGoHAPI] Could not get events");
            }
            if (Array.isArray(events)) {
                events = events[0];
            }
            events = {
                lang: lang,
                events: events.events,
                updated: events.updated
            };
            events = await cache.put(Bot.config.mongodb.swapidb, "events", {lang:lang}, events);
        } else {
            /** If found and valid, serve from cache */
            events = events[0];
        }
        return events;
    }

    async function register(putArray) {
        const getArray = putArray.map(a => a[0]);

        return await swgoh.fetchAPI("/registration", {
            "put":putArray,
            "get":getArray
        });
    }

    async function unregister(putArray) {
        return await swgoh.fetchAPI("/registration", {
            "del":putArray,
        });
    }

    async function whois( ids ) {
        if (!Array.isArray(ids)) {
            ids = [ids];
        }
        if (!ids.length) return [];
        if (!ids) {
            throw new Error("Please provide one or more allycodes or discordIds");
        }

        /** Get player from swapi cacher */
        return await swgoh.fetchAPI("/registration", {
            "get":ids
        });
    }

    function isExpired( updated, cooldown={}, guild=false ) {
        if (!updated) return true;
        if (guild) {
            if (!cooldown) {
                cooldown = guildMaxCooldown;
            }
            const diff = Bot.convertMS( new Date() - new Date(updated) );
            return diff.totalMin >= cooldown;
        } else {
            if (!cooldown) {
                cooldown = playerMaxCooldown;
            }
            const diff = Bot.convertMS( new Date() - new Date(updated) );
            return diff.totalMin >= cooldown;
        }
    }
};
