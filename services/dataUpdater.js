const fs = require("fs");
const cheerio = require("cheerio");

const config = require("../config.js");
const MongoClient = require("mongodb").MongoClient;
let cache = null;

const ComlinkStub = require("@swgoh-utils/comlink");
const comlinkStub = new ComlinkStub(config.fakeSwapiConfig.clientStub);

const dataDir = __dirname + "/../data/";

const campaignMapNames = JSON.parse(fs.readFileSync(dataDir + "swgoh-json-files/campaignMapNames.json", "utf-8"))[0];
const campaignMapNodes = JSON.parse(fs.readFileSync(dataDir + "swgoh-json-files/campaignMapNodes.json", "utf-8"))[0];
// const featureStoreList = JSON.parse(fs.readFileSync(dataDir + "swgoh-json-files/featureStoreList.json", "utf-8"))[0];

const GG_CHAR_CACHE          = dataDir + "swgoh-gg-chars.json";
const GG_SHIPS_CACHE         = dataDir + "swgoh-gg-ships.json";
const GG_MOD_CACHE           = dataDir + "swgoh-gg-mods.json";
const CHAR_FILE              = dataDir + "characters.json";
const CHAR_LOCATIONS         = dataDir + "charLocations.json";
const SHIP_LOCATIONS         = dataDir + "shipLocations.json";
const SHIP_FILE              = dataDir + "ships.json";
const GAMEDATA               = dataDir + "gameData.json";
const UNKNOWN                = "Unknown";

// How long between being runs (In minutes)
const INTERVAL = 60;
console.log(`Starting data updater, set to run every ${INTERVAL} minutes.`);

// Run the upater when it's started, then every ${INTERVAL} minutes after that
init().then(async () => {
    // await updateGameData();
    await runUpdater();
});
setInterval(async () => {
    await runUpdater();
}, INTERVAL * 60 * 1000);

async function init() {
    const mongo = await MongoClient.connect(config.mongodb.url, { useNewUrlParser: true, useUnifiedTopology: true } );
    cache = require("../modules/cache.js")(mongo);
}

async function runUpdater() {
    const time = new Date().toString().split(" ").slice(1, 5);
    const log = await updateRemoteData();
    if (log?.length) {
        console.log(`Ran updater - ${time[0]} ${time[1]}, ${time[2]} - ${time[3]}`);
        console.log(log.join("\n"));
    } else {
        // console.log(`Ran updater - ${time[0]} ${time[1]}, ${time[2]} - ${time[3]}  ##  Nothing updated`);
    }
}

function saveFile(filePath, jsonData) {
    try {
        fs.writeFileSync(filePath, JSON.stringify(jsonData, null, 4), "utf8");
    } catch (err) {
        if (err) {
            console.log("ERROR in dataUpdater/saveFile: " + err);
        }
    }
}

async function updateIfChanged({localCachePath, dataSourceUri, dataObject}) {
    let updated = false;

    let localCache = {};
    if (!dataSourceUri && !dataObject) throw new Error("Missing data to compare!");
    if (dataSourceUri && dataObject)   throw new Error("Found URL & data, use one or the other");
    if (dataSourceUri && !dataObject) {
        try {
            // console.log("UpdateRemoteData", "Fetching " + dataSourceUri);
            const remoteData = await fetch(dataSourceUri).then(res => res.json());

            try {
                localCache = JSON.parse(fs.readFileSync(localCachePath));
            } catch (err) {
                const reason = err || "unknown error";
                localCache = {};
                console.log("UpdateRemoteData", "Error reading local cache for " + dataSourceUri + ", reason: " + reason);
            }

            if (remoteData.generatedAt) delete remoteData.generatedAt;
            if (JSON.stringify(remoteData) !== JSON.stringify(localCache)) {
                saveFile(localCachePath, remoteData);
                updated = true;
            }
        } catch (err) {
            const reason = err || "unknown error";
            return console.log("UpdateRemoteData", "Unable to update cache for " + dataSourceUri + ", reason: " + reason);
        }
    } else {
        // Logic for when there's data itself instead of a url
        const dataFile = fs.readFileSync(localCachePath);
        const dataJSON = JSON.parse(dataFile);

        if (JSON.stringify(dataJSON) !== JSON.stringify(dataObject)) {
            saveFile(localCachePath, dataObject);
            updated = true;
        }
    }

    return updated;
}

async function updateRemoteData() {
    // Load then copy the data of char/ship files
    const currentCharacters   = JSON.parse(fs.readFileSync(CHAR_FILE));
    const currentCharSnapshot = JSON.parse(JSON.stringify(currentCharacters));
    const currentShips        = JSON.parse(fs.readFileSync(SHIP_FILE));
    const currentShipSnapshot = JSON.parse(JSON.stringify(currentShips));
    const currentCharLocs     = JSON.parse(fs.readFileSync(CHAR_LOCATIONS));
    const currentShipLocs     = JSON.parse(fs.readFileSync(SHIP_LOCATIONS));

    const log = [];
    let hasNewUnit = false;

    if (await updateIfChanged({localCachePath: GAMEDATA, dataSourceUri: "http://swgoh-api-stat-calc.glitch.me/gameData.json"})) {
        log.push("Detected a change in Crinolo's Game Data.");
    }
    if (await updateIfChanged({ localCachePath: GG_SHIPS_CACHE, dataSourceUri: "http://api.swgoh.gg/ships/" })) {
        log.push("Detected a change in ships from swgoh.gg");
        hasNewUnit = true;
        await updateShips(currentShips);
    }

    if (await updateIfChanged({ localCachePath: GG_CHAR_CACHE, dataSourceUri: "http://api.swgoh.gg/characters/" })) {
        log.push("Detected a change in characters from swgoh.gg");
        hasNewUnit = true;
        await updateCharacters(currentCharacters);
    }

    // If there are new units, run swgoh api updates for new character similar to `/reloaddata swlang if hasNewUnit is true, then reset it to false after
    if (hasNewUnit) {
        console.log("Running updateGameData");
        await updateGameData();     // Run the stuff to grab all new game data, and update listings in the db
        console.log("Finished running updateGameData");
        hasNewUnit = false;
    }

    const ggModData = await getGgChars();
    if (ggModData && await updateIfChanged({localCachePath: GG_MOD_CACHE, dataObject: ggModData})) {
        log.push("Detected a change in mods from swgoh.gg");
        await updateCharacterMods(currentCharacters, ggModData);
    }

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

    if (JSON.stringify(currentCharSnapshot) !== JSON.stringify(currentCharacters)) {
        log.push("Changes detected in character data, saving updates and reloading");
        saveFile(CHAR_FILE, currentCharacters.sort((a, b) => a.name > b.name ? 1 : -1));
    }
    if (JSON.stringify(currentShipSnapshot) !== JSON.stringify(currentShips)) {
        log.push("Changes detected in ship data, saving updates and reloading");
        saveFile(SHIP_FILE, currentShips.sort((a, b) => a.name > b.name ? 1 : -1));
    }

    if (config.patreon) {
        await updatePatrons();
    }

    return log;
}

async function updateShips(currentShips) {
    const ggShipList = JSON.parse(fs.readFileSync(GG_SHIPS_CACHE));

    for (var ggShipKey in ggShipList) {
        const ggShip = ggShipList[ggShipKey];

        let found = false;
        for (var currentShipKey in currentShips) {
            const currentShip = currentShips[currentShipKey];

            // attempt to match in increasing uniqueness- base_id, url, then name variants
            if (currentShip.uniqueName && currentShip.uniqueName !== UNKNOWN) {
                if (currentShip.uniqueName === ggShip.base_id) {
                    found = true;
                }
            } else if (currentShip.url && currentShip.url !== UNKNOWN) {
                if (ggShip.url === currentShip.url) {
                    found = true;
                }
            } else if (isSameCharacter(currentShip, ggShip)) {
                found = true;
            }

            if (found) {
                let updated = false;

                // character discovered from another source that wasn't yet added to swgoh.gg
                if (!currentShip.url || currentShip.url === UNKNOWN || ggShip.url !== currentShip.url) {
                    console.log("UpdateRemoteData", "Automatically reconciling " + currentShip.name + "'s swgoh.gg url");
                    currentShip.url = ggShip.url;
                    updated = true;
                }
                if (currentShip.uniqueName !== ggShip.base_id) {
                    console.log("UpdateRemoteData", "Automatically reconciling " + currentShip.name + "'s swgoh.gg base_id");
                    currentShip.uniqueName = ggShip.base_id;
                    updated = true;
                }
                if (!isSameCharacter(currentShip, ggShip)) {
                    console.log("UpdateRemoteData", "Automatically reconciling " + currentShip.name + "'s swgoh.gg name variants");
                    if (!currentShip.nameVariant) {
                        currentShip.nameVariant = [];
                    }
                    currentShip.nameVariant.push(ggShip.name);
                    updated = true;
                }
                if (!currentShip.avatarURL || currentShip.avatarURL !== ggShip.image) {
                    console.log("UpdateRemoteData", "Automatically reconciling " + currentShip.name + "'s swgoh.gg image url");
                    currentShip.avatarURL = ggShip.image;
                    updated = true;
                }

                //updated = true; // force an update of everything

                if (updated) {
                    console.log("Updated: " + ggShip.name);
                    currentShip.factions = ggShip.categories;
                    currentShip.side = ggShip.alignment === "Light Side" ? "light" : "dark";
                }
                break;
            }
        }

        if (!found) {
            console.log("Adding: " + ggShip.name);
            console.log("UpdateRemoteData", "New ship discovered from swgoh.gg: " + ggShip.name);
            const newShip = createEmptyShip(ggShip.name, ggShip.url, ggShip.base_id);

            newShip.factions = ggShip.categories;
            newShip.side = ggShip.alignment === "Light Side" ? "light" : "dark";
            newShip.avatarURL = ggShip.image;
            currentShips.push(newShip);
        }
    }
}

function getCleanString(input) {
    const cleanReg = /["()'-\s]/g;

    return input.toLowerCase().replace(cleanReg, "");
}

function isSameCharacter(localChar, remoteChar, nameAttribute) {
    let isSame = false;
    const remoteAttribute = nameAttribute || "name";
    const remoteName = getCleanString(remoteChar[remoteAttribute]);

    if (remoteName === getCleanString(localChar.name)) {
        isSame = true;
    } else {
        if (localChar.nameVariant) {
            for (const key in localChar.nameVariant) {
                const localName = getCleanString(localChar.nameVariant[key]);
                if (remoteName === localName) {
                    isSame = true;
                    break;
                }
            }
        } else {
            localChar.nameVariant = [];
            localChar.nameVariant.push(localChar.name);
        }
    }

    return isSame;
}

async function updateCharacters(currentCharacters) {
    const ggCharList = JSON.parse(fs.readFileSync(GG_CHAR_CACHE));

    for (const ggChar of ggCharList) {
        let found = false;
        for (const currentChar of currentCharacters) {
            // Attempt to match in increasing uniqueness- base_id, url, then name variants
            if (currentChar.uniqueName && currentChar.uniqueName !== UNKNOWN) {
                if (currentChar.uniqueName === ggChar.base_id) {
                    found = true;
                }
            } else if (currentChar.url && currentChar.url !== UNKNOWN) {
                if (ggChar.url === currentChar.url) {
                    found = true;
                }
            } else if (isSameCharacter(currentChar, ggChar)) {
                found = true;
            }

            if (found) {
                let updated = false;

                // character discovered from another source that wasn't yet added to swgoh.gg
                if (!currentChar.url || currentChar.url === UNKNOWN || ggChar.url !== currentChar.url) {
                    console.log("UpdateRemoteData", "Automatically reconciling " + currentChar.name + "'s swgoh.gg url");
                    currentChar.url = ggChar.url;
                    updated = true;
                }
                if (currentChar.uniqueName !== ggChar.base_id) {
                    console.log("UpdateRemoteData", "Automatically reconciling " + currentChar.name + "'s swgoh.gg base_id");
                    currentChar.uniqueName = ggChar.base_id;
                    updated = true;
                }
                if (!isSameCharacter(currentChar, ggChar)) {
                    console.log("UpdateRemoteData", "Automatically reconciling " + currentChar.name + "'s swgoh.gg name variants");
                    if (!currentChar.nameVariant) {
                        currentChar.nameVariant = [];
                    }
                    currentChar.nameVariant.push(ggChar.name);
                    updated = true;
                }
                if (!currentChar.avatarURL || currentChar.avatarURL !== ggChar.image) {
                    console.log("UpdateRemoteData", "Automatically reconciling " + currentChar.name + "'s swgoh.gg image url");
                    currentChar.avatarURL = ggChar.image;
                    updated = true;
                }

                // updated = true; // force an update of everything

                if (updated) {
                    // Some piece of the data needed reconciling, go ahead and request an update from swgoh.gg
                    currentChar.factions = ggChar.categories;
                    currentChar.side = ggChar.alignment === "Light Side" ? "light" : "dark";
                }
                break;
            }
        }

        if (!found) {
            console.log("UpdateRemoteData", "New character discovered from swgoh.gg: " + ggChar.name);
            const newCharacter = createEmptyChar(ggChar.name, ggChar.url, ggChar.base_id);
            newCharacter.factions = ggChar.categories;
            newCharacter.side = ggChar.alignment === "Light Side" ? "light" : "dark";
            newCharacter.avatarURL = ggChar.image;
            currentCharacters.push(newCharacter);
        }
    }
}

async function getGgChars() {
    let response = null;
    try {
        response = await fetch(config.swgohggUrl);
    } catch {
        console.error("Cannot get .gg char/ mod info");
        return null;
    }
    const ggPage = await response.text();

    const modSetCounts = {
        "Crit Chance":     "Critical Chance x2",
        "Crit Damage":     "Critical Damage x4",
        "Critical Chance": "Critical Chance x2",
        "Critical Damage": "Critical Damage x4",
        "Defense":         "Defense x2",
        "Health":          "Health x2",
        "Offense":         "Offense x4",
        "Potency":         "Potency x2",
        "Speed":           "Speed x4",
        "Tenacity":        "Tenacity x2"
    };

    const $ = cheerio.load(ggPage);

    const charOut = [];

    $("table.table-striped > tbody > tr")
        .each((i, elem) => {
            let [name, sets, receiver, holo, data, multiplexer] = $(elem).children();
            // const defId = $(name).find("img").attr("data-base-id");
            const imgUrl =  $(name).find("img").attr("src");
            // const side = $(name).find("div").attr("class").indexOf("light-side") > -1 ? "Light Side" : "Dark Side";
            const [url, modUrl] = $(name).find("a").toArray().map(link => {
                return $(link)?.attr("href")?.trim() || "";
            });
            name = cleanName($(name).text());
            sets = $(sets).find("div").toArray().map(div => {
                return countSet($(div).attr("data-title").trim());
            });
            receiver    = cleanModType($(receiver).text());
            holo        = cleanModType($(holo).text());
            data        = cleanModType($(data).text());
            multiplexer = cleanModType($(multiplexer).text());
            charOut.push({
                name:     name,
                // defId:    defId,
                charUrl:  "https://swgoh.gg" + url,
                image:    imgUrl,
                // side:     side,
                modsUrl:  "https://swgoh.gg" + modUrl, //+ url + "best-mods/",
                mods: {
                    sets:     sets,
                    square:   "Offense",
                    arrow:    receiver,
                    diamond:  "Defense",
                    triangle: holo,
                    circle:   data,
                    cross:    multiplexer
                }
            });
        });

    // Clean up the mod names (Wipe out extra spaces or condense long names)
    function cleanModType(types) {
        if (!types || typeof types !== "string") return null;
        return types.trim()
            .replace(/\s+\/\s/g, "/ ")
            .replace("Critical Damage", "Crit. Damage")
            .replace("Critical Chance", "Crit. Chance");
    }

    // This is mainly to clean up Padme's name for now
    function cleanName(name) {
        if (!name || typeof name !== "string") return;
        return name.trim().replace("é", "e");
    }

    // Put the number of mods for each set
    function countSet(setName) {
        return modSetCounts[setName] || setName;
    }
    return charOut;
}

async function updateCharacterMods(currentCharacters, freshMods) {
    const GG_SOURCE = "swgoh.gg";

    // Iterate the data from swgoh.gg, put new mods in as needed, and if there's a new character, put them in too
    for (const character of freshMods) {
        let thisChar = currentCharacters.find(ch =>
            ch.uniqueName === character.defId ||
            getCleanString(ch.name) === getCleanString(character.name) ||
            ch.url === character.charUrl
        );
        if (!thisChar) {
            thisChar = currentCharacters.find(ch => ch.aliases.includes(character.name));
        }
        const mods = {
            url:      character.modsUrl,
            sets:     character.mods.sets,
            square:   character.mods.square,
            arrow:    character.mods.arrow,
            diamond:  character.mods.diamond,
            triangle: character.mods.triangle,
            circle:   character.mods.circle,
            cross:    character.mods.cross,
            source:   GG_SOURCE
        };

        if (thisChar) {
            thisChar.mods = mods;
        } else {
            // This shouldn't really happen since it should be caught in updateCharacters
            console.log(`[DataUpdater] (updateCharacterMods) New character discovered: ${character.name} (${character.defId})\n${character}`);
        }
    }
}

function createEmptyChar(name, url, uniqueName) {
    console.log(`Creating empty char for: ${name} (${uniqueName})`);
    return {
        "name":        name,
        "uniqueName":  uniqueName,
        "aliases":     [name], // common community names
        "nameVariant": [name], // names used by remote data sources, for unique matches
        "url":         url,
        "avatarURL":   "",
        "side":        "",
        "factions":    [],
        "mods":        {}
    };
}

function createEmptyShip(name, url, uniqueName) {
    console.log(`Creating empty ship for: ${name} (${uniqueName})`);
    return {
        "name":        name,
        "uniqueName":  uniqueName,
        "aliases":     [name], // common community names
        "nameVariant": [name], // names used by remote data sources, for unique matches
        "crew":        [],
        "url":         url,
        "avatarURL":   "",
        "side":        "",
        "factions":    [],
        "abilities":   {}
    };
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
        const meta = await comlinkStub.getMetaData();
        const gameData = await comlinkStub.getGameData(meta.latestGamedataVersion, false);

        locales = await getLocalizationData(meta.latestLocalizationBundleVersion);

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
            console.log(`Finished localizing ${dbTarget} for ${lang}`);
        }
        console.log(`Finished localizing ${dbTarget}`);
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
        await fs.writeFileSync(__dirname + "/../data/skillMap.json", JSON.stringify(skillMap), {encoding: "utf-8"});
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
        await fs.writeFileSync(__dirname + "/../data/modMap.json", JSON.stringify(modsOut), {encoding: "utf-8"});
    }

    async function processRecipes(recipeIn) {
        const mappedRecipeList = recipeIn.map(recipe => {
            return {
                id: recipe.id,
                descKey: recipe.descKey,
                ingredients: recipe.ingredients
            };
        });
        await processLocalization(mappedRecipeList, "recipes", ["descKey"], "id", ["eng_us"]);
    }

    async function processUnits(unitsIn) {
        const filteredList = unitsIn.filter(unit => {
            if (unit.rarity !== 7 || !unit.obtainable || (unit.obtainableTime !== 0 && unit.obtainableTime !== "0")) return false;
            return true;
        }).map(unit => {
            return {
                baseId: unit.baseId,
                nameKey: unit.nameKey,
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

        // Pass in a copy of the list so nothing gets altered that would be needed later
        // This will convert everything to the format we're used to in the characters db table
        await unitsToCharacter(JSON.parse(JSON.stringify(filteredList)));
        // Then send the list to be processed
        await processLocalization(filteredList, "units", ["nameKey"], "baseId", null);
        // Then send a copy through for the unitMap to help format player rosters
        await unitsToUnitMap(filteredList);
    }

    async function unitsToCharacter(unitsIn) {
        // Process the units list to go into the characters db table
        const catList = ["alignment", "profession", "affiliation", "role", "shipclass"];
        const factionMap = {
            bountyhunter : "bounty hunter",
            cargoship    : "cargo ship",
            light        : "light side",
            dark         : "dark side"
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
                    if (factionMap[faction]) faction = factionMap[faction];
                    faction = faction.replace(/s$/, "");
                    unit.factions.push(faction);
                }
            });
            delete unit.categoryIdList;
            unit.crew = [];
            if (unit.crewList.length) {
                for (const crewChar of unit.crewList) {
                    unit.crew.push(crewChar.unitId);
                    unit.skillReferenceList = unit.skillReferenceList.concat(crewChar.skillReference);
                }
            }
            delete unit.crewList;
            await cache.put(config.mongodb.swapidb, "characters", {baseId: unit.baseId}, unit);
        }
    }

    async function unitsToUnitMap(unitsIn) {
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

        await fs.writeFileSync(__dirname + "/../data/unitMap.json", JSON.stringify(unitsOut), {encoding: "utf-8"});
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






