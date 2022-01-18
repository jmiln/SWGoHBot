const fs = require("fs");
const fetch = require("node-fetch");
const cheerio = require("cheerio");

const config = require("../config.js");
const MongoClient = require("mongodb").MongoClient;

const GG_CHAR_CACHE          = "../data/swgoh-gg-chars.json";
const GG_SHIPS_CACHE         = "../data/swgoh-gg-ships.json";
const GG_MOD_CACHE           = "../data/swgoh-gg-mods.json";
const SWGOH_HELP_SQUAD_CACHE = "../data/squads.json";
const CHARLOCATIONS          = "../data/charLocations.json";
const SHIPLOCATIONS          = "../data/shipLocations.json";
const GAMEDATA               = "../data/gameData.json";
const UNKNOWN                = "Unknown";

const crinoloLocs = "https://script.google.com/macros/s/AKfycbxyzFyyOZvHyLcQcfR6ee8TAJqeuqst7Y-O-oSMNb2wlcnYFrs/exec?isShip=";
const charLocationLink = config.locations?.char ? config.locations.char : crinoloLocs + "false";
const shipLocationLink = config.locations?.ship ? config.locations.ship : crinoloLocs + "true";


// How long between being runs (In minutes)
const INTERVAL = 60;
console.log(`Starting data updater, set to run every ${INTERVAL} minutes.`);

// Run the upater when it's started, then every ${INTERVAL} minutes after that
runUpdater();
setInterval(async () => {
    await runUpdater();
}, INTERVAL * 60 * 1000);

async function runUpdater() {
    const time = new Date().toString().split(" ").slice(1, 5);
    const log = await updateRemoteData();
    if (log && log.length) {
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
            console.log(err);
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
    const currentCharacters   = require("../data/characters.json");
    const currentCharSnapshot = JSON.parse(JSON.stringify(currentCharacters));
    const currentShips        = require("../data/ships.json");
    const currentShipSnapshot = JSON.parse(JSON.stringify(currentShips));
    const log = [];

    // Disabled for now since glitch shut it down temporarily
    // if (await updateIfChanged(GAMEDATA, "https://swgoh-stat-calc.glitch.me/gameData.json")) {
    if (await updateIfChanged({localCachePath: GAMEDATA, dataSourceUri: "http://swgoh-api-stat-calc.glitch.me/gameData.json"})) {
        log.push("Detected a change in Crinolo's Game Data.");
    }
    if (await updateIfChanged({ localCachePath: GG_SHIPS_CACHE, dataSourceUri: "https://swgoh.gg/api/ships/?format=json" })) {
        log.push("Detected a change in ships from swgoh.gg");
        await updateShips(currentShips);
    }

    if (await updateIfChanged({ localCachePath: GG_CHAR_CACHE, dataSourceUri: "https://swgoh.gg/api/characters/?format=json" })) {
        log.push("Detected a change in characters from swgoh.gg");
        await updateCharacters(currentCharacters);
    }

    const ggModData = await getGgChars();
    if (await updateIfChanged({localCachePath: GG_MOD_CACHE, dataObject: ggModData})) {
        log.push("Detected a change in mods from swgoh.gg");
        await updateCharacterMods(currentCharacters, ggModData);
    }

    if (await updateIfChanged({ localCachePath: SWGOH_HELP_SQUAD_CACHE, dataSourceUri: "https://swgoh.help/data/squads.json" })) {
        log.push("Detected a squad change from swgoh.help.");
    }

    if (await updateIfChanged({ localCachePath: CHARLOCATIONS, dataSourceUri: charLocationLink })) {
        log.push("Detected a change in character locations.");
    }

    if (await updateIfChanged({ localCachePath: SHIPLOCATIONS, dataSourceUri: shipLocationLink })) {
        log.push("Detected a change in ship locations.");
    }

    if (JSON.stringify(currentCharSnapshot) !== JSON.stringify(currentCharacters)) {
        log.push("Changes detected in character data, saving updates and reloading");
        saveFile("../data/characters.json", currentCharacters.sort((a, b) => a.name > b.name ? 1 : -1));
    }
    if (JSON.stringify(currentShipSnapshot) !== JSON.stringify(currentShips)) {
        log.push("Changes detected in ship data, saving updates and reloading");
        saveFile("../data/ships.json", currentShips.sort((a, b) => a.name > b.name ? 1 : -1));
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

    for (var ggChar of ggCharList) {
        let found = false;
        for (var currentCharKey in currentCharacters) {
            const currentChar = currentCharacters[currentCharKey];

            // attempt to match in increasing uniqueness- base_id, url, then name variants
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

                updated = true; // force an update of everything

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
    const response = await fetch("https://swgoh.gg/stats/mod-meta-report/guilds_100_gp/");
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

    $("body > div.container.p-t-md > div.content-container > div.content-container-primary.character-list > ul > li:nth-child(3) > table > tbody > tr")
        .each((i, elem) => {
            let [name, sets, receiver, holo, data, multiplexer] = $(elem).children();
            const defId = $(name).find("img").attr("data-base-id");
            const imgUrl =  $(name).find("img").attr("src");
            const side = $(name).find("div").attr("class").indexOf("light-side") > -1 ? "Light Side" : "Dark Side";
            const [url, modUrl] = $(name).find("a").toArray().map(link => {
                return $(link).attr("href").trim();
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
                defId:    defId,
                charUrl:  "https://swgoh.gg" + url,
                image:    imgUrl,
                side:     side,
                modsUrl:  "https://swgoh.gg" + modUrl,
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
        const thisChar = currentCharacters.find(ch => ch.uniqueName === character.defId);
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
            console.log(`[DataUpdater] (updateCharacterMods) New character discovered: ${character.name} (${character.defId})`);
            const newCharacter = createEmptyChar(character.name, character.url, character.defId);

            newCharacter.mods = mods;
            newCharacter.avatarURL = character.imgUrl;
            newCharacter.side = character.side;

            currentCharacters.push(newCharacter);
        }
    }
}

function createEmptyChar(name, url, uniqueName) {
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
    const mongo = await MongoClient.connect(config.mongodb.url, { useNewUrlParser: true, useUnifiedTopology: true } );
    const cache = require("../modules/cache.js")(mongo);
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

            const data = response.data;
            const included = response.included;

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

