const fs = require("fs");

const config = require(__dirname + "/../config.js");
const MongoClient = require("mongodb").MongoClient;
let cache = null;

const ComlinkStub = require("@swgoh-utils/comlink");
const comlinkStub = new ComlinkStub(config.fakeSwapiConfig.clientStub);

let metadataFile;

// TODO Use this for shop inventories
// const featureStoreList = JSON.parse(fs.readFileSync(dataDir + "swgoh-json-files/featureStoreList.json", "utf-8"))[0];

const CHAR_COMBAT_TYPE = 1;

const dataDir = __dirname + "/../data/";

const campaignMapNames = JSON.parse(fs.readFileSync(dataDir + "swgoh-json-files/campaignMapNames.json", "utf-8"))[0];
const campaignMapNodes = JSON.parse(fs.readFileSync(dataDir + "swgoh-json-files/campaignMapNodes.json", "utf-8"))[0];

const CHAR_FILE      = dataDir + "characters.json";
const CHAR_LOCATIONS = dataDir + "charLocations.json";
const SHIP_FILE      = dataDir + "ships.json";
const SHIP_LOCATIONS = dataDir + "shipLocations.json";

const META_FILE      = dataDir + "metadata.json";
const META_KEYS = ["assetVersion", "latestGamedataVersion", "latestLocalizationBundleVersion"];

// Use these to store data in to use when needing data from a different part of the gameData processing
let unitRecipeList = [];
let unitShardList = [];
const unitFactionMap = {};
const unitDefIdMap = {};

// How long between being runs (In minutes)
const INTERVAL = 60;
console.log(`Starting data updater, set to run every ${INTERVAL} minutes.`);

// Run the upater when it's started, then every ${INTERVAL} minutes after that
init().then(async () => {
    const isNew = await updateMetaData();
    if (isNew) {
        // await updateGameData();
        await runUpdater();
    }
});

// Set it to update the patreon data and every INTERVAL minutes if doable
if (config.patreon) {
    setInterval(async () => {
        await updatePatrons();
    }, INTERVAL * 60 * 1000);
}

// Set it to check/ update the game data daily if needed
setInterval(async () => {
    const isNew = await updateMetaData();
    if (isNew) {
        await updateGameData();
    }
}, 24 * 60 * 60 * 1000);

async function init() {
    const mongo = await MongoClient.connect(config.mongodb.url, { useNewUrlParser: true, useUnifiedTopology: true } );
    cache = require(__dirname + "/../modules/cache.js")(mongo);
}

// Update the metadata file if it exists, create it otherwise
async function updateMetaData() {
    const meta = await comlinkStub.getMetaData();
    let metaFile = {};
    if (fs.existsSync(META_FILE)) {
        metaFile = JSON.parse(fs.readFileSync(META_FILE, "utf-8"));
    }
    let isUpdated = false;
    const metaOut = {};
    for (const key of META_KEYS) {
        if (meta[key] !== metaFile[key]) {
            metaOut[key] = meta[key];
            isUpdated = true;
        }
    }

    if (isUpdated) {
        await saveFile(META_FILE, metaOut);
        metadataFile = metaOut;
    }

    return isUpdated;
}

async function runUpdater() {
    const time = new Date().toString().split(" ").slice(1, 5);
    const log = [];

    // Load the files of char/ship locations
    const currentCharLocs     = JSON.parse(fs.readFileSync(CHAR_LOCATIONS));
    const currentShipLocs     = JSON.parse(fs.readFileSync(SHIP_LOCATIONS));

    // TODO Change updateGameData to return a log array so it can all be logged nicely with the locations?
    await updateGameData();     // Run the stuff to grab all new game data, and update listings in the db

    // TODO Still need to work out checking mod loadouts locally... Probably more often than waiting on a metadata update too though
    // const ggModData = await getGgChars();
    // if (ggModData && await updateIfChanged({localCachePath: GG_MOD_CACHE, dataObject: ggModData})) {
    //     log.push("Detected a change in mods from swgoh.gg");
    //     await updateCharacterMods(currentCharacters, ggModData);
    // }

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


// const cheerio = require("cheerio");
// const GG_MOD_CACHE   = dataDir + "swgoh-gg-mods.json";
// function getCleanString(input) {
//     const cleanReg = /["()'-\s]/g;
//
//     return input.toLowerCase().replace(cleanReg, "");
// }
// async function getGgChars() {
//     let response = null;
//     try {
//         response = await fetch(config.swgohggUrl);
//     } catch {
//         console.error("Cannot get .gg char/ mod info");
//         return null;
//     }
//     const ggPage = await response.text();
//
//     const modSetCounts = {
//         "Crit Chance":     "Critical Chance x2",
//         "Crit Damage":     "Critical Damage x4",
//         "Critical Chance": "Critical Chance x2",
//         "Critical Damage": "Critical Damage x4",
//         "Defense":         "Defense x2",
//         "Health":          "Health x2",
//         "Offense":         "Offense x4",
//         "Potency":         "Potency x2",
//         "Speed":           "Speed x4",
//         "Tenacity":        "Tenacity x2"
//     };
//
//     const $ = cheerio.load(ggPage);
//
//     const charOut = [];
//
//     $("table.table-striped > tbody > tr")
//         .each((i, elem) => {
//             let [name, sets, receiver, holo, data, multiplexer] = $(elem).children();
//             // const defId = $(name).find("img").attr("data-base-id");
//             const imgUrl =  $(name).find("img").attr("src");
//             // const side = $(name).find("div").attr("class").indexOf("light-side") > -1 ? "Light Side" : "Dark Side";
//             const [url, modUrl] = $(name).find("a").toArray().map(link => {
//                 return $(link)?.attr("href")?.trim() || "";
//             });
//             name = cleanName($(name).text());
//             sets = $(sets).find("div").toArray().map(div => {
//                 return countSet($(div).attr("data-title")?.trim());
//             });
//             receiver    = cleanModType($(receiver).text());
//             holo        = cleanModType($(holo).text());
//             data        = cleanModType($(data).text());
//             multiplexer = cleanModType($(multiplexer).text());
//             charOut.push({
//                 name:     name,
//                 // defId:    defId,
//                 charUrl:  "https://swgoh.gg" + url,
//                 image:    imgUrl,
//                 // side:     side,
//                 modsUrl:  "https://swgoh.gg" + modUrl, //+ url + "best-mods/",
//                 mods: {
//                     sets:     sets,
//                     square:   "Offense",
//                     arrow:    receiver,
//                     diamond:  "Defense",
//                     triangle: holo,
//                     circle:   data,
//                     cross:    multiplexer
//                 }
//             });
//         });
//
//     // Clean up the mod names (Wipe out extra spaces or condense long names)
//     function cleanModType(types) {
//         if (!types || typeof types !== "string") return null;
//         return types.trim()
//             .replace(/\s+\/\s/g, "/ ")
//             .replace("Critical Damage", "Crit. Damage")
//             .replace("Critical Chance", "Crit. Chance");
//     }
//
//     // This is mainly to clean up Padme's name for now
//     function cleanName(name) {
//         if (!name || typeof name !== "string") return;
//         return name.trim().replace("é", "e");
//     }
//
//     // Put the number of mods for each set
//     function countSet(setName) {
//         return modSetCounts[setName] || setName;
//     }
//     return charOut;
// }
// async function updateCharacterMods(currentCharacters, freshMods) {
//     const GG_SOURCE = "swgoh.gg";
//
//     // Iterate the data from swgoh.gg, put new mods in as needed, and if there's a new character, put them in too
//     for (const character of freshMods) {
//         let thisChar = currentCharacters.find(ch =>
//             ch.uniqueName === character.defId ||
//             getCleanString(ch.name) === getCleanString(character.name) ||
//             ch.url === character.charUrl
//         );
//         if (!thisChar) {
//             thisChar = currentCharacters.find(ch => ch.aliases.includes(character.name));
//         }
//         const mods = {
//             url:      character.modsUrl,
//             sets:     character.mods.sets,
//             square:   character.mods.square,
//             arrow:    character.mods.arrow,
//             diamond:  character.mods.diamond,
//             triangle: character.mods.triangle,
//             circle:   character.mods.circle,
//             cross:    character.mods.cross,
//             source:   GG_SOURCE
//         };
//
//         if (thisChar) {
//             thisChar.mods = mods;
//         } else {
//             // This shouldn't really happen since it should be caught in updateCharacters
//             console.log(`[DataUpdater] (updateCharacterMods) New character discovered: ${character.name} (${character.defId})\n${character}`);
//         }
//     }
// }


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

    const outArr = [];
    for (const mat of matArr) {
        const missions = mat?.mats?.lookupMissionList;
        if (!missions?.length) continue;

        const charArr = [];
        for (const node of missions) {
            if (node.campaignId === "EVENTS") continue;
            const outMode = campaignMapNames[node.campaignId]?.game_mode;
            if (!outMode) continue;

            const outNode = campaignMapNodes?.[node.campaignId]?.[node.campaignMapId]?.[node.campaignNodeDifficulty]?.[node.campaignNodeId]?.[node.campaignMissionId];

            let typeStr = "Hard Modes";
            switch (outMode) {
                case "Light Side Battles":
                    typeStr += " (L)";
                    break;
                case "Dark Side Battles":
                    typeStr += " (D)";
                    break;
                case "Cantina Battles":
                    typeStr = "Cantina";
                    break;
                case "Fleet Battles":
                    typeStr += " (Fleet)";
                    break;
                default:
                    typeStr = "N/A";
                    break;
            }
            charArr.push({
                type: typeStr,
                level: outNode
            });
        }
        outArr.push({defId: mat.defId, locations: charArr});
    }

    // Wipe out all previous locations so we can replace them later, but leave the shop info alone
    const filteredLocations = currentLocs.map(loc => {
        loc.locations = loc.locations.filter(thisLoc => !thisLoc?.level?.length);
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
            locations: locations?.sort((a,b) => a.type.toLowerCase() > b.type.toLowerCase() ? 1 : -1) || []
        });
    }

    return finalOut.sort((a,b) => a?.name && b?.name ? (a.name?.toLowerCase() > b.name?.toLowerCase() ? 1 : -1) : (a.defId.toLowerCase() > b.defId.toLowerCase() ? 1 : -1));
}

async function updateGameData() {
    let locales = {};
    async function updateGameData() {
        const gameData = await comlinkStub.getGameData(metadataFile.latestGamedataVersion, false);

        locales = await getLocalizationData(metadataFile.latestLocalizationBundleVersion);

        await processAbilities(gameData.ability, gameData.skill);
        await processEquipment(gameData.equipment);
        await processMaterials(gameData.material);
        await processModData(gameData.statMod);
        await processRecipes(gameData.recipe);
        await processUnits(gameData.units);
    }
    await updateGameData();


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
                creationRecipeReference: unit.creationRecipeReference
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
            } else {
                // Work up a new character to put in
                unitObj = createNewUnit(unit, charUIName);
            }

            // Process characters
            unit.combatType === CHAR_COMBAT_TYPE ? charactersOut.push(unitObj) : shipsOut.push(unitObj);
        }

        function getCharUIName(creationRecipeId) {
            const thisRecipe = unitRecipeList.find(rec => rec.id === creationRecipeId);
            const thisUnitShard = unitShardList.find(sh => sh.id === thisRecipe.unitshard);
            return thisUnitShard?.iconKey;
        }

        function getSide(factions) {
            const factionCheck = (checkStr) => {
                if (factions.includes(checkStr)) {
                    factions.splice(factions.indexOf(checkStr), 1);
                    return true;
                }
            };

            if (factionCheck("Dark Side")) {
                return "dark";
            } else if (factionCheck("Light Side")) {
                return "light";
            } else if (factionCheck("Neutral")) {
                return "neutral";
            } else {
                return "N/A";
            }
        }

        function createNewUnit(unit, charUIName) {
            const unitFactions = unitFactionMap[unit.baseId];
            const unitOut = {
                "name":        unit.name,
                "uniqueName":  unit.baseId,
                "aliases":     [unit.name],
                "avatarName":  charUIName,
                "side":        getSide(unitFactions),
                "factions":    unitFactions.sort((a, b) => a.toLowerCase() > b.toLowerCase() ? 1 : -1),
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
            console.log(`Creating a new unit: ${unit.name}   (${unit.baseId})`);
            return unitOut;
        }

        // Write to the characters & ships files
        const sortedChars = charactersOut.sort((a, b) => a.name.toLowerCase() > b.name.toLowerCase() ? 1 : -1);
        await saveFile(CHAR_FILE, sortedChars);
        const sortedShips = shipsOut.sort((a, b) => a.name.toLowerCase() > b.name.toLowerCase() ? 1 : -1);
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
}

function toProperCase(strIn) {
    return strIn.replace(/([^\W_]+[^\s-]*) */g, function(txt) {
        return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
    });
}

