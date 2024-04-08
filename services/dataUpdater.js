const config = require(__dirname + "/../config.js");

// Grab the functions used for checking guilds' supporter arrays against Patreon supporters' info
const { clearSupporterInfo, ensureBonusServerSet, ensureGuildSupporter } = require("../modules/guildConfig/patreonSettings");

const fs = require("node:fs");
const { eachLimit } = require("async");

const MongoClient = require("mongodb").MongoClient;
let cache = null;

const FORCE_UPDATE = process.argv.includes("--force") || false;

const ComlinkStub = require("@swgoh-utils/comlink");
const comlinkStub = new ComlinkStub(config.fakeSwapiConfig.clientStub);

let metadataFile;

// TODO Use this for shop inventories
// const featureStoreList = JSON.parse(fs.readFileSync(dataDir + "swgoh-json-files/featureStoreList.json", "utf-8"))[0];

const CHAR_COMBAT_TYPE = 1;
const SHIP_COMBAT_TYPE = 2;

const dataDir = __dirname + "/../data/";
const gameDataDir = __dirname + "/../data/gameDataFiles/";

const campaignMapNames = JSON.parse(fs.readFileSync(dataDir + "swgoh-json-files/campaignMapNames.json", "utf-8"))[0];
const campaignMapNodes = JSON.parse(fs.readFileSync(dataDir + "swgoh-json-files/campaignMapNodes.json", "utf-8"))[0];

const CHAR_FILE      = dataDir + "characters.json";
const CHAR_LOCATIONS = dataDir + "charLocations.json";
const SHIP_FILE      = dataDir + "ships.json";
const SHIP_LOCATIONS = dataDir + "shipLocations.json";

const JOURNEY_FILE  = dataDir + "journeyReqs.json";

const RAID_NAMES_FILE     = dataDir + "raidNames.json";

const META_FILE      = dataDir + "metadata.json";
const META_KEYS = ["assetVersion", "latestGamedataVersion", "latestLocalizationBundleVersion"];

// The max players to grab at the same time
const MAX_CONCURRENT = 20;
let modMap = JSON.parse(fs.readFileSync(dataDir + "modMap.json"));
let unitMap = JSON.parse(fs.readFileSync(dataDir + "unitMap.json"));

// Use these to store data in to use when needing data from a different part of the gameData processing
const unitFactionMap = {};

console.log("Starting data updater");

// Run the updater when it's started, only if we're not running tests
if (!process.env.TESTING_ENV) {
    init().then(async () => {
        const isNew = await updateMetaData();
        if (!FORCE_UPDATE) {
            // Set it to update the patreon data and every 15 minutes if doable
            if (config.patreon) {
                setInterval(async () => {
                    await updatePatrons();
                }, 15 * 60 * 1000);
            }

            // Set it to check/ update the game data daily if needed
            // - Also run the mods updater daily
            (async function runUpdatersAsNeeded() {
                const isNew = await updateMetaData();
                if (isNew) {
                    console.log("Found new metadata, running updaters");
                    await runGameDataUpdaters();
                }
                await runModUpdaters();

                // Run it again each 24 hours
                setTimeout(runUpdatersAsNeeded, 24 * 60 * 60 * 1000);
            })();
        } else {
            // If we're forcing an update, just run the game data updaters
            await runGameDataUpdaters();
            process.exit(0);
        }
    });

    init();
}

async function init() {
    const mongo = await MongoClient.connect(config.mongodb.url);
    cache = require(__dirname + "/../modules/cache.js")(mongo);
}

// Update the metadata file if it exists, create it otherwise
async function updateMetaData() {
    debugLog("Checking metadata");
    const meta = await comlinkStub.getMetaData();
    let metaFile = {};
    if (fs.existsSync(META_FILE)) {
        metaFile = JSON.parse(fs.readFileSync(META_FILE, "utf-8"));
    }
    let isUpdated = false;
    const metaOut = {};
    for (const key of META_KEYS) {
        if (meta[key] !== metaFile[key]) {
            isUpdated = true;
            debugLog(`Updating metadata ${key} from ${metaFile[key]} to ${meta[key]}`);
        }
        metaOut[key] = meta[key];
    }

    if (isUpdated) {
        await saveFile(META_FILE, metaOut);
    }
    metadataFile = metaOut;

    return isUpdated;
}

async function runModUpdaters() {
    // Grab the guild IDs for the top x guilds
    const guildIds = await getGuildIds();

    // Grab the player IDs for each player in each of those guilds
    const playerIds = await getGuildPlayerIds(guildIds);

    // Grab the defId and needed mod info for each of those players' units
    const playerUnits = await getPlayerRosters(playerIds);

    // Get list which sets of mods each character has
    // Also record the primary stats each of them has per slot
    const unitsOut = await processUnitMods(playerUnits);

    // Go through each character and find the most common versions of
    // set and primaries, and convert them to be readable
    const modsOut = await processModResults(unitsOut);

    // Process each batch of mods and put them into the characters
    await mergeModsToCharacters(modsOut);
}

async function runGameDataUpdaters() {
    debugLog("Running gameData updater");
    const time = new Date().toString().split(" ").slice(1, 5);
    const log = [];

    // Load the files of char/ship locations
    const currentCharLocs     = JSON.parse(fs.readFileSync(CHAR_LOCATIONS));
    const currentShipLocs     = JSON.parse(fs.readFileSync(SHIP_LOCATIONS));

    // TODO Change updateGameData to return a log array so it can all be logged nicely with the locations?
    await updateGameData();     // Run the stuff to grab all new game data, and update listings in the db
    debugLog("Finished processing gameData chunks");

    // Run unit locations updaters
    const newCharLocs = await updateLocs(CHAR_FILE, CHAR_LOCATIONS);
    if (newCharLocs && JSON.stringify(newCharLocs) !== JSON.stringify(currentCharLocs)) {
        log.push("Detected a change in character locations.");
        await saveFile(CHAR_LOCATIONS, newCharLocs);
    }
    const newShipLocs = await updateLocs(SHIP_FILE, SHIP_LOCATIONS);
    if (newShipLocs && JSON.stringify(newShipLocs) !== JSON.stringify(currentShipLocs)) {
        log.push("Detected a change in ship locations.");
        await saveFile(SHIP_LOCATIONS, newShipLocs);
    }


    if (log?.length) {
        console.log(`Ran updater - ${time[0]} ${time[1]}, ${time[2]} - ${time[3]}`);
        console.log(log.join("\n"));
    } else {
        // console.log(`Ran updater - ${time[0]} ${time[1]}, ${time[2]} - ${time[3]}  ##  Nothing updated`);
    }
    debugLog("Finished running gameData updaters");
}

async function saveFile(filePath, jsonData, doPretty=true) {
    try {
        const content = doPretty ? JSON.stringify(jsonData, null, 4) : JSON.stringify(jsonData);
        await fs.promises.writeFile(filePath, content);
    } catch (error) {
        console.log(`[dataUpdater/saveFile] ERROR while saving file ${filePath}: ${error.message}`);
    }
}


const setLang = { 1: "Health", 2: "Offense", 3: "Defense", 4: "Speed", 5: "Crit. Chance", 6: "Crit. Damage", 7: "Potency", 8: "Tenacity" };
const statLang = { "0": "None", "1": "Health", "2": "Strength", "3": "Agility", "4": "Tactics", "5": "Speed", "6": "Physical Damage", "7": "Special Damage", "8": "Armor", "9": "Resistance", "10": "Armor Penetration", "11": "Resistance Penetration", "12": "Dodge Chance", "13": "Deflection Chance", "14": "Physical Critical Chance", "15": "Special Critical Chance", "16": "Crit. Damage", "17": "Potency", "18": "Tenacity", "19": "Dodge", "20": "Deflection", "21": "Physical Critical Chance", "22": "Special Critical Chance", "23": "Armor", "24": "Resistance", "25": "Armor Penetration", "26": "Resistance Penetration", "27": "Health Steal", "28": "Protection", "29": "Protection Ignore", "30": "Health Regeneration", "31": "Physical Damage", "32": "Special Damage", "33": "Physical Accuracy", "34": "Special Accuracy", "35": "Physical Critical Avoidance", "36": "Special Critical Avoidance", "37": "Physical Accuracy", "38": "Special Accuracy", "39": "Physical Critical Avoidance", "40": "Special Critical Avoidance", "41": "Offense", "42": "Defense", "43": "Defense Penetration", "44": "Evasion", "45": "Crit. Chance", "46": "Accuracy", "47": "Critical Avoidance", "48": "Offense", "49": "Defense", "50": "Defense Penetration", "51": "Evasion", "52": "Accuracy", "53": "Crit. Chance", "54": "Critical Avoidance", "55": "Health", "56": "Protection", "57": "Speed", "58": "Counter Attack", "59": "UnitStat_Taunt", "61": "Mastery" };
const slotNames = ["square", "arrow", "diamond", "triangle", "circle", "cross"];

async function getGuildIds() {
    debugLog("Getting guildIds");
    const guildLeaderboardRes = await comlinkStub._postRequestPromiseAPI("/getGuildLeaderboard", {
        "payload" : {
            "leaderboardId":[ { "leaderboardType": 3, "monthOffset": 0 } ],
            "count": 100
        },
        "enums": false
    });
    return guildLeaderboardRes.leaderboard[0].guild.map(guild => guild.id);
}

async function getGuildPlayerIds(guildIds) {
    debugLog("Getting guildPlayerIds");
    const playerIdArr = [];

    // Get all the players' IDs from each guild
    await eachLimit(guildIds, MAX_CONCURRENT, async function(guildId) {
        const {guild} = await comlinkStub.getGuild(guildId);
        const playerIds = guild.member.map(player => player.playerId);
        playerIdArr.push(...playerIds);
    });

    return playerIdArr;
}

// Stick all of the characters from each player's rosters into an array ot be processed later
async function getPlayerRosters(playerIds) {
    debugLog("Getting player rosters");
    const rosterArr = [];

    await eachLimit(playerIds, MAX_CONCURRENT, async function(playerId) {
        const {rosterUnit} = await comlinkStub.getPlayer(null, playerId);
        const strippedUnits = rosterUnit
            .filter(unit => unit?.equippedStatMod && unitMap[unit.definitionId.split(":")[0]]?.combatType === 1)
            .map(unit => {
                return {
                    defId: unit.definitionId.split(":")[0],
                    mods: unit.equippedStatMod.map(mod => formatMod(mod))
                };
            });
        rosterArr.push(...strippedUnits);
    });

    return rosterArr;
}

// Just spit back the bits that we'll actually need for this (Set, slot, and primart stat)
function formatMod({ definitionId, primaryStat }) {
    const modSchema = modMap[definitionId] || {};
    return {
        slot: modSchema.slot-1, // mod slots are numbered 2-7
        set: Number(modSchema.set),
        primaryStat: primaryStat?.stat.unitStatId
    };
}

async function processUnitMods(unitsIn) {
    // These will be formatted as {defId: []}, with the arrays being full of each combo found
    const unitsOut = {};

    for (const unit of unitsIn) {
        if (!unit.mods?.length) continue;
        if (!unitsOut[unit.defId]) {
            unitsOut[unit.defId] = {
                primaries: {},
                sets: {}
            };
        }

        // log the unit's primaries as 1_48,2_45,...
        const primaryStr = unit.mods.map((m, ix) => `${ix+1}-${m.primaryStat}`).join("_");
        if (!primaryStr?.length) continue;
        incrementInObj(unitsOut[unit.defId].primaries, primaryStr);


        const unitSets = {};
        for (const mod of unit.mods) {
            incrementInObj(unitSets, mod.set);
        }
        // Log the unit's sets as `COUNTxSTAT`
        const setStr = Object.keys(unitSets).map(k => `${unitSets[k]}x${k}`).join("_");
        if (!setStr?.length) continue;
        incrementInObj(unitsOut[unit.defId].sets, setStr);
    }

    return unitsOut;
}

function incrementInObj(obj, key) {
    obj[key] = obj[key] ? obj[key] += 1 : 1;
    return obj;
}

const multiSets = {
    "Crit. Chance x4": ["Crit. Chance x2", "Crit. Chance x2"],
    "Crit. Chance x6": ["Crit. Chance x2", "Crit. Chance x2", "Crit. Chance x2"],
    "Defense x4": ["Defense x2", "Defense x2"],
    "Defense x6": ["Defense x2", "Defense x2", "Defense x2"],
    "Health x4": ["Health x2", "Health x2"],
    "Health x6": ["Health x2", "Health x2", "Health x2"],
    "Potency x4": ["Potency x2", "Potency x2"],
    "Potency x6": ["Potency x2", "Potency x2", "Potency x2"],
    "Tenacity x4": ["Tenacity x2", "Tenacity x2"],
    "Tenacity x6": ["Tenacity x2", "Tenacity x2", "Tenacity x2"],
};

// For each character, get rid of all but the most common results (If more than one tie, return both)
function processModResults(unitsIn) {
    for (const unit of Object.keys(unitsIn)) {
        const thisUnit = unitsIn[unit];

        const maxPrimaryCount = Math.max(...Object.values(thisUnit.primaries));
        const maxSetCount = Math.max(...Object.values(thisUnit.sets));

        for (const [prim, count] of Object.entries(thisUnit.primaries)) {
            if (count !== maxPrimaryCount) delete thisUnit.primaries[prim];
        }
        const primaries = {};
        Object.keys(thisUnit.primaries)[0]
            .split("_")
            .map(slot => slot.split("-")[1])
            .forEach((stat, ix) => {
                primaries[slotNames[ix]] = statLang[stat];
            });

        thisUnit.mods = {
            sets: [],
            ...primaries
        };

        for (const [set, count] of Object.entries(thisUnit.sets)) {
            if (count !== maxSetCount) delete thisUnit.sets[set];
        }
        const totalSets = Object.keys(thisUnit.sets)[0]
            .split("_")
            .map(set => {
                const [count, stat] = set.split("x");
                return `${setLang[stat]} x${count}`;
            });

        totalSets.forEach(set => {
            if (multiSets[set]) {
                thisUnit.mods.sets.push(...multiSets[set]);
            } else {
                thisUnit.mods.sets.push(set);
            }
        });
        delete thisUnit.sets;
        delete thisUnit.primaries;
    }
    return unitsIn;
}

async function mergeModsToCharacters(modsIn) {
    const characters = await fs.promises.readFile(CHAR_FILE, "utf-8").then(JSON.parse);

    for (const defId of Object.keys(modsIn)) {
        const thisChar = characters.find(ch => ch.uniqueName === defId);
        if (!thisChar) continue;
        thisChar.mods = modsIn[defId].mods;
    }

    await saveFile(CHAR_FILE, characters);
}




async function updatePatrons() {
    const patreon = config.patreon;
    if (!patreon) return;

    try {
        // Run this to get the patreon ID from the auth token in the config file
        // https://docs.patreon.com/#fetch-a-creator-profile-and-campaign-info
        const campaignRes = await fetch("https://www.patreon.com/api/oauth2/api/current_user/campaigns", {
            headers: {
                Authorization: "Bearer " + patreon.creatorAccessToken
            }
        }).then(res => res.json());

        // If there's no valid data or ID in campaignRes, then there's nothing to work from. Move along
        const patId = campaignRes?.data?.[0]?.id;
        if (!patId) return;

        // Use the given patId to get all of the supporters
        // https://docs.patreon.com/#get-api-oauth2-v2-campaigns
        const {data, included} = await fetch(`https://www.patreon.com/api/oauth2/api/campaigns/${patId}/pledges?page%5Bcount%5D=100`, {
            headers: {
                Authorization: "Bearer " + patreon.creatorAccessToken
            }
        }).then(res => res.json());

        const pledges = data.filter(data => data.type === "pledge");
        const users = included.filter(inc => inc.type === "user");

        pledges.forEach(async (pledge) => {
            const user = users.find(user => user.id === pledge.relationships.patron.data.id);

            // Couldn't find a user to match with the pledge (Shouldn't happen, but just in case)
            if (!user) return console.log(`Patreon user ${user.attributes.full_name} vanished`);

            // Save this user's info to the db
            const newUser = await cache.put("swgohbot", "patrons", {id: pledge.relationships.patron.data.id}, {
                id:                 pledge.relationships.patron.data.id,
                full_name:          user.attributes.full_name,
                vanity:             user.attributes.vanity,
                email:              user.attributes.email,
                discordID:          user.attributes.social_connections.discord?.user_id || user.attributes.discord_id,
                amount_cents:       pledge.attributes.amount_cents,
                declined_since:     pledge.attributes.declined_since,
                pledge_cap_cents:   pledge.attributes.pledge_cap_cents,
            });

            // If they don't have a discord id to work with, move on
            if (!newUser.discordID) return console.log(`There's an issue getting the discord id from user (${newUser.full_name})`);

            if (newUser.declined_since || !newUser.amount_cents) {
                // If the user isn't currently active, make sure they don't have any bonusServers linked
                const userConf = await cache.getOne(config.mongodb.swgohbotdb, "users", {id: newUser.discordID});

                // If they don't have bonusServer set (As it should be), move on
                if (!userConf?.bonusServer?.length) return;

                // If it is set, remove it
                const {user: userRes, guild: guildRes} = await clearSupporterInfo({cache, userId: newUser.discordID});

                // No issues, move on
                if (!userRes?.error && !guildRes?.error) return console.log(`User ${newUser.discordID} has been ended their Patreon support`);

                // If it somehow got here / there are issues, log em
                console.error(`[dataUpdater clearSupporterInfo] Issue clearing info from user\n${userRes?.error || "N/A"} \nOr guild:\n${guildRes?.error || "N/A"}`);
            } else {
                // If the user exists, and they're active, make sure everything is set correctly
                // Make sure that if they have a bonus server set in their user settings, it's set properly in the given guild
                const {user: userRes, guild: guildRes} = await ensureBonusServerSet({cache, userId: newUser.discordID, amount_cents: newUser.amount_cents});

                // If there are no issues, move along
                if (!userRes?.error && !guildRes?.error) return;

                // If there are issues, log em
                console.error(`[dataUpdater addServerSupporter] Issue adding info for user\n${userRes?.error || "N/A"} \nOr guild:\n${guildRes?.error || "N/A"}`);
            }
        });

        // Go through each of the guilds that have a supporter and make sure all of the lsited users are supposed to be there
        await ensureGuildSupporter({cache});
    } catch (e) {
        console.log("[UpdatePatrons] Error getting patrons");
    }
}

async function updateLocs(unitListFile, currentLocFile, locales) {
    debugLog("Updating unit locations");
    const [currentUnits, currentLocs] = await Promise.all([
        fs.promises.readFile(unitListFile, "utf-8").then(JSON.parse),
        fs.promises.readFile(currentLocFile, "utf-8").then(JSON.parse)
    ]);

    const shardNameMap = currentUnits.map(unit => `unitshard_${unit.uniqueName}`);
    const shardNameRes = await cache.get(config.mongodb.swapidb, "materials", {id: {$in: shardNameMap}});

    const matArr = [];
    for (const unit of currentUnits) {
        const res = shardNameRes.find(mat => mat?.id === `unitshard_${unit.uniqueName}`);
        if (res?.length) {
            matArr.push({
                defId: unit.uniqueName,
                mats: res[0]
            });
        }
    }

    if (!matArr.length) return;

    const langList = Object.keys(locales);
    const targets = {
        HARD_DARK:  ["FeatureTitle_DarkCampaigns", "DIFF_HARD"],
        HARD_FLEET: ["FeatureTitle_ShipPve", "DIFF_HARD"],
        HARD_LIGHT: ["FeatureTitle_LightCampaigns", "DIFF_HARD"],
        CANTINA:    ["FeatureTitle_DatacronBattles"],
    };
    const bulkLocPut = [];
    for (const lang of langList) {
        for (const target of Object.keys(targets)) {
            const langKey = targets[target].map(t => locales[lang][t] || `ERROR: ${t}`).join(" ");
            bulkLocPut.push({
                updateOne: {
                    filter: { id: target, language: lang },
                    update: {
                        $set: { id: target, language: lang, langKey }
                    },
                    upsert: true
                }
            });
        }
    }
    await cache.putMany(config.mongodb.swapidb, "locations", bulkLocPut);

    const outArr = [];
    for (const mat of matArr) {
        const missions = mat?.mats?.lookupMissionList;
        if (!missions?.length) continue;

        const charArr = [];
        const usedLocId = new Set();
        for (const node of missions) {
            let locId = null;
            let charObj = {};

            if (node.campaignId === "EVENTS") {
                if (node.campaignMapId === "MARQUEE") {
                    // Run through stuff for Marquee events
                    locId = `EVENT_MARQUEE_${node.campaignNodeId.split("_")[0]}_NAME`;
                    charObj = {type: "Marquee", locId};
                } else if (node.campaignMapId === "PROGRESSION") {
                    // Process the two progression events (GMY / EP)
                    locId = `PROGRESSIONEVENT_${node.campaignNodeId}_NAME`;
                    charObj = {type: "Legendary Event", locId};
                } else if (node.campaignMapId === "SCHEDULED" && node.campaignNodeId === "CONQUEST_UNIT_TRIALS") {
                    // Process the Proving Grounds events
                    // - Really just localize "Proving Grounds" since the rest is just the unit's name
                    locId = "EVENT_CONQUEST_UNIT_TRIALS_NAME";
                    charObj = {type: "Proving Grounds", locId};
                } else if (node.campaignMapId === "GALACTIC") {
                    // Process galactic legends events
                    //  - Still not sure how to manage LORDVADER in place of VADER
                    const commonStr = node.campaignNodeId.replace("CAMPAIGN_", "");  // Replace junk
                    const possibleKeys = [
                        `NODE_CAMPAIGN_${commonStr}_NAME`,
                        `${commonStr}_NAME`,
                        `EVENT_${mat.defId}_GALACTICLEGEND_NAME_V2`,
                        `EVENT_${mat.defId}_GALACTICLEGEND_NAME`,
                    ];

                    for (const possible of possibleKeys) {
                        if (locales.eng_us[possible]) {
                            locId = possible;
                            break;
                        }
                    }

                    charObj = {type: "Galactic Legend", locId};
                }


                if (!locId || usedLocId.has(locId)) continue;
                usedLocId.add(locId);

                // Go through and save all the locale strings into the db
                let isAvailable = true;
                for (const lang of langList) {
                    const langKey = locales[lang][locId];
                    if (!langKey) {
                        isAvailable = false;
                        break;
                    }
                    if (lang === "eng_us") charObj.name = toProperCase(langKey);
                    const out = {
                        id: locId,
                        language: lang,
                        langKey
                    };
                    await cache.put(config.mongodb.swapidb, "locations", {id: locId, language: lang}, out);
                }
                // If locale strings were available, go ahead and stick the info in
                if (isAvailable) charArr.push(charObj);
            } else {
                // Run stuff through for hard nodes
                const outMode = campaignMapNames[node.campaignId]?.game_mode;
                if (!outMode) continue;

                const outNode = campaignMapNodes?.[node.campaignId]?.[node.campaignMapId]?.[node.campaignNodeDifficulty]?.[node.campaignNodeId]?.[node.campaignMissionId];

                // ONLY /farm and /need use these
                const modeMap = {
                    "Light Side Battles": { suffix: " (L)", locId: "HARD_LIGHT" },
                    "Dark Side Battles": { suffix: " (D)", locId: "HARD_DARK" },
                    "Cantina Battles": { suffix: "", locId: "CANTINA" },
                    "Fleet Battles": { suffix: " (Fleet)", locId: "HARD_FLEET" },
                    "default": { suffix: "N/A", locId: null }
                };
                const { suffix, locId } = modeMap[outMode] || modeMap["default"];

                let type = outMode === "Cantina Battles" ? "Cantina" : "Hard Modes";
                if (suffix.length) type += suffix;

                charArr.push({
                    type,
                    level: outNode,
                    locId
                });
            }
        }
        outArr.push({defId: mat.defId, locations: charArr});
    }

    // Wipe out all previous locations so we can replace them later, but leave the shop info alone
    const whitelistTypeLocs = [ "Achievements", "Assault Battle", "Epic Confrontation", "Challenges", "Hero's Journey", "Heroic Event", "Legacy Event", "Legendary Event", "Raids", "Special Event", "Territory Battle" ];
    const finalOut = [];
    const locationMap = {};

    // Filter locations and build a hash map for quick lookup
    for (const loc of currentLocs) {
        const filteredLocations = loc.locations.filter(thisLoc => thisLoc?.cost?.length || whitelistTypeLocs.includes(thisLoc?.type) && !thisLoc.locId);
        if (filteredLocations.length) {
            locationMap[loc.defId] = filteredLocations;
        }
    }

    // Merge location data and construct final output
    for (const unit of currentUnits) {
        const thisUnitLoc = locationMap[unit.uniqueName] || [];
        const unitLoc = outArr.find(loc => loc.defId === unit.uniqueName) || { defId: unit.uniqueName };

        const locations = [...thisUnitLoc.locations, ...unitLoc.locations];
        const unitName = thisUnitLoc.name || unitLoc.name || unit.name;

        if (unitName || unitLoc.defId) {
            finalOut.push({
                name: unitName,
                defId: unitLoc.defId,
                locations: locations.sort((a, b) => a.type?.toLowerCase() > b.type?.toLowerCase() ? 1 : -1)
            });
        }
    }

    // Sort the final output array then return it
    return finalOut.sort((a,b) => {
        const nameA = a?.name?.toLowerCase() || "";
        const nameB = b?.name?.toLowerCase() || "";
        return nameA > nameB ? 1 : -1 || a.defId.toLowerCase() > b.defId.toLowerCase() ? 1 : -1;
    });
}

async function getMostRecentGameData(version) {
    let gameData = null;
    const dataFile = `gameData_${version}.json`;
    const filePath = gameDataDir + dataFile;

    // Check if the file exists
    if (fs.existsSync(filePath)) {
        debugLog("Found gameData for " + version);

        // Load up our local gameData file and send it back
        gameData = await fs.readFileSync(filePath);
        return JSON.parse(gameData);
    }

    // If we don't have the most recent version locally, grab a new copy of the gameData from CG
    gameData = await comlinkStub.getGameData(version, false);

    // This is going to be a new version, so we can just delete the old files
    fs.readdirSync(gameDataDir)
        .filter(fileName => fileName.startsWith("gameData_") && fileName !== dataFile)
        .forEach(f => fs.unlinkSync(gameDataDir + f));

    // Then save it
    await fs.writeFileSync(filePath, JSON.stringify(gameData));

    // Then return the gameData
    return gameData;
}

async function updateGameData() {
    try {
        if (!metadataFile.latestGamedataVersion) {
            throw new Error("[updateGameData] Missing latestGamedataVersion from metadata");
        }

        debugLog("Running main updaters");

        const gameData = await getMostRecentGameData(metadataFile.latestGamedataVersion);

        await processGameData(gameData, metadataFile);

        return "Update successful";
    } catch (error) {
        console.error("[updateGameData] Error:", error);
        throw error;
    }

}

async function processGameData(gameData, metadataFile) {
    try {
        const locales = await getLocalizationData(metadataFile.latestLocalizationBundleVersion);

        const {abilitiesOut, skillMap} = processAbilities(gameData.ability, gameData.skill);
        await saveFile(dataDir + "skillMap.json", skillMap, false);
        await processLocalization(abilitiesOut, "abilities", ["nameKey", "descKey", "abilityTiers"], "id", locales);
        debugLog("Finished processing Abilities");

        const catMapOut = await processCategories(gameData.category);
        // await saveFile(dataDir + "catMap.json", catMapOut, false);
        await processLocalization(catMapOut, "categories", ["descKey"], "id", locales);
        debugLog("Finished processing Categories");

        const mappedEquipmentList = await processEquipment(gameData.equipment);
        await processLocalization(mappedEquipmentList, "gear", ["nameKey"], "id", locales);
        debugLog("Finished processing Equipment");

        const { unitShardList, bulkMatArr } = processMaterials(gameData.material);
        await cache.putMany(config.mongodb.swapidb, "materials", bulkMatArr);
        debugLog("Finished processing Materials");

        const modsOut = processModData(gameData.statMod);
        modMap = modsOut;   // Set the global modMap for use later (Should get rid of this... TODO)
        await saveFile(dataDir + "modMap.json", modsOut, false);
        debugLog("Finished processing Mod data");

        const {unitRecipeList, mappedRecipeList} = processRecipes(gameData.recipe);
        await processLocalization(mappedRecipeList, "recipes", ["descKey"], "id", locales, ["eng_us"]);
        debugLog("Finished processing Recipes");

        const processedUnitList = processUnits(gameData.units);

        // Put all the baseId and english names together for later use with the crew
        const unitDefIdMap = {};
        for (const unit of processedUnitList) {
            unitDefIdMap[unit.baseId] = locales["eng_us"][unit.nameKey];
        }

        const bulkUnitArr = unitsToCharacterDB(JSON.parse(JSON.stringify(processedUnitList)));
        await cache.putMany(config.mongodb.swapidb, "characters", bulkUnitArr);
        await processLocalization(JSON.parse(JSON.stringify(processedUnitList)), "units", ["nameKey"], "baseId", locales);

        const unitsOut = unitsForUnitMapFile(JSON.parse(JSON.stringify(processedUnitList)));
        unitMap = unitsOut; // TODO This should be changed, but it's currently needed as a global for the mod updater
        await saveFile(dataDir + "unitMap.json", unitsOut, false);

        // Update & save the character/ship.json files (Not being tested, because it mashes so many bits together to make it work)
        const {charactersOut, shipsOut} = unitsToUnitFiles(JSON.parse(JSON.stringify(processedUnitList)), locales, catMapOut, unitDefIdMap, unitRecipeList, unitShardList);
        await saveFile(CHAR_FILE, sortByName(charactersOut)),
        await saveFile(SHIP_FILE, sortByName(shipsOut))
        debugLog("Finished processing Units");

        // await processJourneyReqs(gameData);
        debugLog("Finished processing Journey Reqs");

        const raidNamesOut = saveRaidNames(locales);
        await saveFile(RAID_NAMES_FILE, raidNamesOut);
        debugLog("Finished processing Raid Names");
    } catch (error) {
        console.error("[processGameData] Error:", error);
        throw error;
    }
}

/**
  * function
  * @param {Object[]} rawDataIn  - The array of objects to localize
  * @param {string}   dbTarget   - The mongo table to insert into
  * @param {string[]} targetKeys - An array of keys to localize
  * @param {string}   dbIdKey    - The key to use as the unique db key
  * @param {string[]} langList   - An array of localization languages
  */
async function processLocalization(rawDataIn, dbTarget, targetKeys, dbIdKey="id", locales, langList=null) {
    if (!langList) langList = Object.keys(locales);
    const bulkWriteArr = [];
    for (const lang of langList) {    // For each language that we need to localize for...
        const dataIn = structuredClone(rawDataIn);
        for (const data of dataIn) {    // For each chunk of the dataIn (ability, gear, recipes, unit, etc)
            data.language = lang;
            for (const target of targetKeys) {      // For each of the specified keys of each chunk
                const localizedData = Array.isArray(data[target]) ?
                    data[target].map(entry => locales[lang][entry] || entry) :
                    locales[lang][data[target]] || data[target];

                data[target] = localizedData;
            }
            bulkWriteArr.push({
                updateOne: {
                    filter: { [dbIdKey]: data[dbIdKey], language: lang }, // Filter by the given key, and language
                    update: { $set: data }, // Update with the localized data
                    upsert: true // Insert if document doesn't exist
                }
            });
        }
        // console.log(`Finished localizing ${dbTarget} for ${lang}`);
    }
    await cache.putMany(config.mongodb.swapidb, dbTarget, bulkWriteArr);
    // console.log(`Finished localizing ${dbTarget}`);
}

function saveRaidNames(locales) {
    const langList = Object.keys(locales);

    // The keys that match in the lang files, and the keys that the guild raids give
    const raidKeys = {
        RAID_AAT_NAME: "aat",
        RAID_RANCOR_NAME: "rancor",
        RAID_RANCOR_CHALLENGE_NAME: "rancor_challenge",
        RAID_TRIUMVIRATE_NAME: "sith_raid",
        MISSION_GUILDRAIDS_KRAYTDRAGON_NAME: "kraytdragon",
        MISSION_GUILDRAIDSLEGACY_HEROIC_NAME: "heroic",
        MISSION_GUILDRAIDS_SPEEDERBIKE_NAME: "speederbike"
    };
    const raidNamesOut = {};
    for (const lang of langList) {
        raidNamesOut[lang] = {};
        for (const [key, value] of Object.entries(raidKeys)) {
            raidNamesOut[lang][value] = locales[lang][key];
        }
    }
    return raidNamesOut;
}

function processAbilities(abilityIn, skillIn) {
    const abilitiesOut = [];
    const skillMap = {};

    for (const ability of abilityIn) {
        const skill = skillIn.find(sk => sk.abilityReference === ability.id);
        if (!skill) continue;

        const abTiers = ability.tier?.map(ti => ti.descKey) || [];
        abilitiesOut.push({
            id: ability.id,
            type: ability.type,
            nameKey: ability.nameKey,
            descKey: abTiers.slice(-1)[0] || ability.descKey,
            cooldown: ability.cooldown,
            abilityTiers: abTiers,
            skillId: skill.id,
            tierList: skill.tier.map(t => t.recipeId),
            isOmicron: skill.tier.some(t => t.isOmicronTier),
            omicronTier: skill.tier.filter(t => t.isOmicronTier).length || null,
            isZeta: skill.isZeta || false,
            zetaTier: skill.isZeta ? (skill.tier.length - (skill.tier.some(t => t.isOmicronTier) ? 1 : 0)) : null
        });

        skillMap[skill.id] = {
            nameKey: ability.nameKey,
            isZeta: skill.isZeta,
            tiers: skill.tier.length,
            abilityId: skill.abilityReference
        };
    }
    return {abilitiesOut, skillMap};
}

function processCategories(catsIn) {
    const catMapOut = catsIn
        .filter(cat => cat.visible || cat.id.startsWith("alignment"))
        .map(({id, descKey}) => ({id, descKey}));

    return catMapOut;
}

function processEquipment(equipmentIn) {
    const mappedEquipmentList = equipmentIn.map(({ id, nameKey, recipeId, mark }) => ({ id, nameKey, recipeId, mark }));
    return mappedEquipmentList;
}

function processMaterials(materialIn) {
    const unitShardList = [];
    const bulkMatArr = [];

    for (const mat of materialIn) {
        if (!mat.id.startsWith("unitshard")) continue;
        unitShardList.push({
            id: mat.id,
            iconKey: mat.iconKey.replace(/^tex\./, "")
        });

        bulkMatArr.push({
            updateOne: {
                filter: { id: mat.id },
                update: {
                    $set: {
                        id: mat.id,
                        lookupMissionList: mat.lookupMission.map(mis => mis.missionIdentifier),
                        raidLookupList: mat.raidLookup.map(mis => mis.missionIdentifier),
                        iconKey: mat.iconKey
                    }
                },
                upsert: true
            }
        });
    }
    return { unitShardList, bulkMatArr };
}

function processModData(modsIn) {
    // gameData.statMod  ->  This is used to get slot, set, and pip of each mod
    const modsOut = {};
    modsIn.forEach(({ id, rarity, setId, slot })  => {
        modsOut[id] = {
            pips: rarity,
            set:  setId,
            slot: slot
        };
    });
    return modsOut;
}

function processRecipes(recipeIn, locales) {
    const mappedRecipeList = [];
    const unitRecipeList = [];

    for (const recipe of recipeIn) {
        const { id, descKey, ingredients } = recipe;
        const filteredIngredients = ingredients.filter(ing => ing.id !== "GRIND");

        // Add recipe to mappedRecipeList
        mappedRecipeList.push({
            id,
            descKey,
            ingredients: filteredIngredients
        });

        // Add unitshard information to unitRecipeList
        const unitShardList = filteredIngredients.filter(ing => ing.id?.startsWith("unitshard"));
        if (unitShardList.length) {
            unitRecipeList.push({
                id,
                unitShard: unitShardList[0].id
            });
        }
    }

    return {unitRecipeList, mappedRecipeList};
}


function processUnits(unitsIn) {
    const filteredList = unitsIn.filter(unit => {
        if (unit.rarity !== 7 || !unit.obtainable || (unit.obtainableTime !== 0 && unit.obtainableTime !== "0")) return false;
        return true;
    }).map(unit => {
        return {
            baseId: unit.baseId, // uniqueName
            nameKey: unit.nameKey, // name
            skillReferenceList: unit.skillReference,
            categoryIdList: unit.categoryId,
            combatType: unit.combatType,
            unitTierList: unit.unitTier?.map(tier => {
                return {
                    tier: tier.tier,
                    equipmentSetList: tier.equipmentSet
                };
            }),
            crewList: unit.crew,
            creationRecipeReference: unit.creationRecipeReference,
            legend: unit?.legend,   // True if GL?
        };
    });

    return filteredList;
}

function unitsToUnitFiles(filteredList, locales, catMap, unitDefIdMap, unitRecipeList, unitShardList) {
    const oldCharFile = JSON.parse(fs.readFileSync(CHAR_FILE, "utf-8"));
    const oldShipFile = JSON.parse(fs.readFileSync(SHIP_FILE, "utf-8"));
    const engStringMap = locales["eng_us"];

    const charactersOut = [];
    const shipsOut = [];

    for (const unit of filteredList) {
        const oldFile = unit.combatType === CHAR_COMBAT_TYPE ? oldCharFile : oldShipFile;
        const oldUnit = oldFile.find(u => u.uniqueName === unit.baseId);
        const charUIName = getCharUIName(unit.creationRecipeReference, unitRecipeList, unitShardList);
        const name = engStringMap?.[unit.nameKey] || unit.nameKey;

        let unitObj;
        if (oldUnit) {
            unitObj = oldUnit;
            delete unitObj.nameVariant;
            unitObj.avatarName = charUIName;
            unitObj.avatarURL = `https://game-assets.swgoh.gg/tex.${charUIName}.png`;
        } else {
            const unitFactionsObj = catMap.filter(cat => unit.categoryIdList.includes(cat.id));
            const { factions, side } = getSide(unitFactionsObj);
            unitObj = {
                name,
                uniqueName: unit.baseId,
                aliases: [name],
                avatarName: charUIName,
                avatarURL: `https://game-assets.swgoh.gg/tex.${charUIName}.png`,
                side,
                factions: factions.sort((a, b) => a.toLowerCase() > b.toLowerCase() ? 1 : -1),
                mods: unit.combatType === CHAR_COMBAT_TYPE ? {} : null,
                crew: unit.combatType === SHIP_COMBAT_TYPE && unit.crewList?.map(cr => unitDefIdMap[cr.unitId]) || []
            };
        }

        if (unit.combatType === CHAR_COMBAT_TYPE) {
            charactersOut.push(unitObj);
        } else if (unit.combatType === SHIP_COMBAT_TYPE) {
            shipsOut.push(unitObj);
        } else {
            console.error("Bad combatType for:", unitObj);
        }
    }

    return { charactersOut, shipsOut };
}

function getCharUIName(creationRecipeId, unitRecipeList, unitShardList) {
    const thisRecipe = unitRecipeList.find(rec => rec.id === creationRecipeId);
    const thisUnitShard = unitShardList.find(sh => sh.id === thisRecipe?.unitShard);
    return thisUnitShard?.iconKey;
}

function getSide(factions) {
    for (const side of ["dark", "light", "neutral"]) {
        const found = factions.find(fact => fact.id === `alignment_${side}`);
        if (found) {
            const filteredFactions = factions.filter(fact => fact !== found);
            return {
                side: side,
                factions: filteredFactions.map(fact => fact.descKey)
            };
        }
    }
}

function sortByName(list) {
    return list.sort((a, b) => a.name?.toLowerCase() > b.name?.toLowerCase() ? 1 : -1);
}

function unitsToCharacterDB(unitsIn) {
    const catList = new Set(["alignment", "profession", "affiliation", "role", "shipclass"]);
    const ignoreSet = new Set([
        "fomilitary",      "galactic",         "order66",       "sithlord",       "palp", "rebfalconcrew",
        "smuggled",        "foexecutionsquad", "gacs2fireteam", "jacket",         "el16", "ptisfalconcrew",
        "forcelightning",  "doubleblade",      "kenobi",        "translator",     "rey",  "veteransmuggler",
        "crimsondawn",     "sabacc",           "dathbro",       "prisfalconcrew", "kylo", "capital",
        "resistancexwing", "fotie",            "millennium"
    ]);
    const factionMap = {
        badbatch       : "bad batch",        bountyhunter   : "bounty hunter", capitalship    : "capital ship",
        cargoship      : "cargo ship",       clonetrooper   : "clone trooper", dark           : "dark side",
        firstorder     : "first order",      huttcartel     : "hutt cartel",   imperialremnant: "imerpial remnant",
        imperialtrooper: "imperial trooper", inquisitoriu   : "inquisitorius", light          : "light side",
        oldrepublic    : "old republic",     rebelfighter   : "rebel fighter", republic       : "galactic republic",
        rogue          : "rogue one",        sithempire     : "sith empire",
    };

    const bulkLocPut = [];

    // Process the units list to go into the characters db table
    for (const unit of unitsIn) {
        const factions = new Set();
        const crewIds = [];
        const skillReferences = unit.skillReferenceList || [];

        delete unit.nameKey;
        delete unit.creationRecipeReference;

        if (!unit.categoryIdList) {
            console.error("Missing baseCharacter abilities for " + unit.baseId);
            continue;
        }
        for (const category of unit.categoryIdList) {
            const [prefix, faction] = category.split("_");
            if (catList.has(prefix) && !ignoreSet.has(faction)) {
                factions.add(toProperCase(factionMap[faction] || faction));
            }
        }

        unit.factions = Array.from(factions);
        delete unit.categoryIdList;

        if (unit.crewList?.length) {
            for (const crewChar of unit.crewList) {
                crewIds.push(crewChar.unitId);
                skillReferences.push(...crewChar.skillReference);
            }
        }

        delete unit.crewList;
        unit.crew = crewIds;
        unit.skillReferenceList = skillReferences;
        unitFactionMap[unit.baseId] = unit.factions;

        bulkLocPut.push({
            updateOne: {
                filter: { baseId: unit.baseId },
                update: {
                    $set: unit
                },
                upsert: true
            }
        });
    }
    return bulkLocPut;
}

function unitsForUnitMapFile(unitsIn) {
    // gameData.units -> This is used to grab nameKey (Yes, we actually need it), crew data & combatType
    const unitsOut = unitsIn.reduce((acc, unit) => {
        acc[unit.baseId] = {
            nameKey: unit.nameKey,
            combatType: unit.combatType,
            crew: unit.crewList?.map(cr => ({
                skillReferenceList: cr.skillReference,
                unitId: cr.unitId,
                slot: cr.slot
            })) || []
        };
        return acc;
    }, {});

    return unitsOut;
}

async function getLocalizationData(bundleVersion) {
    const IGNORE_KEYS = ["datacron", "anniversary", "promo", "subscription", "marquee"];
    let localeData = null;
    const dataFile = `localizationBundle_${bundleVersion}.json`;
    const filePath = gameDataDir + dataFile;

    // Check if the file exists
    if (fs.existsSync(filePath)) {
        debugLog("Found localeData for " + bundleVersion);

        // Load up our local gameData file and send it back
        localeData = await fs.readFileSync(filePath);
        return JSON.parse(localeData);
    }

    try {
        // If we don't have the most recent version locally, grab a new copy of the gameData from CG
        localeData = await comlinkStub.getLocalizationBundle( bundleVersion, true );
        delete localeData["Loc_Key_Mapping.txt"];

        const localeOut = {};
        for (const [lang, content] of Object.entries(localeData)) {

            const out = {};
            const langKey = lang.replace(/^Loc_|\.txt$/gi, "").toLowerCase();

            for (const row of content.split("\n")) {
                if (IGNORE_KEYS.some(ign => row.toLowerCase().includes(ign))) continue;
                const res = processLocalizationLine(row);
                if (res) {
                    const [key, val] = res;
                    if (key && val) out[key] = val;
                }
            }
            localeOut[langKey] = out;
        }
        // This is going to be a new version, so we can just delete the old files
        fs.readdirSync(gameDataDir)
            .filter(fileName => fileName.startsWith("localizationBundle_") && fileName !== dataFile)
            .forEach(f => fs.unlinkSync(gameDataDir + f));

        // Then save it
        console.log("Saving localeData for " + bundleVersion);
        await fs.writeFileSync(filePath, JSON.stringify(localeOut));

        // Then finally, return it
        return localeOut;
    } catch (error) {
        console.error("[getLocalizationData] Error fetching or processing localization data:", error);
        throw error; // Rethrow the error for further handling
    }
}

function processLocalizationLine(line) {
    if (line.startsWith("#")) return;
    let [ key, val ] = line.split(/\|/g).map(s => s.trim());
    if (!key || !val) return;
    val = val
        .replace(/^\[[0-9A-F]*?\](.*)\s+\(([A-Z]+)\)\[-\]$/, (m,p1) => p1)
        .replace(/\\n/g, " ")
        .replace(/(\[\/*c*-*\]|\[[\w\d]{6}\])/g,"");
    return [key, val];
}

async function processJourneyReqs(gameData) {
    const characters = await fs.promises.readFile(CHAR_FILE, "utf-8").then(JSON.parse);
    const ships = await fs.promises.readFile(SHIP_FILE, "utf-8").then(JSON.parse);
    let oldReqs = {};
    // Grab the existing saved data if available
    if (fs.existsSync(JOURNEY_FILE)) {
        oldReqs = JSON.parse(fs.readFileSync(JOURNEY_FILE, "utf-8"));
    }

    // Grab all the units that have activation requirements to process
    const unitGuides = gameData.unitGuideDefinition
        .filter(g => g.additionalActivationRequirementId)
        .map(g => ({
            defId: g.unitBaseId,
            guideId: g.additionalActivationRequirementId
        }));

    // For each character in the guide that had useful data, process their requirements
    const unitGuideOut = {};
    for (const unit of unitGuides) {
        const tempOut = {
            guideId: unit.guideId,
            type: "AUTO",
            reqs: []
        };

        // For each required character, save the defId, the required stat, and it's level
        const reqs = gameData.requirement.find(req => req.id === unit.guideId).requirementItem;
        for (const req of reqs) {
            const evs = gameData.challenge.find(chal => chal.id === req.id)?.task;
            if (!evs) continue;

            for (const ev of evs) {
                const splitDesc = ev.descKey.split("_");
                const tier = parseInt(splitDesc.pop(), 10);
                const type = splitDesc.pop();
                const defId = ev?.actionLinkDef?.link.split("=").pop();
                if (defId) {
                    if (ships.find(sh => sh.uniqueName === defId)) {
                        tempOut.reqs.push({defId, type, tier, ship: true});
                    } else {
                        tempOut.reqs.push({defId, type, tier});
                    }
                }
            }
        }

        // If it's found requirements for this unit, go ahead and keep em
        if (tempOut.reqs?.length) {
            unitGuideOut[unit.defId] = tempOut;
        }
    }


    // Process the old reqs data to keep any manual entries, and wipe out/ replace any automated ones
    const reqsOut = {};
    if (oldReqs && Object.keys(oldReqs).length) {
        for (const reqKey of Object.keys(oldReqs)) {
            const thisReq = oldReqs[reqKey];
            if (thisReq.type === "MIXED") {
                // Grab all the manually put in units
                const thisReqOut = thisReq.reqs.filter(unit => unit.manual);
                const currentUnits = thisReqOut.map(unit => unit.defId);

                // Go through each chunk from the auto section and get the units together
                for (const autoReq of thisReq.auto) {
                    const searchArr = autoReq.ship ? ships : characters;
                    const out = searchArr
                        .filter(unit => {
                        // Don't keep units that're already in the list manually
                            if (currentUnits.includes(unit.uniqueName)) return false;

                            // Don't list the character you're trying to unlock as a valid requirement
                            if (unit.uniqueName === reqKey) return false;

                            // If it needs capital ships only, filter the list down to that
                            if (autoReq.capital) {
                            // If we want all capital ships, don't filter it down
                                if (autoReq.faction === "ALL") {
                                    return true;
                                }
                                return unit.factions.includes("Capital Ship");
                            }

                            // If it gets here, just check the required faction against the unit's factions list
                            return unit.factions.includes(autoReq.faction);
                        })
                        .map(unit => {
                            const out = {
                                defId: unit.uniqueName,
                                type: autoReq.type,
                                tier: autoReq.tier,
                            };
                            if (autoReq?.ship) out.ship = true;
                            return out;
                        });
                    thisReqOut.push(...out);
                }
                thisReq.reqs = thisReqOut;
            }
            // Process and enter the characters for requirements that're just full factions
            // - This will make it so as new characters are added to a faction, they're included as needed
            if (thisReq.type === "FACTION") {
                thisReq.reqs = characters
                    .filter(ch => ch.factions.includes(thisReq.faction.name))
                    .map(ch => {
                        return {
                            defId: ch.uniqueName,
                            type: thisReq.faction.type,
                            tier: thisReq.faction.tier
                        };
                    });
            }
            // Wipe out any auto entries, so they'll be reformed
            if (thisReq.type !== "AUTO") {
                reqsOut[reqKey] = thisReq;
            }
        }
    }

    debugLog(`Updating JourneyReqs file, ${Object.keys(oldReqs).length} manual entries, ${Object.keys(unitGuideOut).length} automatic entries`);

    // Combine the old stuff with the new automated data
    fs.writeFileSync(JOURNEY_FILE, JSON.stringify({
        ...oldReqs,
        ...unitGuideOut
    }, null, 4), {encoding: "utf-8"});
}

const ROMAN_REGEX = /^(X|XX|XXX|XL|L|LX|LXX|LXXX|XC|C)?(I|II|III|IV|V|VI|VII|VIII|IX)$/i;
function toProperCase(strIn) {
    return strIn.replace(/([^\W_]+[^\s-]*) */g, function(txt) {
        if (ROMAN_REGEX.test(txt)) return txt.toUpperCase();
        return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
    });
}

const { inspect } = require("util");
function debugLog(str) {
    if (!FORCE_UPDATE) return;
    if (typeof str === "string" && str.length) {
        console.log(str);
    } else {
        console.log(inspect(...str, {depth: 5}));
    }
}

module.exports = {
    processAbilities,
    processCategories,
    processEquipment,
    processMaterials,
    processModData,
    processRecipes,
    processUnits,
    unitsToCharacterDB,
    unitsForUnitMapFile,
    unitsToUnitFiles,

    processJourneyReqs,
    saveRaidNames,

    saveFile,
    processLocalization,
}
