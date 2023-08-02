const config = require(__dirname + "/../config.js");

const fs = require("node:fs");
const { eachLimit } = require("async");

const MongoClient = require("mongodb").MongoClient;
let cache = null;

const FORCE_UPDATE = true;

const ComlinkStub = require("@swgoh-utils/comlink");
const comlinkStub = new ComlinkStub(config.fakeSwapiConfig.clientStub);

let metadataFile;

// TODO Use this for shop inventories
// const featureStoreList = JSON.parse(fs.readFileSync(dataDir + "swgoh-json-files/featureStoreList.json", "utf-8"))[0];

const CHAR_COMBAT_TYPE = 1;
const SHIP_COMBAT_TYPE = 2;

const dataDir = __dirname + "/../data/";

const campaignMapNames = JSON.parse(fs.readFileSync(dataDir + "swgoh-json-files/campaignMapNames.json", "utf-8"))[0];
const campaignMapNodes = JSON.parse(fs.readFileSync(dataDir + "swgoh-json-files/campaignMapNodes.json", "utf-8"))[0];

const CHAR_FILE      = dataDir + "characters.json";
const CHAR_LOCATIONS = dataDir + "charLocations.json";
const SHIP_FILE      = dataDir + "ships.json";
const SHIP_LOCATIONS = dataDir + "shipLocations.json";

const JOURNEY_FILE  = dataDir + "journeyReqs.json";

const RAID_NAMES     = dataDir + "raidNames.json";

const META_FILE      = dataDir + "metadata.json";
const META_KEYS = ["assetVersion", "latestGamedataVersion", "latestLocalizationBundleVersion"];

// The max players to grab at the same time
const MAX_CONCURRENT = 20;
let modMap = JSON.parse(fs.readFileSync(dataDir + "modMap.json"));
let unitMap = JSON.parse(fs.readFileSync(dataDir + "unitMap.json"));

// Use these to store data in to use when needing data from a different part of the gameData processing
let unitRecipeList = [];
let unitShardList = [];
const unitFactionMap = {};
const unitDefIdMap = {};

let locales = {};

console.log("Starting data updater");

// Run the upater when it's started
init().then(async () => {
    const isNew = await updateMetaData();
    if (isNew || FORCE_UPDATE) {
        await runGameDataUpdaters();
    }
    if (!FORCE_UPDATE) {
        await runModUpdaters();
    }
});

// Set it to update the patreon data and every 15 minutes if doable
if (!FORCE_UPDATE) {
    if (config.patreon) {
        setInterval(async () => {
            await updatePatrons();
        }, 15 * 60 * 1000);
    }

    // Set it to check/ update the game data daily if needed
    // - Also run the mods updater daily
    setInterval(async () => {
        const isNew = await updateMetaData();
        if (isNew) {
            await runGameDataUpdaters();
        }
        await runModUpdaters();
    }, 24 * 60 * 60 * 1000);
}

async function init() {
    const mongo = await MongoClient.connect(config.mongodb.url, { useNewUrlParser: true, useUnifiedTopology: true } );
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
        saveFile(CHAR_LOCATIONS, newCharLocs);
    }
    const newShipLocs = await updateLocs(SHIP_FILE, SHIP_LOCATIONS);
    if (newShipLocs && JSON.stringify(newShipLocs) !== JSON.stringify(currentShipLocs)) {
        log.push("Detected a change in ship locations.");
        saveFile(SHIP_LOCATIONS, newShipLocs);
    }


    if (log?.length) {
        console.log(`Ran updater - ${time[0]} ${time[1]}, ${time[2]} - ${time[3]}`);
        console.log(log.join("\n"));
    } else {
        // console.log(`Ran updater - ${time[0]} ${time[1]}, ${time[2]} - ${time[3]}  ##  Nothing updated`);
    }
}

function saveFile(filePath, jsonData, doPretty=true) {
    try {
        if (doPretty) {
            fs.writeFileSync(filePath, JSON.stringify(jsonData, null, 4), {encoding: "utf8"});
        } else {
            fs.writeFileSync(filePath, JSON.stringify(jsonData), {encoding: "utf8"});
        }
    } catch (err) {
        if (err) {
            console.log("ERROR in dataUpdater/saveFile: " + err);
        }
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
            .filter(unit => unit?.equippedStatMod && unitMap[unit.definitionId.split(":")[0]].combatType === 1)
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

        const maxPrim = Math.max(...Object.values(thisUnit.primaries));
        for (const [prim, count] of Object.entries(thisUnit.primaries)) {
            if (count !== maxPrim) delete thisUnit.primaries[prim];
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

        const maxSets = Math.max(...Object.values(thisUnit.sets));
        for (const [set, count] of Object.entries(thisUnit.sets)) {
            if (count !== maxSets) delete thisUnit.sets[set];
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
    const characters = await JSON.parse(fs.readFileSync(CHAR_FILE));

    for (const defId of Object.keys(modsIn)) {
        const thisChar = characters.find(ch => ch.uniqueName === defId);
        if (!thisChar) continue;
        thisChar.mods = modsIn[defId].mods;
    }

    await saveFile(CHAR_FILE, characters);
}




async function updatePatrons() {
    const patreon = config.patreon;
    if (!patreon) {
        return;
    }
    try {
        let response = await fetch("https://www.patreon.com/api/oauth2/api/current_user/campaigns",
            {
                headers: {
                    Authorization: "Bearer " + patreon.creatorAccessToken
                }
            }).then(res => res.json());

        if (response && response.data && response.data.length) {
            response = await fetch("https://www.patreon.com/api/oauth2/api/campaigns/1328738/pledges?page%5Bcount%5D=100", {
                headers: {
                    Authorization: "Bearer " + patreon.creatorAccessToken
                }
            }).then(res => res.json());

            const data = response?.data;
            const included = response?.included;

            const pledges = data.filter(data => data.type === "pledge");
            const users = included.filter(inc => inc.type === "user");

            pledges.forEach(pledge => {
                const user = users.find(user => user.id === pledge.relationships.patron.data.id);
                if (user) {
                    cache.put("swgohbot", "patrons", {id: pledge.relationships.patron.data.id}, {
                        id:                 pledge.relationships.patron.data.id,
                        full_name:          user.attributes.full_name,
                        vanity:             user.attributes.vanity,
                        email:              user.attributes.email,
                        discordID:          user.attributes.social_connections.discord ? user.attributes.social_connections.discord.user_id : null,
                        amount_cents:       pledge.attributes.amount_cents,
                        declined_since:     pledge.attributes.declined_since,
                        pledge_cap_cents:   pledge.attributes.pledge_cap_cents,
                    });
                }
            });
        }
    } catch (e) {
        console.log("Error getting patrons");
    }
}

async function updateLocs(unitListFile, currentLocFile) {
    debugLog("Updating unit locations");
    const currentUnits = JSON.parse(fs.readFileSync(unitListFile, "utf-8"));
    const currentLocs = JSON.parse(fs.readFileSync(currentLocFile, "utf-8"));
    const matArr = [];

    for (const unit of currentUnits) {
        const res = await cache.get(config.mongodb.swapidb, "materials", {id: `unitshard_${unit.uniqueName}`});
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
    for (const lang of langList) {
        for (const target of Object.keys(targets)) {
            const out = {
                id: target,
                language: lang,
                langKey: targets[target].map(t => locales[lang][t] || `ERROR: ${t}`).join(" ")
            };
            await cache.put(config.mongodb.swapidb, "locations", {id: target, language: lang}, out);
        }
    }

    const outArr = [];
    for (const mat of matArr) {
        const missions = mat?.mats?.lookupMissionList;
        if (!missions?.length) continue;

        const charArr = [];
        const usedLocId = [];
        for (const node of missions) {
            if (node.campaignId === "EVENTS") {
                let locId = null;
                const charObj = {};
                if (node.campaignMapId === "MARQUEE") {
                    // Run through stuff for Marquee events
                    locId = `EVENT_MARQUEE_${node.campaignNodeId.split("_")[0]}_NAME`;
                    if (usedLocId.includes(locId)) continue;
                    usedLocId.push(locId);

                    charObj.type = "Marquee";
                    charObj.locId = locId;
                } else if (node.campaignMapId === "PROGRESSION") {
                    // Process the two progression events (GMY / EP)
                    locId = `PROGRESSIONEVENT_${node.campaignNodeId}_NAME`;
                    if (usedLocId.includes(locId)) continue;
                    usedLocId.push(locId);

                    charObj.type = "Legendary Event";
                    charObj.locId = locId;
                } else if (node.campaignMapId === "SCHEDULED" && node.campaignNodeId === "CONQUEST_UNIT_TRIALS") {
                    // Process the Proving Grounds events
                    // - Really just localize "Proving Grounds" since the rest is just the unit's name
                    locId = "EVENT_CONQUEST_UNIT_TRIALS_NAME";
                    if (usedLocId.includes(locId)) continue;
                    usedLocId.push(locId);

                    charObj.type = "Proving Grounds";
                    charObj.locId = locId;
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

                    if (usedLocId.includes(locId)) continue;
                    usedLocId.push(locId);

                    charObj.type = "Galactic Ascension";
                    charObj.locId = locId;
                }

                // Go through and save all the locale strings into the db
                if (!locId) continue;
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

                let locId = null;
                // ONLY /farm and /need use these
                let typeStr = "Hard Modes";
                switch (outMode) {
                    case "Light Side Battles":
                        typeStr += " (L)";
                        locId = "HARD_LIGHT";
                        break;
                    case "Dark Side Battles":
                        typeStr += " (D)";
                        locId = "HARD_DARK";
                        break;
                    case "Cantina Battles":
                        typeStr = "Cantina";
                        locId = "CANTINA";
                        break;
                    case "Fleet Battles":
                        typeStr += " (Fleet)";
                        locId = "HARD_FLEET";
                        break;
                    default:
                        typeStr = "N/A";
                        break;
                }
                charArr.push({
                    type: typeStr,
                    level: outNode,
                    locId
                });
            }
        }
        outArr.push({defId: mat.defId, locations: charArr});
    }

    // Wipe out all previous locations so we can replace them later, but leave the shop info alone
    const whitelistTypeLocs = [
        "Achievements",
        "Assault Battle",
        "Epic Confrontation",
        "Challenges",
        "Hero's Journey",
        "Heroic Event",
        "Legacy Event",
        "Legendary Event",
        "Raids",
        "Special Event",
        "Territory Battle",
    ];
    const filteredLocations = currentLocs.map(loc => {
        loc.locations = loc.locations.filter(thisLoc => thisLoc?.cost?.length || (whitelistTypeLocs.includes(thisLoc?.type) && !thisLoc.locId));
        return loc;
    });

    const finalOut = [];
    for (const unit of currentUnits) {
        const thisUnitLoc = filteredLocations.find(loc => loc.defId === unit.uniqueName);
        const unitLoc = outArr.find(loc => loc.defId === unit.uniqueName) || {defId: unit.uniqueName};
        const locations = [];
        if (thisUnitLoc?.locations) locations.push(...thisUnitLoc.locations);
        if (unitLoc?.locations) locations.push(...unitLoc.locations);
        const unitName = thisUnitLoc?.name || unitLoc?.name || unit?.name;

        // If it somehow doesn't have anything to identify it, move along
        if (!unitName && !unitLoc.defId) continue;

        finalOut.push({
            name: unitName,
            defId: unitLoc.defId,
            locations: locations?.sort((a,b) => a.type?.toLowerCase() > b.type?.toLowerCase() ? 1 : -1) || []
        });
    }

    return finalOut.sort((a,b) => a?.name && b?.name ? (a.name?.toLowerCase() > b.name?.toLowerCase() ? 1 : -1) : (a.defId.toLowerCase() > b.defId.toLowerCase() ? 1 : -1));
}

async function updateGameData() {
    if (!metadataFile.latestGamedataVersion) return console.error("[updateGameData] Missing latestGamedataVersion from metadata");
    const gameData = await comlinkStub.getGameData(metadataFile.latestGamedataVersion, false);

    debugLog("Running main updaters");

    locales = await getLocalizationData(metadataFile.latestLocalizationBundleVersion);

    await processAbilities(gameData.ability, gameData.skill);
    debugLog("Finished processing Abilities");
    await processCategories(gameData.category);
    debugLog("Finished processing Categories");
    await processEquipment(gameData.equipment);
    debugLog("Finished processing Equipment");
    await processMaterials(gameData.material);
    debugLog("Finished processing Materials");
    await processModData(gameData.statMod);
    debugLog("Finished processing Mod data");
    await processRecipes(gameData.recipe);
    debugLog("Finished processing Recipes");
    await processUnits(gameData.units);
    debugLog("Finished processing Units");
    await processJourneyReqs(gameData);
    debugLog("Finished processing Journey Reqs");
    await saveRaidNames();
    debugLog("Finished processing Raid Names");

    /**
    * function
    * @param {Object[]} rawDataIn  - The array of objects to localize
    * @param {string}   dbTarget   - The mongo table to insert into
    * @param {string[]} targetKeys - An array of keys to localize
    * @param {string}   dbIdKey    - The key to use as the unique db key
    * @param {string[]} langList   - An array of localization languages
    */
    async function processLocalization(rawDataIn, dbTarget, targetKeys, dbIdKey="id", langList) {
        if (!langList) langList = Object.keys(locales);
        for (const lang of langList) {    // For each language that we need to localize for...
            const dataIn = structuredClone(rawDataIn);
            for (const data of dataIn) {    // For each chunk of the dataIn (ability, gear, recipes, unit, etc)
                for (const target of targetKeys) {      // For each of the specified keys of each chunk
                    data.language = lang;
                    if (Array.isArray(data[target])) {
                        for (const ix in data[target]) {    // If it's an array, go ahead and localize each entry inside
                            if (locales[lang][data[target][ix]]) {
                                data[target][ix] = locales[lang][data[target][ix]];
                            }
                        }
                    } else {
                        if (locales[lang][data[target]]) {
                            data[target] = locales[lang][data[target]];
                        }
                    }
                }
                await cache.put(config.mongodb.swapidb, dbTarget, {[dbIdKey]: data[dbIdKey], language: lang}, data);
            }
            // console.log(`Finished localizing ${dbTarget} for ${lang}`);
        }
        // console.log(`Finished localizing ${dbTarget}`);
    }

    async function saveRaidNames() {
        const langList = Object.keys(locales);

        // The keys that match in the lang files, and the keys that the guild raids give
        const raidKeys = {
            RAID_AAT_NAME: "aat",
            RAID_RANCOR_NAME: "rancor",
            RAID_RANCOR_CHALLENGE_NAME: "rancor_challenge",
            RAID_TRIUMVIRATE_NAME: "sith_raid",
            MISSION_GUILDRAIDS_KRAYTDRAGON_NAME: "kraytdragon",
            MISSION_GUILDRAIDSLEGACY_HEROIC_NAME: "heroic"
        };
        const out = {};
        for (const lang of langList) {
            out[lang] = {};
            for (const key of Object.keys(raidKeys)) {
                out[lang][raidKeys[key]] = locales[lang][key];
            }
        }
        saveFile(RAID_NAMES, out);
    }

    async function processAbilities(abilityIn, skillIn) {
        const abilitiesOut = [];
        const skillMap = {};

        for (const ability of abilityIn) {
            const skill = skillIn.find(sk => sk.abilityReference === ability.id);
            if (!skill) continue;

            const abOut = {
                id: ability.id,
                type: ability.type,
                nameKey: ability.nameKey,
                descKey: ability.descKey,
                cooldown: ability.cooldown,
                isZeta: skill.isZeta || false,
                skillId: skill.id,
                tierList: skill.tier.map(t => t.recipeId)
            };
            if (ability?.tier?.length) {
                abOut.abilityTiers = ability.tier?.map(ti => ti.descKey);
                abOut.descKey = abOut.abilityTiers[abOut.abilityTiers.length-1];
            }
            if (skill.tier.filter(t => t.isOmicronTier)?.length) {
                abOut.isOmicron = true;
            }
            if (abOut.isOmicron) {
                abOut.omicronTier = abOut.tierList.length;
            }
            if (abOut.isZeta) {
                abOut.zetaTier = abOut.isOmicron ? abOut.tierList.length-1 : abOut.tierList.length;
            }
            abilitiesOut.push(abOut);

            skillMap[skill.id] = {
                nameKey: ability.nameKey,
                isZeta: skill.isZeta,
                tiers: skill.tier.length,
                abilityId: skill.abilityReference
            };
        }
        await saveFile(dataDir + "skillMap.json", skillMap, false);
        await processLocalization(abilitiesOut, "abilities", ["nameKey", "descKey", "abilityTiers"], "id", null);
    }

    async function processCategories(catsIn) {
        const catMapOut = catsIn
            .filter(cat => cat.visible || cat.id.startsWith("alignment"))
            .map(({id, descKey}) => {
                return {id, descKey};
            });

        // await saveFile(dataDir + "catMap.json", catMapOut, false);
        await processLocalization(catMapOut, "categories", ["descKey"], "id", null);
    }

    async function processEquipment(equipmentIn) {
        const mappedEquipmentList = equipmentIn.map(equipment => {
            return {
                id: equipment.id,
                nameKey: equipment.nameKey,
                recipeId: equipment.recipeId,
                mark: equipment.mark
            };
        });
        await processLocalization(mappedEquipmentList, "gear", ["nameKey"], "id", null);
    }

    async function processMaterials(materialIn) {
        // Filter the list to just be unit shards for now
        const filteredList = materialIn.filter(mat => {
            return mat.id.startsWith("unitshard");
        });

        // Then map em to just grab the bits that we want for later
        const mappedMatList = filteredList.map(mat => {
            return {
                id: mat.id,
                lookupMissionList: mat.lookupMission.map(mis => mis.missionIdentifier),
                raidLookupList: mat.raidLookup.map(mis => mis.missionIdentifier),
                iconKey: mat.iconKey
            };
        });

        unitShardList = filteredList.map(mat => {
            return {
                id: mat.id,
                iconKey: mat.iconKey.replace(/^tex\./, "")
            };
        });

        // Then stick em in the db for later use
        for (const mat of mappedMatList) {
            await cache.put(config.mongodb.swapidb, "materials", {id: mat.id}, mat);
        }
    }

    async function processModData(modIn) {
        // gameData.statMod  ->  This is used to get slot, set, and pip of each mod
        const modsOut = {};
        modIn.forEach(m => {
            modsOut[m.id] = {
                pips:  m.rarity,
                set:  m.setId,
                slot: m.slot
            };
        });

        modMap = modsOut;
        await saveFile(dataDir + "modMap.json", modsOut, false);
    }

    async function processRecipes(recipeIn) {
        const mappedRecipeList = recipeIn.map(recipe => {
            return {
                id: recipe.id,
                descKey: recipe.descKey,
                ingredients: recipe.ingredients.filter(ing => ing.id !== "GRIND")
            };
        });

        // Set up a list of just creationRecipeReference IDs, and unitshard names to access later
        unitRecipeList = recipeIn.map(r => {
            const unitshardList = r.ingredients.filter(ing => ing.id?.startsWith("unitshard"));
            if (unitshardList.length) {
                return {
                    id: r.id,
                    unitshard: unitshardList[0].id
                };
            } else {
                return;
            }
        }).filter(r => !!r);
        await processLocalization(mappedRecipeList, "recipes", ["descKey"], "id", ["eng_us"]);
    }

    async function processUnits(unitsIn) {
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

        // Put all the baseId and english names together for later use with the crew
        for (const unit of filteredList) {
            unitDefIdMap[unit.baseId] = locales["eng_us"][unit.nameKey];
        }

        // Pass in a copy of the list so nothing gets altered that would be needed later
        // This will convert everything to the format we're used to in the characters db table
        await unitsToCharacterDB(JSON.parse(JSON.stringify(filteredList)));
        // Then send the list to be processed
        await processLocalization(JSON.parse(JSON.stringify(filteredList)), "units", ["nameKey"], "baseId", null);
        // Then send a copy through for the unitMap to help format player rosters
        await unitsToUnitMapFile(JSON.parse(JSON.stringify(filteredList)));
        // Format everything and save to the characters.json/ ships.json files
        await unitsToUnitFiles(JSON.parse(JSON.stringify(filteredList)));
    }

    async function unitsToUnitFiles(filteredList) {
        const oldCharFile = JSON.parse(fs.readFileSync(CHAR_FILE));
        const oldShipFile = JSON.parse(fs.readFileSync(SHIP_FILE));

        const eng = locales["eng_us"];

        // Process the units into the character or ship files
        const charactersOut = [];
        const shipsOut = [];

        for (const unit of filteredList) {
            const charUIName = getCharUIName(unit.creationRecipeReference);
            unit.name = eng[unit.nameKey];
            let oldUnit;
            if (unit.combatType === CHAR_COMBAT_TYPE) {
                // If it already exists in the file, don't overwrite
                oldUnit = oldCharFile.find(ch => ch.uniqueName === unit.baseId);
            } else {
                oldUnit = oldShipFile.find(sh => sh.uniqueName === unit.baseId);
            }

            let unitObj;

            if (oldUnit) {
                // Don't overwrite, just make sure the info is up to date
                unitObj = oldUnit;
                // delete unitObj.avatarURL;
                delete unitObj.nameVariant;
                unitObj.avatarName = charUIName;
                unitObj.avatarURL  = `https://game-assets.swgoh.gg/tex.${charUIName}.png`;
            } else {
                // Work up a new character to put in
                unitObj = await createNewUnit(unit, charUIName);
            }

            // Sort out where the unit goes
            if (unit.combatType === CHAR_COMBAT_TYPE) {
                charactersOut.push(unitObj);
            } else if (unit.combatType === SHIP_COMBAT_TYPE) {
                shipsOut.push(unitObj);
            } else {
                console.error("Bad combatType for:");
                console.error(unitObj);
            }
        }

        function getCharUIName(creationRecipeId) {
            const thisRecipe = unitRecipeList.find(rec => rec.id === creationRecipeId);
            const thisUnitShard = unitShardList.find(sh => sh.id === thisRecipe.unitshard);
            return thisUnitShard?.iconKey;
        }

        function getSide(factions) {
            for (const side of ["dark", "light", "neutral"]) {
                const factIx = factions.findIndex(fact => fact.id === `alignment_${side}`);
                if (factIx > -1) {
                    factions.splice(factIx, 1);
                    return {
                        side: side,
                        factions: factions.map(fact => fact.descKey)
                    };
                }
            }
        }

        async function createNewUnit(unit, charUIName) {
            const unitFactionsObj = await cache.get(config.mongodb.swapidb, "categories", {id: {$in: unit.categoryIdList}, language: "eng_us"}, {id: 1, descKey: 1, _id: 0});
            const {factions, side} = getSide(unitFactionsObj);
            const unitOut = {
                name:        unit.name,
                uniqueName:  unit.baseId,
                aliases:     [unit.name],
                avatarName:  charUIName,
                avatarURL:   `https://game-assets.swgoh.gg/tex.${charUIName}.png`,
                side:        side,
                factions:    factions.sort((a, b) => a.toLowerCase() > b.toLowerCase() ? 1 : -1),
            };

            if (unit.combatType === CHAR_COMBAT_TYPE) {
                // If it's a character, stick mods in
                unitOut.mods = {};
            } else {
                // If its' a ship, map the crew out to be just the names
                unitOut.crew = unit?.crewList
                    .map(cr => {
                        return unitDefIdMap[cr.unitId];
                    });
            }
            console.log(`Creating a new unit: ${unitOut.name}   (${unitOut.uniqueName})`);
            return unitOut;
        }

        // Write to the characters & ships files
        const sortedChars = charactersOut.sort((a, b) => a.name?.toLowerCase() > b.name?.toLowerCase() ? 1 : -1);
        await saveFile(CHAR_FILE, sortedChars);
        const sortedShips = shipsOut.sort((a, b) => a.name?.toLowerCase() > b.name?.toLowerCase() ? 1 : -1);
        await saveFile(SHIP_FILE, sortedShips);
        console.log("Unit files updated");

        // Wipe out the recipe and mats lists so it'll be clean next time
        unitRecipeList = [];
        unitShardList = [];
    }

    async function unitsToCharacterDB(unitsIn) {
        // Process the units list to go into the characters db table
        const catList = ["alignment", "profession", "affiliation", "role", "shipclass"];
        const ignoreArr = [
            "fomilitary",      "galactic",         "order66",       "sithlord",       "palp", "rebfalconcrew",
            "smuggled",        "foexecutionsquad", "gacs2fireteam", "jacket",         "el16", "ptisfalconcrew",
            "forcelightning",  "doubleblade",      "kenobi",        "translator",     "rey",  "veteransmuggler",
            "crimsondawn",     "sabacc",           "dathbro",       "prisfalconcrew", "kylo", "capital",
            "resistancexwing", "fotie",            "millennium"
        ];
        const factionMap = {
            badbatch       : "bad batch",
            bountyhunter   : "bounty hunter",
            capitalship    : "capital ship",
            cargoship      : "cargo ship",
            clonetrooper   : "clone trooper",
            dark           : "dark side",
            firstorder     : "first order",
            huttcartel     : "hutt cartel",
            imperialremnant: "imerpial remnant",
            imperialtrooper: "imperial trooper",
            inquisitoriu   : "inquisitorius",
            light          : "light side",
            oldrepublic    : "old republic",
            rebelfighter   : "rebel fighter",
            republic       : "galactic republic",
            rogue          : "rogue one",
            sithempire     : "sith empire",
        };

        for (const unit of unitsIn) {
            unit.factions = [];
            delete unit.nameKey;
            delete unit.creationRecipeReference;
            if (!unit.categoryIdList) {
                console.error("Missing baseCharacter abilities for " + unit.baseId);
                continue;
            }
            unit.categoryIdList.forEach(cat => {
                if (catList.some(str => cat.startsWith(str + "_"))) {
                    let faction = cat.split("_")[1];
                    if (ignoreArr.includes(faction)) return;
                    if (factionMap[faction]) faction = factionMap[faction];
                    faction = toProperCase(faction);
                    unit.factions.push(faction);
                }
            });
            delete unit.categoryIdList;
            unit.crew = [];
            unit.factions = [...new Set(unit.factions)];
            if (unit.crewList.length) {
                for (const crewChar of unit.crewList) {
                    unit.crew.push(crewChar.unitId);
                    unit.skillReferenceList = unit.skillReferenceList.concat(crewChar.skillReference);
                }
            }
            delete unit.crewList;
            unitFactionMap[unit.baseId] = unit.factions;
            await cache.put(config.mongodb.swapidb, "characters", {baseId: unit.baseId}, unit);
        }
    }

    async function unitsToUnitMapFile(unitsIn) {
        // gameData.units -> This is used to grab nameKey (Yes, we actually need it), crew data & combatType
        const unitsOut = {};
        unitsIn.forEach(unit => {
            unitsOut[unit.baseId] = {
                nameKey: unit.nameKey,
                combatType: unit.combatType,
                crew: unit.crewList.map(cr => {
                    return {
                        skillReferenceList: cr.skillReference,
                        unitId: cr.unitId,
                        slot: cr.slot
                    };
                })
            };
        });

        unitMap = unitsOut;
        await saveFile(dataDir + "unitMap.json", unitsOut, false);
    }

    async function getLocalizationData(bundleVersion) {
        const ignoreArr = ["datacron", "anniversary", "promo", "subscription", "marquee"];
        const localeData = await comlinkStub.getLocalizationBundle(
            bundleVersion,
            true    // unzip: true
        );
        delete localeData["Loc_Key_Mapping.txt"];

        const localeOut = {};
        for (const [lang, content] of Object.entries(localeData)) {
            const out = {};
            const contentSplit = content.split("\n");
            const langKey = lang.replace("Loc_", "").replace(".txt", "").toLowerCase();

            for (const row of contentSplit) {
                if (ignoreArr.some(ign => row.includes(ign.toLowerCase()))) continue;
                const res = processLocalizationLine(row);
                if (!res) continue;
                const [key, val] = res;
                if (!key || !val) continue;
                out[key] = val;
            }
            localeOut[langKey] = out;
        }
        return localeOut;
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
        let oldReqs = {};
        // Grab the existing saved data if available
        if (fs.existsSync(JOURNEY_FILE)) {
            oldReqs = JSON.parse(fs.readFileSync(JOURNEY_FILE, "utf-8"));
        }

        // Grab all the units that have activation requirements to process
        const unitGuides = gameData.unitGuideDefinition
            .filter(g => g.additionalActivationRequirementId)
            .map(g => {
                return {
                    defId: g.unitBaseId,
                    guideId: g.additionalActivationRequirementId
                };
            });

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
                    if (defId) tempOut.reqs.push({defId, type, tier});
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
