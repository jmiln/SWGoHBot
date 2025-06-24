const { inspect } = require("node:util"); // eslint-disable-line no-unused-vars
const statEnums = require("../data/statEnum.js");
const { eachLimit } = require("async");
const { readFileSync } = require("node:fs");
const { Worker } = require("node:worker_threads");

const os = require("node:os");
const THREAD_COUNT = os.cpus().length;

const config = require(`${__dirname}/../config.js`);
const abilityCosts = JSON.parse(readFileSync(`${__dirname}/../data/abilityCosts.json`, "utf-8"));

const ComlinkStub = require("@swgoh-utils/comlink");
if (!config.fakeSwapiConfig?.clientStub) {
    throw new Error("Missing clientStub config info!");
}
const comlinkStub = new ComlinkStub(config.fakeSwapiConfig.clientStub);

let modMap = JSON.parse(readFileSync(`${__dirname}/../data/modMap.json`, "utf-8"));
let unitMap = JSON.parse(readFileSync(`${__dirname}/../data/unitMap.json`, "utf-8"));
let skillMap = JSON.parse(readFileSync(`${__dirname}/../data/skillMap.json`, "utf-8"));

// const statLang = { "0": "None", "1": "Health", "2": "Strength", "3": "Agility", "4": "Tactics", "5": "Speed", "6": "Physical Damage", "7": "Special Damage", "8": "Armor", "9": "Resistance", "10": "Armor Penetration", "11": "Resistance Penetration", "12": "Dodge Chance", "13": "Deflection Chance", "14": "Physical Critical Chance", "15": "Special Critical Chance", "16": "Critical Damage", "17": "Potency", "18": "Tenacity", "19": "Dodge", "20": "Deflection", "21": "Physical Critical Chance", "22": "Special Critical Chance", "23": "Armor", "24": "Resistance", "25": "Armor Penetration", "26": "Resistance Penetration", "27": "Health Steal", "28": "Protection", "29": "Protection Ignore", "30": "Health Regeneration", "31": "Physical Damage", "32": "Special Damage", "33": "Physical Accuracy", "34": "Special Accuracy", "35": "Physical Critical Avoidance", "36": "Special Critical Avoidance", "37": "Physical Accuracy", "38": "Special Accuracy", "39": "Physical Critical Avoidance", "40": "Special Critical Avoidance", "41": "Offense", "42": "Defense", "43": "Defense Penetration", "44": "Evasion", "45": "Critical Chance", "46": "Accuracy", "47": "Critical Avoidance", "48": "Offense", "49": "Defense", "50": "Defense Penetration", "51": "Evasion", "52": "Accuracy", "53": "Critical Chance", "54": "Critical Avoidance", "55": "Health", "56": "Protection", "57": "Speed", "58": "Counter Attack", "59": "UnitStat_Taunt", "61": "Mastery" };

const flatStats = [
    1, // health
    5, // speed
    28, // prot
    41, // offense
    42, // defense
];

const MAX_CONCURRENT = 20;

let specialAbilityList = null;
let cache = null;
async function init() {
    const MongoClient = require("mongodb").MongoClient;
    const mongo = await MongoClient.connect(config.mongodb.url);
    cache = require("../modules/cache.js")(mongo);

    // Set it to reload the api map files every hour
    setInterval(() => {
        modMap = JSON.parse(readFileSync(`${__dirname}/../data/modMap.json`, "utf-8"));
        unitMap = JSON.parse(readFileSync(`${__dirname}/../data/unitMap.json`, "utf-8"));
        skillMap = JSON.parse(readFileSync(`${__dirname}/../data/skillMap.json`, "utf-8"));
    }, 360_000);
}

module.exports = (opts = {}) => {
    // This is just here so it'll actually accept it properly when I require() this file... Doesn't work with just `module.exports = () => ` for some reason
    if (opts?.noop) return null;
    init();
    // Set the max cooldowns (In minutes)
    const playerMinCooldown = 1; // 1 min
    const playerMaxCooldown = 3 * 60; // 3 hours
    const guildMinCooldown = 1; // 1 min
    const guildMaxCooldown = 6 * 60; // 6 hours

    return {
        abilities: abilities,
        character: character,
        gear: gear,
        getCharacter: getCharacter,
        getPayoutFromAC: getPayoutFromAC,
        getPlayerUpdates: getPlayerUpdates,
        getPlayersArena: getPlayersArena,
        getRawGuild: getRawGuild,
        guild: guild,
        guildByName: guildByName,
        guildUnitStats: guildUnitStats,
        langChar: langChar,
        playerByName: playerByName,
        recipes: recipes,
        unitStats: unitStats,
        units: units,
        zetaRec: zetaRec,
    };

    // Grab the abilities that have Zeta / Omicron levels for future reference
    async function getSpecialAbilities() {
        if (!specialAbilityList) {
            const abilityList = await cache.get(
                config.mongodb.swapidb,
                "abilities",
                {
                    $or: [
                        {
                            isOmicron: true,
                            language: "eng_us",
                        },
                        {
                            isZeta: true,
                            language: "eng_us",
                        },
                    ],
                },
                {
                    skillId: 1,
                    _id: 0,
                    zetaTier: 1,
                    omicronTier: 1,
                    omicronMode: 1,
                },
            );
            specialAbilityList = abilityList;
        }
        return specialAbilityList;
    }

    async function playerByName(name) {
        try {
            if (!name?.length || typeof name !== "string") return null;

            /** Try to get player's ally code from cache */
            const player = await cache.get(
                config.mongodb.swapidb,
                "playerStats",
                { name: new RegExp(name, "i") },
                { name: 1, allyCode: 1, _id: 0 },
            );

            return player;
        } catch (e) {
            console.error(`SWAPI Broke getting player by name (${name}): ${e}`);
            throw e;
        }
    }

    async function getPayoutFromAC(allycodes) {
        // Make sure the allycode(s) are in an array
        const acArr = Array.isArray(allycodes) ? allycodes : [allycodes];
        return await cache.get(
            config.mongodb.swapidb,
            "playerStats",
            { allyCode: { $in: acArr.map((a) => Number.parseInt(a, 10)) } },
            { _id: 0, name: 1, allyCode: 1, poUTCOffsetMinutes: 1 },
        );
    }

    async function getPlayersArena(allycodes) {
        let acArr = Array.isArray(allycodes) ? allycodes : [allycodes];
        acArr = acArr
            .filter((ac) => !!ac)
            .map((ac) => ac.toString())
            .filter((ac) => ac.length === 9);
        if (!acArr.length) throw new Error("No valid ally code(s) entered");

        const playersOut = [];
        await eachLimit(acArr, MAX_CONCURRENT, async (ac) => {
            const p = await comlinkStub.getPlayerArenaProfile(ac.toString()).catch(() => {});
            // .catch(err => console.log(`Error in stub.getPlayerArenaProfile for (${ac}) \n${inspect(err)}`));//`?.response?.body ? err.response.body : err)}`));
            playersOut.push(p);
        });

        return playersOut
            .map((p) => {
                if (p) {
                    const charArena = p.pvpProfile.find((t) => t.tab === 1);
                    const shipArena = p.pvpProfile.find((t) => t.tab === 2);
                    return {
                        name: p.name,
                        allyCode: Number.parseInt(p.allyCode, 10),
                        arena: {
                            char: {
                                rank: charArena ? charArena.rank : null,
                            },
                            ship: {
                                rank: shipArena ? shipArena.rank : null,
                            },
                        },
                        poUTCOffsetMinutes: p.localTimeZoneOffsetMinutes,
                    };
                }
            })
            .filter((p) => !!p);
    }

    async function getPlayerUpdates(allycodes) {
        const specialAbilities = await getSpecialAbilities();
        const acArr = Array.isArray(allycodes) ? allycodes : [allycodes];

        const updatedBare = [];
        await eachLimit(acArr, MAX_CONCURRENT, async (ac) => {
            const tempBare = await comlinkStub.getPlayer(ac?.toString()).catch((err) => {
                console.error(`Error in eachLimit getPlayer (${ac}):`);
                return console.error(err.toString());
            });
            if (!tempBare) console.error("[getPlayerUpdates] Broke while getting tempBare");
            else {
                const formattedComlinkPlayer = await formatComlinkPlayer(tempBare);
                updatedBare.push(formattedComlinkPlayer);
            }
        });
        const oldMembers = await cache.get(config.mongodb.swapidb, "rawPlayers", {
            allyCode: { $in: acArr.map((ac) => Number.parseInt(ac, 10)) },
        });
        const processMemberChunk = async (updatedBare, chunkIx) => {
            return new Promise((resolve, reject) => {
                const worker = new Worker(`${__dirname}/workers/getPlayerUpdates.js`, {
                    workerData: { oldMembers, updatedBare, specialAbilities, chunkIx },
                });
                worker.on("message", resolve);
                worker.on("error", reject);
                worker.on("exit", (code) => {
                    if (code !== 0) console.error(`[SWAPI getPlayerUpdates] Worker stopped with exit code ${code}`);
                    worker.terminate();
                });
            });
        };

        const memberChunks = [];
        const chunkSize = Math.ceil(updatedBare.length / THREAD_COUNT);
        for (let ix = 0, len = updatedBare.length; ix < len; ix += chunkSize) {
            const chunk = updatedBare.slice(ix, ix + chunkSize);
            memberChunks.push(chunk);
        }
        const guildLog = {};
        await Promise.all(
            memberChunks.map((mChunk, ix) => {
                return processMemberChunk(mChunk, ix + 1);
            }),
        )
            .then(async (res) => {
                const skillsArr = [];
                const defIdArr = [];
                for (const { guildLogOut, cacheUpdatesOut, skills, defIds } of res) {
                    for (const [key, value] of Object.entries(guildLogOut)) {
                        guildLog[key] = value;
                    }
                    skillsArr.push(...skills);
                    defIdArr.push(...defIds);
                    if (!cacheUpdatesOut.length) continue;
                    await cache.putMany(config.mongodb.swapidb, "rawPlayers", cacheUpdatesOut);
                }
                const skillNames = await cache.get(
                    config.mongodb.swapidb,
                    "abilities",
                    { skillId: { $in: skillsArr }, language: "eng_us" },
                    { nameKey: 1, skillId: 1 },
                );
                const unitNames = await cache.get(
                    config.mongodb.swapidb,
                    "units",
                    { baseId: { $in: defIdArr }, language: "eng_us" },
                    { baseId: 1, nameKey: 1 },
                );
                const langKeys = {};
                for (const nameId of [...skillNames, ...unitNames]) {
                    langKeys[nameId?.skillId || nameId?.baseId] = nameId.nameKey;
                }

                for (const [userName, changeObj] of Object.entries(guildLog)) {
                    // Run through all the skill/ unit names and replace the IDs with normal names
                    for (const [changeType, strArr] of Object.entries(changeObj)) {
                        // Update the strings with namekeys for anything inside `{}` braces
                        const updatedArr = strArr.map((str) =>
                            str.replace(/\{([^}]*)\}/g, (_, p1) => {
                                return langKeys[p1] || p1;
                            }),
                        );
                        guildLog[userName][changeType] = updatedArr;
                    }
                }
            })
            .catch((err) => {
                console.error(`Error running workers: ${err}`);
            });

        return guildLog;
    }

    /**
     * @param {Number[]} allycodes
     * @param {number} cooldown
     * @param {Object} options
     */
    async function unitStats(allycodes, cooldown = {}, options = {}) {
        // Make sure the allycode(s) are in an array
        if (!allycodes) return false;
        const acArr = Array.isArray(allycodes) ? allycodes : [allycodes];

        const specialAbilities = await getSpecialAbilities();

        let playerStats = [];
        try {
            if (!acArr?.length) {
                throw new Error("No valid ally code(s) entered");
            }
            const filtereredAcArr = acArr.filter((a) => a.toString().length === 9).map((a) => Number.parseInt(a, 10));

            let players;
            if (!options.force) {
                // If it's going to pull everyone fresh anyways, why bother grabbing the old data?
                if (options?.defId?.length) {
                    players = await cache.get(
                        config.mongodb.swapidb,
                        "playerStats",
                        { allyCode: { $in: filtereredAcArr } },
                        { _id: 0, name: 1, allyCode: 1, roster: { $elemMatch: { defId: options.defId } }, updated: 1 },
                    );
                } else {
                    players = await cache.get(config.mongodb.swapidb, "playerStats", { allyCode: { $in: filtereredAcArr } });
                }
            }

            // If options.force is true, set the list of unexpired players to be empty so that all players will be run through the updater
            const updatedList = options.force ? [] : players.filter((p) => !isExpired(p.updated, cooldown, players.length > 5));
            const updatedAC = updatedList.map((p) => Number.parseInt(p.allyCode, 10));
            const needUpdating = acArr.filter((a) => !updatedAC.includes(a));

            playerStats = playerStats.concat(updatedList);

            if (needUpdating.length) {
                let updatedBare = [];
                try {
                    await eachLimit(needUpdating, MAX_CONCURRENT, async (ac) => {
                        const tempBare = await comlinkStub.getPlayer(ac?.toString()).catch(() => {});
                        if (tempBare) {
                            const formattedComlinkPlayer = await formatComlinkPlayer(tempBare);
                            updatedBare.push(formattedComlinkPlayer);
                        }
                    });

                    // Check if any players are missing rosters, and re-run them through to try and get full player objects
                    const missingRosters = updatedBare.filter((p) => !p?.roster?.length);
                    if (missingRosters.length) {
                        updatedBare = updatedBare.filter((p) => p?.roster?.length);
                        for (const missing of missingRosters) {
                            const tempBare = await comlinkStub.getPlayer(missing?.allyCode?.toString()).catch(() => {});
                            if (tempBare) {
                                const formattedComlinkPlayer = await formatComlinkPlayer(tempBare);
                                updatedBare.push(formattedComlinkPlayer);
                            }
                        }
                    }
                } catch (_) {
                    // Couldn't get the data from the api, so send old stuff
                    return players;
                }

                const bulkWrites = [];
                for (const bareP of updatedBare) {
                    if (bareP?.roster?.length) {
                        try {
                            const statRoster = await fetch(`${config.fakeSwapiConfig.statCalc.url}/api?flags=gameStyle,calcGP`, {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify(bareP.roster),
                            });

                            if (!statRoster.ok) {
                                continue;
                            }

                            const statRosterRes = await statRoster.json();
                            bareP.roster = statRosterRes;
                        } catch (_) {
                            continue;
                        }

                        for (const char of bareP.roster) {
                            for (const ability of char.skills) {
                                const thisAbility = specialAbilities.find((abi) => abi.skillId === ability.id);
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

                        if (!bareP.updated) bareP.updated = Date.now();
                        if (!bareP.updated) bareP.updatedAt = new Date();
                        bulkWrites.push({
                            updateOne: {
                                filter: { allyCode: bareP.allyCode },
                                update: { $set: bareP },
                                upsert: true,
                            },
                        });
                        if (options?.defId?.length) {
                            // bareP.roster = bareP.roster.filter((ch) => ch.defId === options.defId);
                            playerStats.push({
                                ...bareP,
                                roster: bareP.roster.filter((ch) => ch.defId === options.defId),
                            });
                        } else {
                            playerStats.push(bareP);
                        }
                    }
                }
                if (bulkWrites.length) {
                    await cache.putMany(config.mongodb.swapidb, "playerStats", bulkWrites);
                }
            }
            return playerStats;
        } catch (error) {
            console.error(`SWAPI Broke getting playerStats: ${error}`);
            throw error;
        }
    }

    function getUnitDefId(unitDefId) {
        if (typeof unitDefId !== "string") return unitDefId;
        return unitDefId.split(":")[0];
    }

    async function formatComlinkPlayer(comlinkPlayer) {
        const comlinkPlayerArena = {};
        const emptyArena = { rank: null, squad: null };

        for (const { tab, rank, squad } of comlinkPlayer.pvpProfile) {
            comlinkPlayerArena[tab] = {
                rank: rank,
                squad:
                    squad?.cell?.map((unit) => {
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
            allyCode: Number.parseInt(comlinkPlayer.allyCode, 10),
            guildId: comlinkPlayer.guildId,
            guildName: comlinkPlayer.guildName,
            id: comlinkPlayer.playerId,
            name: comlinkPlayer.name,
            level: comlinkPlayer.level,
            roster: comlinkPlayer.rosterUnit
                .map((unit) => {
                    const thisDefId = unit.definitionId.split(":")[0];
                    const thisUnit = unitMap[thisDefId];
                    if (!thisUnit?.nameKey) return;
                    return {
                        id: unit.id,
                        defId: thisDefId,
                        nameKey: thisUnit?.nameKey,
                        level: unit.currentLevel,
                        rarity: unit.currentRarity,
                        gear: unit.currentTier,
                        equipped: unit.equipment ? unit.equipment : [],
                        skills: unit.skill
                            .map((sk) => {
                                const thisSkill = skillMap[sk.id];
                                if (!thisSkill) return null;
                                return {
                                    id: sk.id,
                                    tier: sk.tier + 2,
                                    tiers: thisSkill?.tiers ? thisSkill.tiers + 1 : null,
                                };
                            })
                            .filter((sk) => !!sk),
                        relic: unit.relic,
                        purchasedAbilityId: unit.purchasedAbilityId,
                        crew: thisUnit.crew,
                        combatType: thisUnit.combatType,
                        mods: unit.equippedStatMod ? unit.equippedStatMod.map((mod) => formatMod(mod)) : [],
                    };
                })
                .filter((unit) => !!unit),
            stats:
                comlinkPlayer.profileStat
                    ?.filter(({ nameKey }) => {
                        return nameKey?.includes("GALACTIC_POWER");
                    })
                    .map(({ nameKey, value }) => {
                        return {
                            nameKey,
                            value: Number(value),
                        };
                    }) || [],
            arena: {
                char: comlinkPlayerArena[1] || emptyArena,
                ship: comlinkPlayerArena[2] || emptyArena,
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
            slot: modSchema.slot - 1, // mod slots are numbered 2-7
            set: Number(modSchema.set),
            pips: modSchema.pips,
            primaryStat: {
                unitStat: primaryStat.stat.unitStatId,
                value: primaryStat.stat.unscaledDecimalValue / primaryStatScaler,
            },
            secondaryStat: secondaryStat
                ? secondaryStat.map((stat) => {
                      const statId = stat.stat.unitStatId;
                      const statScaler = flatStats.includes(statId) ? 1e8 : 1e6;
                      return {
                          unitStat: stat.stat.unitStatId,
                          value: stat.stat.unscaledDecimalValue / statScaler,
                          roll: stat.statRolls,
                      };
                  })
                : [],
        };
    }

    async function langChar(char, lang) {
        const thisLang = lang ? lang.toLowerCase() : "eng_us";
        if (!char) throw new Error("Missing Character");

        if (char.defId) {
            const unit = await units(char.defId);
            char.nameKey = unit ? unit.nameKey : null;
        }

        if (char.mods) {
            for (const mod of char.mods) {
                // If they've got the numbers instead of enums, enum em
                if (mod.primaryStat.unitStatId) mod.primaryStat.unitStat = mod.primaryStat.unitStatId;
                if (!Number.isNaN(mod.primaryStat.unitStat)) {
                    mod.primaryStat.unitStat = statEnums.enums[mod.primaryStat.unitStat];
                }
                for (const stat of mod.secondaryStat) {
                    if (stat.unitStatId) stat.unitStat = stat.unitStatId;
                    if (!Number.isNaN(stat.unitStat)) {
                        stat.unitStat = statEnums.enums[stat.unitStat];
                    }
                }
            }
        }

        if (char.factions) {
            for (const factionIx in char.factions) {
                const thisFaction = char.factions[factionIx];
                let factionName = await cache.get(
                    config.mongodb.swapidb,
                    "categories",
                    { id: thisFaction, language: thisLang },
                    { nameKey: 1, _id: 0 },
                );
                if (Array.isArray(factionName)) factionName = factionName[0];
                if (!factionName) throw new Error(`Cannot find factionName for ${thisFaction}`);
                char.factions[factionIx] = factionName.nameKey;
            }
        }

        // In case it has skillReferenceList
        if (char.skillReferenceList) {
            for (const skill in char.skillReferenceList) {
                let skillName = await cache.get(
                    config.mongodb.swapidb,
                    "abilities",
                    { skillId: char.skillReferenceList[skill].skillId, language: thisLang },
                    { nameKey: 1, _id: 0 },
                );
                if (Array.isArray(skillName)) skillName = skillName[0];
                if (!skillName) {
                    console.error(`[swapi langChar] Cannot find skillName for ${char.skillReferenceList[skill].skillId}`);
                    char.skillReferenceList[skill].nameKey = "N/A";
                    continue;
                }
                char.skillReferenceList[skill].nameKey = skillName.nameKey;
            }
        }

        // In case it doesn't
        if (char.skills) {
            for (const skill in char.skills) {
                let skillName = await cache.get(
                    config.mongodb.swapidb,
                    "abilities",
                    { skillId: char.skills[skill].id, language: thisLang },
                    { nameKey: 1, _id: 0 },
                );
                if (Array.isArray(skillName)) skillName = skillName[0];
                if (!skillName) {
                    console.error(`[swapi langChar] Cannot find skillName for ${char.skills[skill].id}`);
                    char.skills[skill].nameKey = "N/A";
                    continue;
                }
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
    async function guildUnitStats(allyCodes, defId, cooldown) {
        if (!cooldown?.guild || cooldown.guild > guildMaxCooldown) cooldown.guild = guildMaxCooldown;
        if (cooldown.guild < guildMinCooldown) cooldown.guild = guildMinCooldown;

        const outStats = [];
        const blankUnit = {
            defId: defId,
            gear: 0,
            gp: 0,
            level: 0,
            rarity: 0,
            skills: [],
            zetas: [],
            omicrons: [],
            relic: { currentTier: 0 },
            equipped: [],
            stats: {},
        };
        const players = await unitStats(allyCodes, cooldown, { defId: defId });
        if (!players.length) throw new Error("Couldn't get your stats");

        for (const player of players) {
            let unit;

            if (player?.roster?.length) {
                unit = player.roster.find((c) => c.defId === defId);
            }
            if (!unit) {
                unit = JSON.parse(JSON.stringify(blankUnit));
            }
            unit.zetas = unit.skills.filter((s) => s.isZeta && s.tier >= s.zetaTier);
            unit.omicrons = unit.skills.filter((s) => s.isOmicron && s.tier >= s.omicronTier);
            unit.player = player.name;
            unit.allyCode = player.allyCode;
            unit.updated = player.updated;
            outStats.push(unit);
        }
        return outStats;
    }

    async function abilities(skillArray, lang = "eng_us", opts = {}) {
        if (!skillArray) {
            throw new Error("You need to have a list of abilities here");
        }
        const skillArr = Array.isArray(skillArray) ? skillArray : [skillArray];

        // All the skills should be loaded, so just get em from the cache
        if (opts.min) {
            return await cache.get(
                config.mongodb.swapidb,
                "abilities",
                { skillId: { $in: skillArr }, language: lang.toLowerCase() },
                { nameKey: 1, _id: 0 },
            );
        }
        return await cache.get(
            config.mongodb.swapidb,
            "abilities",
            { skillId: { $in: skillArr }, language: lang.toLowerCase() },
            { _id: 0, updated: 0 },
        );
    }

    // Grab all of a character's info in the given language (Name, Abilities, Equipment)
    async function getCharacter(defId, lang) {
        const thisLang = lang ? lang.toLowerCase() : "eng_us";
        if (!defId) throw new Error("[getCharacter] Missing character ID.");

        const char = await character(defId);

        if (!char) throw new Error("[SWGoH-API getCharacter] Missing Character");
        if (!char.skillReferenceList) throw new Error("[SWGoH-API getCharacter] Missing character abilities");

        for (const s of char.skillReferenceList) {
            let skill = await abilities([s.skillId], thisLang);
            if (Array.isArray(skill)) skill = skill[0];

            if (!skill) {
                console.log(s);
                console.error("[swapi getCharacter] Missing ability - ");
                console.error(s);
                throw new Error(`Missing character ability ${s.skillId}`);
            }
            s.isZeta = skill.isZeta;
            s.isOmicron = skill.isOmicron;
            s.name = skill.nameKey.replace(/\\n/g, " ").replace(/(\[\/*c*-*\]|\[[\w\d]{6}\])/g, "");
            s.cooldown = skill.cooldown;
            s.desc = skill.descKey.replace(/\\n/g, " ").replace(/(\[\/*c*-*\]|\[[\w\d]{6}\])/g, "");
            const abTierCount = skill.abilityTiers?.length;
            if (abTierCount && skill.abilityTiers[abTierCount - 1].includes(skill.abilityTiers[abTierCount - 2])) {
                s.zetaDesc = skill.abilityTiers[abTierCount - 1].replace(skill.abilityTiers[abTierCount - 2], "").trim();
            }
            if (skill.tierList.length) {
                s.cost = {};
                for (const tier of skill.tierList) {
                    if (abilityCosts[tier]) {
                        for (const key of Object.keys(abilityCosts[tier])) {
                            s.cost[key] = s.cost[key] ? s.cost[key] + abilityCosts[tier][key] : abilityCosts[tier][key];
                        }
                    }
                }
            }
        }

        for (const tier of char.unitTierList) {
            const eqList = await gear(tier.equipmentSetList, thisLang);
            for (const [ix, e] of tier.equipmentSetList.entries()) {
                const eq = eqList.find((equipment) => equipment.id === e);
                if (!eq) {
                    console.error(`Missing equipment for char ${char.name}, make sure to update the gear lang stuff${inspect(e)}`);
                    continue;
                }
                tier.equipmentSetList.splice(ix, 1, eq.nameKey);
            }
        }

        return char;
    }

    // Function for updating all the stored character data from the game
    async function character(defId) {
        const outChar = await cache.get(config.mongodb.swapidb, "characters", { baseId: defId }, { _id: 0, updated: 0 });
        return outChar?.[0] || outChar;
    }

    // Get the gear for a given character
    async function gear(gearArray, lang) {
        const thisLang = lang?.toLowerCase() || "eng_us";
        if (!gearArray) {
            throw new Error("You need to have a list of gear here");
        }
        const gearArr = Array.isArray(gearArray) ? gearArray : [gearArray];

        // All the skills should be loaded, so just get em from the cache
        return await cache.get(
            config.mongodb.swapidb,
            "gear",
            { id: { $in: gearArr }, language: thisLang.toLowerCase() },
            { _id: 0, updated: 0 },
        );
    }

    // Used by farm, randomchar, and reloaddata
    async function units(defId, lang) {
        const thisLang = lang?.toLowerCase() || "eng_us";
        if (!defId) throw new Error("You need to specify a defId");

        // All the skills should be loaded, so just get em from the cache
        const uOut = await cache.get(
            config.mongodb.swapidb,
            "units",
            { baseId: defId, language: thisLang.toLowerCase() },
            { _id: 0, updated: 0 },
        );
        return uOut?.[0] || uOut;
    }

    // Get gear recipes
    async function recipes(recArray, lang) {
        const thisLang = lang?.toLowerCase() || "eng_us";
        if (!recArray) {
            throw new Error("You need to have a list of gear here");
        }
        const recArr = Array.isArray(recArray) ? recArray : [recArray];

        // All the skills should be loaded, so just get em from the cache
        return await cache.get(config.mongodb.swapidb, "recipes", { id: { $in: recArr }, language: thisLang }, { _id: 0, updated: 0 });
    }

    async function getRawGuild(allycode, cooldown = {}, { forceUpdate } = { forceUpdate: false }) {
        const tempGuild = {};
        const thisAc = allycode?.toString().replace(/[^\d]/g, "");
        if (!thisAc || Number.isNaN(thisAc) || thisAc.length !== 9) {
            throw new Error("Please provide a valid allycode");
        }

        const player = await comlinkStub.getPlayer(thisAc);
        if (!player) throw new Error("I cannot find a matching profile for this allycode, please make sure it's typed in correctly");

        if (!player.guildId) throw new Error("This player is not in a guild");

        let rawGuild = await cache.get(config.mongodb.swapidb, "rawGuilds", { id: player.guildId });
        if (forceUpdate || !rawGuild || !rawGuild[0] || isExpired(rawGuild[0].updated, cooldown, true)) {
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
                    tempGuild.roster = [];
                    for (const member of rawGuild.member) {
                        const tempMember = {};
                        const contribution = {};
                        for (const contType of member.memberContribution) {
                            contribution[contType.type] = {
                                currentValue: contType.currentValue,
                                lifetimeValue: contType.lifetimeValue,
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
            rawGuild = await cache.put(config.mongodb.swapidb, "rawGuilds", { id: player.guildId }, tempGuild);
        } else {
            /** If found and valid, serve from cache */
            rawGuild = rawGuild[0];
        }

        if (!rawGuild) throw new Error("Sorry, that player is not in a guild");

        // If it got this far, there's at least some sort of guild resposne there
        return rawGuild;
    }

    async function guild(allycode, cooldown) {
        let warnings;
        let thisAc = allycode?.toString().replace(/[^\d]/g, "");
        if (thisAc?.length !== 9 || Number.isNaN(thisAc)) throw new Error("Please provide a valid allycode");
        thisAc = Number.parseInt(thisAc, 10);

        /** Get player from cache */
        let player = await unitStats(thisAc);
        if (Array.isArray(player)) player = player[0];
        if (!player) {
            throw new Error("I don't know this player, make sure they're registered first");
        }
        if (!player.guildId) throw new Error("Sorry, that player is not in a guild");

        let guild = await cache.get(config.mongodb.swapidb, "guilds", { id: player.guildId });

        /** Check if existance and expiration */
        if (!guild || !guild[0] || isExpired(guild[0].updated, cooldown, true)) {
            /** If not found or expired, fetch new from API and save to cache */
            let tempGuild;
            try {
                tempGuild = await fetchGuild(player.guildId);
            } catch (err) {
                // Probably API timeout
                console.log(`[SWAPI-guild] Couldn't update guild for: ${player.name}`);
                throw new Error(err);
            }
            // console.log(`Updated ${player.name} from ${tempGuild[0] ? tempGuild[0].name + ", updated: " + tempGuild[0].updated : "????"}`);

            if (Array.isArray(tempGuild)) {
                tempGuild = tempGuild[0];
                if (tempGuild?._id) tempGuild._id = undefined; // Delete this since it's always whining about it being different
            }

            if (!tempGuild?.roster || !tempGuild.name) {
                if (guild[0]?.roster) {
                    return guild[0];
                }
                // console.log("Broke getting tempGuild: " + inspect(tempGuild.error));
                // throw new Error("Could not find your guild. The API is likely overflowing.");
            }

            if (tempGuild.roster?.length !== tempGuild.members) {
                console.error(`[swgohAPI-guild] Missing players, only getting ${tempGuild.roster?.length}/${tempGuild.members}`);
            }
            guild = await cache.put(config.mongodb.swapidb, "guilds", { id: tempGuild.id }, tempGuild);
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
        const { profile, guildEventTracker, nextChallengesRefresh, recentTerritoryWarResult, recentRaidResult, member, ...guildRest } =
            guild;
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
            for (const { identifier, guildRewardScore, raidId } of recentRaidResult) {
                raids[raidId] = {
                    diffId: identifier.campaignMissionId,
                    progress: guildRewardScore,
                };
            }
        }

        const members = [];
        await eachLimit(member, MAX_CONCURRENT, async ({ playerId, memberLevel, memberContribution, ...rest }) => {
            // Grab each player and process their info
            const { name, level, allyCode, profileStat } = await comlinkStub.getPlayer(null, playerId);

            let gp;
            let gpChar;
            let gpShip;
            for (const stat of profileStat) {
                if (stat.nameKey === "STAT_SHIP_GALACTIC_POWER_ACQUIRED_NAME") {
                    gpShip = Number(stat.value);
                } else if (stat.nameKey === "STAT_GALACTIC_POWER_ACQUIRED_NAME") {
                    gp = Number(stat.value);
                } else if (stat.nameKey === "STAT_CHARACTER_GALACTIC_POWER_ACQUIRED_NAME") {
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
                updated: Date.now(),
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
            updated: Date.now(),
            recentTerritoryWarResult,
            nextChallengesRefresh,
            guildEventTracker,
            raidLaunchConfig,
        };
    }

    async function guildByName(gName) {
        try {
            const guild = await cache.get(config.mongodb.swapidb, "guilds", { name: gName });

            if (!guild || !guild[0]) {
                return null;
            }
            return guild[0];
        } catch (e) {
            console.error(`SWAPI(guild) Broke getting guild: ${e}`);
            throw e;
        }
    }

    async function zetaRec(lang = "ENG_US") {
        const zetas = await cache.get(config.mongodb.swapidb, "zetaRec", { lang: lang });
        return zetas[0].zetas;
    }

    function isExpired(lastUpdated, cooldown, guild = false) {
        if (!lastUpdated) return true;
        let thisCooldown = guildMaxCooldown;

        if (guild) {
            // If it's for a guild, apply the guild cooldown
            thisCooldown = cooldown?.guild || guildMaxCooldown;
            if (thisCooldown > guildMaxCooldown) thisCooldown = guildMaxCooldown;
            if (thisCooldown < guildMinCooldown) thisCooldown = guildMinCooldown;
        } else {
            // Otherwise, apply the player cooldown
            thisCooldown = cooldown?.player || playerMaxCooldown;
            if (thisCooldown > playerMaxCooldown) thisCooldown = playerMaxCooldown;
            if (thisCooldown < playerMinCooldown) thisCooldown = playerMinCooldown;
        }

        const diff = convertMS(Date.now() - new Date(lastUpdated).getTime());
        return diff.totalMin >= thisCooldown;
    }
};

const convertMS = (milliseconds) => {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const totalMin = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const hour = Math.floor(totalMin / 60);
    const minute = totalMin % 60;
    return {
        hour: hour,
        minute: minute,
        totalMin: totalMin,
        seconds: seconds,
    };
};
