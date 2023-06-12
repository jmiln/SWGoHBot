const { inspect } = require("util"); // eslint-disable-line no-unused-vars
const statEnums = require("../data/statEnum.js");
const { eachLimit } = require("async");
const { readFileSync } = require("node:fs");

const config = require(__dirname + "/../config.js");
const abilityCosts = JSON.parse(readFileSync(__dirname + "/../data/abilityCosts.json", "utf-8"));

const ComlinkStub = require("@swgoh-utils/comlink");
if (!config.fakeSwapiConfig?.clientStub) {
    throw new Error("Missing clientStub config info!");
}
const comlinkStub = new ComlinkStub(config.fakeSwapiConfig.clientStub);

const modMap = require(__dirname + "/../data/modMap.json");
const unitMap = require(__dirname + "/../data/unitMap.json");
const skillMap = require(__dirname + "/../data/skillMap.json");

// const statLang = { "0": "None", "1": "Health", "2": "Strength", "3": "Agility", "4": "Tactics", "5": "Speed", "6": "Physical Damage", "7": "Special Damage", "8": "Armor", "9": "Resistance", "10": "Armor Penetration", "11": "Resistance Penetration", "12": "Dodge Chance", "13": "Deflection Chance", "14": "Physical Critical Chance", "15": "Special Critical Chance", "16": "Critical Damage", "17": "Potency", "18": "Tenacity", "19": "Dodge", "20": "Deflection", "21": "Physical Critical Chance", "22": "Special Critical Chance", "23": "Armor", "24": "Resistance", "25": "Armor Penetration", "26": "Resistance Penetration", "27": "Health Steal", "28": "Protection", "29": "Protection Ignore", "30": "Health Regeneration", "31": "Physical Damage", "32": "Special Damage", "33": "Physical Accuracy", "34": "Special Accuracy", "35": "Physical Critical Avoidance", "36": "Special Critical Avoidance", "37": "Physical Accuracy", "38": "Special Accuracy", "39": "Physical Critical Avoidance", "40": "Special Critical Avoidance", "41": "Offense", "42": "Defense", "43": "Defense Penetration", "44": "Evasion", "45": "Critical Chance", "46": "Accuracy", "47": "Critical Avoidance", "48": "Offense", "49": "Defense", "50": "Defense Penetration", "51": "Evasion", "52": "Accuracy", "53": "Critical Chance", "54": "Critical Avoidance", "55": "Health", "56": "Protection", "57": "Speed", "58": "Counter Attack", "59": "UnitStat_Taunt", "61": "Mastery" };

const flatStats = [
    1,  // health
    5,  // speed
    28, // prot
    41, // offense
    42  // defense
];


const MAX_CONCURRENT = 20;

let specialAbilityList = null;
let cache = null;
async function init() {
    const MongoClient = require("mongodb").MongoClient;
    const mongo = await MongoClient.connect(config.mongodb.url, { useNewUrlParser: true, useUnifiedTopology: true } );
    cache = require("../modules/cache.js")(mongo);
}

module.exports = (opts={}) => {
    // This is just here so it'll actually accept it properly when I require() this file... Doesn't work with just `module.exports = () => ` for some reason
    if (opts?.noop) return null;
    init();
    // Set the max cooldowns (In minutes)
    const playerMinCooldown = 1;    // 1 min
    const playerMaxCooldown = 3*60; // 3 hours
    const guildMinCooldown  = 3*60; // 3 hours
    const guildMaxCooldown  = 6*60; // 6 hours

    return {
        abilities        : abilities,
        character        : character,
        gear             : gear,
        getCharacter     : getCharacter,
        getPayoutFromAC  : getPayoutFromAC,
        getPlayerUpdates : getPlayerUpdates,
        getPlayersArena  : getPlayersArena,
        getRawGuild      : getRawGuild,
        guild            : guild,
        guildByName      : guildByName,
        guildUnitStats   : guildUnitStats,
        langChar         : langChar,
        playerByName     : playerByName,
        recipes          : recipes,
        unitStats        : unitStats,
        units            : units,
        zetaRec          : zetaRec,
    };

    // Grab the abilities that have Zeta / Omicron levels for future reference
    async function getSpecialAbilities() {
        if (!specialAbilityList) {
            const abilityList = await cache.get(config.mongodb.swapidb, "abilities", {
                $or: [
                    {
                        isOmicron: true,
                        language: "eng_us"
                    },
                    {
                        isZeta: true,
                        language: "eng_us"
                    }
                ]
            }, {
                skillId: 1, _id: 0, zetaTier: 1, omicronTier: 1, omicronMode: 1
            });
            specialAbilityList = abilityList;
        }
        return specialAbilityList;
    }

    async function playerByName(name) {
        try {
            if (!name || !name.length) return null;
            if (typeof name !== "string") name = name.toString();

            /** Try to get player's ally code from cache */
            const player = await cache.get(config.mongodb.swapidb, "playerStats", {name: new RegExp(name, "i")}, {name: 1, allyCode: 1, _id: 0});

            return player;
        } catch (e) {
            console.error(`SWAPI Broke getting player by name (${name}): ${e}`);
            throw e;
        }
    }

    async function getPayoutFromAC(allycodes) {
        // Make sure the allycode(s) are in an array
        if (!Array.isArray(allycodes)) {
            if (!allycodes) {
                return false;
            }
            allycodes = [allycodes];
        }
        allycodes = allycodes.map(a => parseInt(a, 10));
        const players = await cache.get(config.mongodb.swapidb, "playerStats", {allyCode: {$in: allycodes}}, {_id: 0, name: 1, allyCode: 1, poUTCOffsetMinutes: 1});
        return players;
    }

    async function getPlayersArena(allycodes) {
        if (!Array.isArray(allycodes)) {
            if (!allycodes) {
                return false;
            }
            allycodes = [allycodes];
        }
        allycodes = allycodes.filter(ac => !!ac).map(ac => ac.toString()).filter(ac => ac.length === 9);
        if (!allycodes.length) throw new Error("No valid ally code(s) entered");

        const playersOut = [];
        await eachLimit(allycodes, MAX_CONCURRENT, async function(ac) {
            const p = await comlinkStub.getPlayerArenaProfile(ac.toString())
                .catch(() => {});
                // .catch(err => console.log(`Error in stub.getPlayerArenaProfile for (${ac}) \n${inspect(err)}`));//`?.response?.body ? err.response.body : err)}`));
            playersOut.push(p);
        });

        return playersOut.map(p => {
            if (p) {
                const charArena = p.pvpProfile.find(t => t.tab === 1);
                const shipArena = p.pvpProfile.find(t => t.tab === 2);
                return {
                    name: p.name,
                    allyCode: parseInt(p.allyCode, 10),
                    arena: {
                        char: {
                            rank: charArena ? charArena.rank : null
                        },
                        ship: {
                            rank: shipArena ? shipArena.rank : null
                        }
                    },
                    poUTCOffsetMinutes: p.localTimeZoneOffsetMinutes
                };
            }
        }).filter(p => !!p);
    }

    async function getPlayerUpdates(allycodes) {
        const specialAbilities = await getSpecialAbilities();
        if (!Array.isArray(allycodes)) {
            allycodes = [allycodes];
        }

        const updatedBare = [];
        await eachLimit(allycodes, MAX_CONCURRENT, async function(ac) {
            const tempBare = await comlinkStub.getPlayer(ac?.toString()).catch((err) => {
                console.error(`Error in eachLimit getPlayer (${ac}):`);
                return console.error(err);
            });
            if (!tempBare) console.error("[getPlayerUpdates] Broke while getting tempBare");
            else {
                const formattedComlinkPlayer = await formatComlinkPlayer(tempBare);
                updatedBare.push(formattedComlinkPlayer);
            }
        });

        const oldMembers = await cache.get(config.mongodb.swapidb, "rawPlayers", {allyCode: {$in: allycodes.map(ac => parseInt(ac, 10))}});
        const guildLog = {};

        // For each of the up to 50 players in the guild
        for (const newPlayer of updatedBare) {
            const oldPlayer = oldMembers.find(p => p.allyCode === newPlayer.allyCode);
            if (!oldPlayer?.roster) {
                // If they've not been in there before, stick em into the db
                await cache.put(config.mongodb.swapidb, "rawPlayers", {allyCode: newPlayer.allyCode}, newPlayer);

                // Then move on, since there's no old data to compare against
                continue;
            }
            if (JSON.stringify(oldPlayer.roster) == JSON.stringify(newPlayer.roster)) continue;

            const playerLog = {
                abilities: [],
                geared: [],
                leveled: [],
                reliced: [],
                starred: [],
                unlocked: [],
                ultimate: []
            };

            // Check through each of the 250ish? units in their roster for differences
            for (const newUnit of newPlayer.roster) {
                const oldUnit = oldPlayer.roster.find(u => u.defId === newUnit.defId);
                if (JSON.stringify(oldUnit) == JSON.stringify(newUnit)) continue;
                const locChar = await langChar({defId: newUnit.defId, skills: newUnit.skills});
                if (!locChar?.nameKey) locChar.nameKey = newUnit.defId;
                if (!oldUnit) {
                    playerLog.unlocked.push(`Unlocked ${locChar.nameKey}!`);
                    if (newUnit?.level > 1) {
                        playerLog.unlocked.push(` - Upgraded to level ${newUnit.level}`);
                    }
                    if (newUnit.gear > 1) {
                        playerLog.unlocked.push(` - Upgraded to gear ${newUnit.gear}`);
                    }
                    continue;
                }
                if (oldUnit.level < newUnit.level) {
                    playerLog.leveled.push(`Leveled up ${locChar.nameKey} to ${newUnit.level}!`);
                }
                if (oldUnit.rarity < newUnit.rarity) {
                    playerLog.starred.push(`Starred up ${locChar.nameKey} to ${newUnit.rarity} star!`);
                }
                for (const skillId of newUnit.skills.map(s => s.id)) {
                    // For each of the skills, see if it's changed
                    const oldSkill = oldUnit.skills.find(s => s.id === skillId);
                    const newSkill = newUnit.skills.find(s => s.id === skillId);

                    if ((!oldSkill && newSkill?.tier) ||  oldSkill?.tier < newSkill?.tier) {
                        const locSkill = locChar.skills.find(s => s.id == skillId);

                        // Grab zeta/ omicron data for the ability if available
                        const thisAbility = specialAbilities.find(abi => abi.skillId == newSkill.id);
                        if (thisAbility?.omicronTier) {
                            newSkill.isOmicron = true;
                            newSkill.omicronTier = thisAbility.omicronTier + 1;
                            newSkill.omicronMode = thisAbility.omicronMode;
                        }
                        if (thisAbility?.zetaTier) {
                            newSkill.isZeta = true;
                            newSkill.zetaTier = thisAbility.zetaTier + 1;
                        }

                        if (!oldSkill) {
                            playerLog.abilities.push(`Unlocked ${locChar.nameKey}'s **${locSkill.nameKey}**`);
                        }

                        if ((newSkill.isOmicron || newSkill.isZeta) && (newSkill.tier >= newSkill.zetaTier || newSkill.tier >= newSkill.omicronTier)) {
                            // If the skill has zeta/ omicron tiers, and is high enough level
                            if (oldSkill?.tier < newSkill.zetaTier && newSkill.tier >= newSkill.zetaTier) {
                                // If it was below the Zeta tier before, and at or above it now
                                playerLog.abilities.push(`Zeta'd ${locChar.nameKey}'s **${locSkill.nameKey}**`);
                            }

                            if (oldSkill?.tier < newSkill.omicronTier && newSkill.tier >= newSkill.omicronTier) {
                                // If it was below the Omicron tier before, and at or above it now
                                playerLog.abilities.push(`Omicron'd ${locChar.nameKey}'s **${locSkill.nameKey}**`);
                            }
                        } else {
                            // In case it's either too low to be a zeta or omicron tier upgrade, or just doesn't have one
                            playerLog.abilities.push(`Upgraded ${locChar.nameKey}'s **${locSkill.nameKey}** to level ${newSkill.tier}`);
                        }
                    }
                }
                if (oldUnit.gear < newUnit.gear) {
                    playerLog.geared.push(`Geared up ${locChar.nameKey} to G${newUnit.gear}!`);
                }
                if (oldUnit?.relic?.currentTier < newUnit?.relic?.currentTier && (newUnit.relic.currentTier - 2) > 0) {
                    playerLog.reliced.push(`Upgraded ${locChar.nameKey} to relic ${newUnit.relic.currentTier-2}!`);
                }
                if (oldUnit?.purchasedAbilityId?.length < newUnit?.purchasedAbilityId?.length) {
                    playerLog.ultimate.push(`Unlocked ${locChar.nameKey}'s **ultimate**'`);
                }
            }
            if (isPlayerUpdated(playerLog)) {
                guildLog[newPlayer.name] = playerLog;
                await cache.put(config.mongodb.swapidb, "rawPlayers", {allyCode: newPlayer.allyCode}, newPlayer);
            }
        }

        return guildLog;
    }

    function isPlayerUpdated(playerLog) {
        for (const key of Object.keys(playerLog)) {
            if (playerLog[key]?.length) return true;
        }
        return false;
    }

    /**
     * @param {Number[]} allycodes
     * @param {number} cooldown
     * @param {Object} options
     */
    async function unitStats(allycodes, cooldown=0, options={}) {
        // Make sure the allycode(s) are in an array
        if (!allycodes) return false;
        if (!Array.isArray(allycodes)) {
            allycodes = [allycodes];
        }

        const specialAbilities = await getSpecialAbilities();

        // Check the cooldown to see if it should update stuff or not
        if (!options.force) {
            if (allycodes?.length > 5) {
                // If there's more than 5 ally codes, apply the guild cooldown
                cooldown = cooldown?.guild || guildMaxCooldown;
                if (cooldown > guildMaxCooldown) cooldown = guildMaxCooldown;
                if (cooldown < guildMinCooldown) cooldown = guildMinCooldown;
            } else if (cooldown?.player) {
                // Otherwise, apply the player cooldown
                cooldown = cooldown.player;
                if (cooldown > playerMaxCooldown) cooldown = playerMaxCooldown;
                if (cooldown < playerMinCooldown) cooldown = playerMinCooldown;
            } else {
                cooldown = playerMaxCooldown;
            }
        }
        let playerStats = [];
        try {
            if (!allycodes?.length) {
                throw new Error("No valid ally code(s) entered");
            }
            allycodes = allycodes
                .filter(a => a.toString().length === 9)
                .map(a => parseInt(a, 10));

            let players;
            if (!options.force) {
                // If it's going to pull everyone fresh anyways, why bother grabbing the old data?
                if (options && options.defId) {
                    players = await cache.get(config.mongodb.swapidb, "playerStats", {allyCode: {$in: allycodes}}, {_id: 0, name: 1, allyCode: 1, roster: {$elemMatch: {defId: options.defId}}, updated: 1});
                } else {
                    players = await cache.get(config.mongodb.swapidb, "playerStats", {allyCode: {$in: allycodes}});
                }
            }

            // If options.force is true (Apparently never used?), set the list of unexpired players to be empty
            // This will make it so that all players will be run through the updater
            const updated = options.force ? [] : players.filter(p => !isExpired(p.updated, cooldown));
            const updatedAC = updated.map(p => parseInt(p.allyCode, 10));
            const needUpdating = allycodes.filter(a => !updatedAC.includes(a));

            playerStats = playerStats.concat(updated);

            let warning;
            if (needUpdating.length) {
                const updatedBare = [];
                try {
                    await eachLimit(needUpdating, MAX_CONCURRENT, async function(ac) {
                        const tempBare = await comlinkStub.getPlayer(ac?.toString()).catch(() => {});
                        if (tempBare) {
                            const formattedComlinkPlayer = await formatComlinkPlayer(tempBare);
                            updatedBare.push(formattedComlinkPlayer);
                        }
                    });
                } catch (error) {
                    // Couldn't get the data from the api, so send old stuff
                    return players;
                }

                for (const bareP of updatedBare) {
                    if (bareP?.roster?.length) {
                        try {
                            const statRoster = await fetch(config.fakeSwapiConfig.statCalc.url + "/api?flags=gameStyle,calcGP", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify(bareP.roster)
                            }).then(res => res.json());
                            bareP.roster = statRoster;
                        } catch (error) {
                            throw new Error("Error getting player stats: " + error);
                        }

                        for (const char of bareP.roster) {
                            for (const ability of char.skills) {
                                const thisAbility = specialAbilities.find(abi => abi.skillId == ability.id);
                                if (thisAbility) {
                                    if (thisAbility.omicronTier) {
                                        ability.isOmicron = true;
                                        ability.omicronTier = thisAbility.omicronTier + 1;
                                        ability.omicronMode = thisAbility.omicronMode;
                                    }
                                    if (thisAbility.zetaTier) {
                                        ability.isZeta = true;
                                        ability.zetaTier = thisAbility.zetaTier + 1;
                                    }
                                }
                            }
                        }

                        const charStats = await cache.put(config.mongodb.swapidb, "playerStats", {allyCode: bareP.allyCode}, bareP);
                        charStats.warnings = warning;
                        playerStats.push(charStats);
                    }
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
            console.error("SWAPI Broke getting playerStats: " + error);
            throw error;
        }
    }

    function getUnitDefId(unitDefId) {
        if (typeof unitDefId !== "string") return unitDefId;
        return unitDefId.split(":")[0];
    }

    async function formatComlinkPlayer(comlinkPlayer) {
        const comlinkPlayerArena = {};
        const emptyArena = {rank: null, squad: null};

        for (const { tab, rank, squad } of comlinkPlayer.pvpProfile) {
            comlinkPlayerArena[tab] = {
                rank: rank,
                squad: squad?.cell?.map(unit => {
                    return {
                        id: unit.unitId,
                        defId: getUnitDefId(unit.unitDefId),
                    };
                }) || [],
                // TODO Should probably look into making use of this if I ever get around to figuring out datacrons
                // unformattedSquad: squad
            };
        }

        return {
            allyCode: parseInt(comlinkPlayer.allyCode, 10),
            guildId: comlinkPlayer.guildId,
            guildName: comlinkPlayer.guildName,
            id: comlinkPlayer.playerId,
            name: comlinkPlayer.name,
            level: comlinkPlayer.level,
            roster: comlinkPlayer.rosterUnit.map(unit => {
                const thisDefId = unit.definitionId.split(":")[0];
                const thisUnit = unitMap[thisDefId];
                return {
                    id: unit.id,
                    defId: thisDefId,
                    nameKey: thisUnit.nameKey,
                    level: unit.currentLevel,
                    rarity: unit.currentRarity,
                    gear: unit.currentTier,
                    equipped: unit.equipment ? unit.equipment : [],
                    skills: unit.skill.map(sk => {
                        const thisSkill = skillMap[sk.id];
                        return {
                            id: sk.id,
                            tier: sk.tier + 2,
                            tiers: thisSkill.tiers + 1
                        };
                    }),
                    relic: unit.relic,
                    purchasedAbilityId: unit.purchasedAbilityId,
                    crew: thisUnit.crew,
                    combatType: thisUnit.combatType,
                    mods: unit.equippedStatMod ? unit.equippedStatMod.map(mod => formatMod(mod)) : [],
                };
            }),
            stats: comlinkPlayer.profileStat
                ?.filter(({nameKey}) => {
                    return nameKey?.includes("GALACTIC_POWER");
                })
                .map(({nameKey, value}) => {
                    return {
                        nameKey,
                        value: Number(value)
                    };
                }) || [],
            arena: {
                char: comlinkPlayerArena[1] || emptyArena,
                ship: comlinkPlayerArena[2] || emptyArena
            },
            guildBannerColor: comlinkPlayer.guildBannerColor,
            guildBannerLogo: comlinkPlayer.guildBannerLogo,
            poUTCOffsetMinutes: comlinkPlayer.localTimeZoneOffsetMinutes,
            lastActivity: comlinkPlayer.lastActivityTime,

            // // TODO I don't do anything with these, but I probably should at some point
            // datacron: ???
            // grandArena: comlinkPlayer.seasonStatus,
            // playerRating: comlinkPlayer.playerRating,
            // lifetimeSeasonScore: comlinkPlayer.lifetimeSeasonScore,

            // // I don't do anything with the rest of these at this time
            // titles: {
            //     selected: comlinkPlayer.selectedPlayerTitle || null,
            //     unlocked: comlinkPlayer.unlockedPlayerTitle || []
            // }
            // portraits: {
            //     selected: comlinkPlayer.selectedPlayerPortrait?.id || null,
            //     unlocked: comlinkPlayer?.unlockedPlayerPortrait.map(portrait => portrait.id) || []
            // },
            // guildTypeId: comlinkPlayer.guildTypeId,

            // // Never seems to be populated?
            // guildLogoBackground,
        };
    }

    function formatMod({ definitionId, primaryStat, id, level, tier, secondaryStat, ...rest }) {
        const modSchema = modMap[definitionId] || {};
        const primaryStatId = primaryStat.stat.unitStatId;
        const primaryStatScaler = flatStats.includes(primaryStatId) ? 1e8 : 1e6;
        return {
            ...rest,
            id,
            level,
            tier,
            slot: modSchema.slot-1, // mod slots are numbered 2-7
            set: Number(modSchema.set),
            pips: modSchema.pips,
            primaryStat: {
                unitStat: primaryStat.stat.unitStatId,
                value: primaryStat.stat.unscaledDecimalValue / primaryStatScaler
            },
            secondaryStat: secondaryStat ? secondaryStat.map(stat => {
                const statId = stat.stat.unitStatId;
                const statScaler = flatStats.includes(statId) ? 1e8 : 1e6;
                return {
                    unitStat: stat.stat.unitStatId,
                    value: stat.stat.unscaledDecimalValue / statScaler,
                    roll: stat.statRolls
                };
            }) : []
        };
    }

    async function langChar(char, lang) {
        lang = lang ? lang.toLowerCase() : "eng_us";
        if (!char) throw new Error("Missing Character");

        if (char.defId) {
            const unit = await units(char.defId);
            char.nameKey = unit ? unit.nameKey : null;
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
        if (char.skillReferenceList) {
            for (const skill in char.skillReferenceList) {
                let skillName = await cache.get(config.mongodb.swapidb, "abilities", {skillId: char.skillReferenceList[skill].skillId, language: lang}, {nameKey: 1, _id: 0});
                if (Array.isArray(skillName)) skillName = skillName[0];
                if (!skillName) throw new Error("Cannot find skillName for " + char.skillReferenceList[skill].skillId);
                char.skillReferenceList[skill].nameKey = skillName.nameKey;
            }
        }

        // In case it doesn't
        if (char.skills) {
            for (const skill in char.skills) {
                let skillName = await cache.get(config.mongodb.swapidb, "abilities", {skillId: char.skills[skill].id, language: lang}, {nameKey: 1, _id: 0});
                if (Array.isArray(skillName)) skillName = skillName[0];
                if (!skillName) throw new Error("Cannot find skillName for " + char.skills[skill].id);
                char.skills[skill].nameKey = skillName.nameKey;
            }
        }
        return char;
    }

    /**
     * @param {Number[]} allyCodes                       - An array of allycodes
     * @param {String} defId                             - The ID of the character you want to compare
     * @param {{player: number, guild: number}} cooldown - The cooldown for the user requesting the info
     * @returns {Promise<Object[]>}                      - Returns an array of player objects with just the specified character in their roster
     */
    async function guildUnitStats( allyCodes, defId, cooldown ) {
        if (!cooldown?.guild || cooldown.guild > guildMaxCooldown) cooldown.guild = guildMaxCooldown;
        if (cooldown.guild < guildMinCooldown) cooldown.guild = guildMinCooldown;

        const outStats = [];
        const blankUnit = { defId: defId, gear: 0, gp: 0, level: 0, rarity: 0, skills: [], zetas: [], omicrons: [], relic: {currentTier: 0}, equipped: [], stats: {} };
        const players = await unitStats(allyCodes, cooldown, {defId: defId});
        if (!players.length) throw new Error("Couldn't get your stats");

        for (const player of players) {
            let unit;

            if (player?.roster?.length) {
                unit = player.roster.find(c => c.defId === defId);
            }
            if (!unit) {
                unit = JSON.parse(JSON.stringify(blankUnit));
            }
            unit.zetas    = unit.skills.filter(s => s.isZeta    && s.tier >= s.zetaTier);
            unit.omicrons = unit.skills.filter(s => s.isOmicron && s.tier >= s.omicronTier);
            unit.player   = player.name;
            unit.allyCode = player.allyCode;
            unit.updated  = player.updated;
            outStats.push(unit);
        }
        return outStats;
    }

    async function abilities( skillArray, lang, opts ) {
        lang = lang || "eng_us";
        if (!opts) opts = {};
        if (!skillArray) {
            throw new Error("You need to have a list of abilities here");
        } else if (!Array.isArray(skillArray)) {
            skillArray = [skillArray];
        }

        // All the skills should be loaded, so just get em from the cache
        if (opts.min) {
            const skillOut = await cache.get(config.mongodb.swapidb, "abilities", {skillId: {$in: skillArray}, language: lang.toLowerCase()}, {nameKey: 1, _id: 0});
            return skillOut;
        } else {
            const skillOut = await cache.get(config.mongodb.swapidb, "abilities", {skillId: {$in: skillArray}, language: lang.toLowerCase()}, {_id: 0, updated: 0});
            return skillOut;
        }
    }

    // Grab all of a character's info in the given language (Name, Abilities, Equipment)
    async function getCharacter(defId, lang) {
        lang = lang ? lang.toLowerCase() : "eng_us";
        if (!defId) throw new Error("[getCharacter] Missing character ID.");

        const char = await character(defId);

        if (!char) {
            throw new Error("[SWGoH-API getCharacter] Missing Character");
        } else if (!char.skillReferenceList) {
            throw new Error("[SWGoH-API getCharacter] Missing character abilities");
        }

        for (const s of char.skillReferenceList) {
            let skill = await abilities([s.skillId], lang);
            if (Array.isArray(skill)) {
                skill = skill[0];
            }
            if (!skill) {
                throw new Error("Missing character ability");
            }
            s.isZeta = skill.isZeta;
            s.isOmicron = skill.isOmicron;
            s.name = skill.nameKey
                .replace(/\\n/g, " ")
                .replace(/(\[\/*c*-*\]|\[[\w\d]{6}\])/g,"");
            s.cooldown = skill.cooldown;
            s.desc = skill.descKey
                .replace(/\\n/g, " ")
                .replace(/(\[\/*c*-*\]|\[[\w\d]{6}\])/g,"");
            if (skill.tierList.length) {
                s.cost = {};
                for (const tier of skill.tierList) {
                    if (abilityCosts[tier]) {
                        for (const key of Object.keys(abilityCosts[tier])) {
                            s.cost[key] = s.cost[key] ? s.cost[key] += abilityCosts[tier][key] : s.cost[key] = abilityCosts[tier][key];
                        }
                    }
                }
            }
        }

        for (const tier of char.unitTierList) {
            const eqList = await gear(tier.equipmentSetList, lang);
            tier.equipmentSetList.forEach((e, ix) => {
                const eq = eqList.find(equipment => equipment.id === e);
                if (!eq) {
                    console.error("Missing equipment for char " + char.name + ", make sure to update the gear lang stuff" + inspect(e));
                    return;
                }
                tier.equipmentSetList.splice(ix, 1, eq.nameKey);
            });
        }

        return char;
    }

    // Function for updating all the stored character data from the game
    async function character( defId ) {
        const outChar = await cache.get(config.mongodb.swapidb, "characters", {baseId: defId}, {_id: 0, updated: 0});
        if (outChar && outChar[0]) {
            return outChar[0];
        } else {
            return outChar;
        }
    }

    // Get the gear for a given character
    async function gear( gearArray, lang ) {
        lang = lang || "eng_us";
        lang = lang.toLowerCase();
        if (!gearArray) {
            throw new Error("You need to have a list of gear here");
        } else if (!Array.isArray(gearArray)) {
            gearArray = [gearArray];
        }

        // All the skills should be loaded, so just get em from the cache
        const gOut = await cache.get(config.mongodb.swapidb, "gear", {id: {$in: gearArray}, language: lang.toLowerCase()}, {_id: 0, updated: 0});
        return gOut;

    }

    // Used by farm, randomchar, and reloaddata
    async function units( defId, lang ) {
        lang = lang || "eng_us";
        lang = lang.toLowerCase();
        if (!defId) throw new Error("You need to specify a defId");

        // All the skills should be loaded, so just get em from the cache
        let uOut = await cache.get(config.mongodb.swapidb, "units", {baseId: defId, language: lang.toLowerCase()}, {_id: 0, updated: 0});
        if (Array.isArray(uOut)) uOut = uOut[0];
        return uOut;
    }

    // Get gear recipes
    async function recipes( recArray, lang ) {
        lang = lang || "eng_us";
        if (!recArray) {
            throw new Error("You need to have a list of gear here");
        } else if (!Array.isArray(recArray)) {
            recArray = [recArray];
        }

        // All the skills should be loaded, so just get em from the cache
        const rOut = await cache.get(config.mongodb.swapidb, "recipes", {id: {$in: recArray}, language: lang.toLowerCase()}, {_id: 0, updated: 0});
        return rOut;
    }

    async function getRawGuild(allycode, cooldown) {
        const tempGuild = {};
        if (cooldown) {
            cooldown = cooldown.guild;
            if (cooldown > guildMaxCooldown) cooldown = guildMaxCooldown;
            if (cooldown < guildMinCooldown) cooldown = guildMinCooldown;
        } else {
            cooldown = guildMaxCooldown;
        }
        if (allycode) allycode = allycode.toString().replace(/[^\d]/g, "");
        if ( !allycode || isNaN(allycode) || allycode.length !== 9 ) { throw new Error("Please provide a valid allycode"); }

        const player = await comlinkStub.getPlayer(allycode);
        if (!player) throw new Error("I cannot find a matching profile for this allycode, please make sure it's typed in correctly");

        if (!player.guildId) throw new Error("This player is not in a guild");

        let rawGuild  = await cache.get(config.mongodb.swapidb, "rawGuilds", {id: player.guildId});
        if ( !rawGuild || !rawGuild[0] || isExpired(rawGuild[0].updated, cooldown, true) ) {
            try {
                rawGuild = await comlinkStub.getGuild(player.guildId, true);
            } catch (err) {
                throw new Error(err);
            }

            rawGuild = rawGuild.guild;
            const ignoreArr = [
                "inviteStatus",
                "raidStatus",
                "raidResult",
                "territoryBattleStatus",
                "guildEvents",
                "territoryBattleResult",
                "territoryWarStatus",
                "roomAvailable",
                "arcadeRaidStatus",
                "stat",
                "recentRaidResult",
                "recentTerritoryWarResult",
            ];

            // Only keep the useful parts of this mess
            for (const key of Object.keys(rawGuild)) {
                if (key === "member") {
                    tempGuild["roster"] = [];
                    for (const member of rawGuild.member) {
                        const tempMember = {};
                        const contribution = {};
                        for (const contType of member.memberContribution) {
                            contribution[contType.type] = {
                                currentValue: contType.currentValue,
                                lifetimeValue: contType.lifetimeValue
                            };
                        }
                        tempMember.memberContribution = contribution;
                        tempMember.playerName = member.playerName;
                        tempMember.lastActivityTime = member.lastActivityTime;
                        tempMember.playerId = member.playerId;
                        tempGuild.roster.push(tempMember);
                    }
                } else if (!ignoreArr.includes(key)) {
                    tempGuild[key] = rawGuild[key];
                }
            }
            rawGuild = await cache.put(config.mongodb.swapidb, "rawGuilds", {id: player.guildId}, tempGuild);
        } else {
            /** If found and valid, serve from cache */
            rawGuild = rawGuild[0];
        }

        if (!rawGuild) throw new Error("Sorry, that player is not in a guild");

        // If it got this far, there's at least some sort of guild resposne there
        return rawGuild;
    }

    async function guild( allycode, cooldown ) {
        if (cooldown) {
            cooldown = cooldown.guild;
            if (cooldown > guildMaxCooldown) cooldown = guildMaxCooldown;
            if (cooldown < guildMinCooldown) cooldown = guildMinCooldown;
        } else {
            cooldown = guildMaxCooldown;
        }
        let warnings;
        if (allycode) allycode = allycode.toString();
        if ( !allycode || isNaN(allycode) || allycode.length !== 9 ) { throw new Error("Please provide a valid allycode"); }
        allycode = parseInt(allycode, 10);

        /** Get player from cache */
        let player = await unitStats(allycode);
        if (Array.isArray(player)) player = player[0];
        if (!player) { throw new Error("I don't know this player, make sure they're registered first"); }
        if (!player.guildId) throw new Error("Sorry, that player is not in a guild");

        let guild = await cache.get(config.mongodb.swapidb, "guilds", {id: player.guildId});

        /** Check if existance and expiration */
        if ( !guild || !guild[0] || isExpired(guild[0].updated, cooldown, true) ) {
            /** If not found or expired, fetch new from API and save to cache */
            let tempGuild;
            try {
                tempGuild = await fetchGuild(player.guildId);
            } catch (err) {
                // Probably API timeout
                console.log("[SWAPI-guild] Couldn't update guild for: " + player.name);
                throw new Error(err);
            }
            // console.log(`Updated ${player.name} from ${tempGuild[0] ? tempGuild[0].name + ", updated: " + tempGuild[0].updated : "????"}`);

            if (Array.isArray(tempGuild)) {
                tempGuild = tempGuild[0];
                if (tempGuild?._id) delete tempGuild._id;  // Delete this since it's always whining about it being different
            }

            if (!tempGuild || !tempGuild.roster || !tempGuild.name) {
                if (guild[0] && guild[0].roster) {
                    return guild[0];
                } else {
                    // console.log("Broke getting tempGuild: " + inspect(tempGuild.error));
                    // throw new Error("Could not find your guild. The API is likely overflowing.");
                }
            }

            if (tempGuild.roster?.length !== tempGuild.members) {
                console.error(`[swgohAPI-guild] Missing players, only getting ${tempGuild.roster?.length}/${tempGuild.members}`);
            }
            guild = await cache.put(config.mongodb.swapidb, "guilds", {id: tempGuild.id}, tempGuild);
            if (warnings) guild.warnings = warnings;
        } else {
            /** If found and valid, serve from cache */
            guild = guild[0];
        }
        return guild;
    }

    async function fetchGuild(guildId) {
        const comlinkGuild = await comlinkStub.getGuild(guildId, true);

        const formattedGuild = await formatGuild(comlinkGuild);
        return formattedGuild;
    }

    async function formatGuild({ guild, raidLaunchConfig, ...topRest }) {
        const {
            profile,
            guildEventTracker,
            nextChallengesRefresh,
            recentTerritoryWarResult,
            recentRaidResult,
            member,
            ...guildRest
        } = guild;
        const {
            id,
            name,
            externalMessageKey,
            memberCount,
            enrollmentStatus,
            levelRequirement,
            bannerColorId,
            bannerLogoId,
            internalMessage,
            guildGalacticPower,
            ...profileRest
        } = profile;

        const raids = {};
        // if (raidLaunchConfig) {
        //     for (const { campaignMissionIdentifier, raidId } of raidLaunchConfig) {
        //         raids[raidId] = campaignMissionIdentifier.campaignMissionId;
        //     }
        // }
        if (recentRaidResult?.length) {
            for (const {identifier, guildRewardScore, raidId} of recentRaidResult) {
                raids[raidId] = {
                    diffId: identifier.campaignMissionId,
                    progress: guildRewardScore
                };
            }
        }

        const members = [];
        await eachLimit(member, MAX_CONCURRENT, async function({playerId, memberLevel, memberContribution, ...rest}) {
            // Grab each player and process their info
            const {name, level, allyCode, profileStat} = await comlinkStub.getPlayer(null, playerId);

            let gp;
            let gpChar;
            let gpShip;
            for (const stat of profileStat) {
                if (stat.nameKey == "STAT_SHIP_GALACTIC_POWER_ACQUIRED_NAME") {
                    gpShip = Number(stat.value);
                } else if (stat.nameKey == "STAT_GALACTIC_POWER_ACQUIRED_NAME") {
                    gp = Number(stat.value);
                } else if (stat.nameKey == "STAT_CHARACTER_GALACTIC_POWER_ACQUIRED_NAME") {
                    gpChar = Number(stat.value);
                }
                if (gp && gpChar && gpShip) break;
            }

            members.push({
                ...rest,
                id: playerId,
                guildMemberLevel: memberLevel,
                memberContribution,
                name,
                level,
                allyCode: Number(allyCode),
                gp,
                gpChar,
                gpShip,
                updated: new Date().getTime()
            });
        });

        return {
            ...profileRest,
            ...topRest,
            ...guildRest,
            id,
            name,
            desc: externalMessageKey,
            members: memberCount,
            status: enrollmentStatus,
            required: levelRequirement,
            bannerColor: bannerColorId,
            bannerLogo: bannerLogoId,
            message: internalMessage,
            gp: Number(guildGalacticPower),
            raid: raids,
            roster: members,
            updated: new Date().getTime(),
            recentTerritoryWarResult,
            nextChallengesRefresh,
            guildEventTracker,
            raidLaunchConfig
        };
    }

    async function guildByName( gName ) {
        try {
            const guild  = await cache.get(config.mongodb.swapidb, "guilds", {name: gName});

            if ( !guild || !guild[0] ) {
                return null;
            }
            return guild[0];
        } catch (e) {
            console.error("SWAPI(guild) Broke getting guild: " + e);
            throw e;
        }
    }

    async function zetaRec( lang="ENG_US" ) {
        const zetas = await cache.get(config.mongodb.swapidb, "zetaRec", {lang:lang});
        return zetas[0].zetas;
    }

    function isExpired( lastUpdated, cooldown, guild=false ) {
        if (!lastUpdated) return true;
        if (guild) {
            if (!cooldown) {
                cooldown = guildMaxCooldown;
            }
            const diff = convertMS( new Date().getTime() - new Date(lastUpdated).getTime() );
            return diff.totalMin >= cooldown;
        } else {
            if (!cooldown) {
                cooldown = playerMaxCooldown;
            }
            const diff = convertMS( new Date().getTime() - new Date(lastUpdated).getTime() );
            return diff.totalMin >= cooldown;
        }
    }
};


const convertMS = (milliseconds) => {
    var hour, totalMin, minute, seconds;
    seconds = Math.floor(milliseconds / 1000);
    totalMin = Math.floor(seconds / 60);
    seconds = seconds % 60;
    hour = Math.floor(totalMin / 60);
    minute = totalMin % 60;
    return {
        hour: hour,
        minute: minute,
        totalMin: totalMin,
        seconds: seconds
    };
};
