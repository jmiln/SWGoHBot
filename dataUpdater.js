const fs = require("fs");
const fetch = require("node-fetch");

const config = require("./config.js");
const MongoClient = require("mongodb").MongoClient;

const RANCOR_MOD_CACHE       = "./data/crouching-rancor-mods.json";
const GG_CHAR_CACHE          = "./data/swgoh-gg-chars.json";
const GG_SHIPS_CACHE         = "./data/swgoh-gg-ships.json";
const SWGoH_Help_SQUAD_CACHE = "./data/squads.json";
const CHARLOCATIONS          = "./data/charLocations.json";
const SHIPLOCATIONS          = "./data/shipLocations.json";
const GAMEDATA               = "./data/gameData.json";
const UNKNOWN                = "Unknown";

const INTERVAL = 5;

console.log(`Starting data updater, set to run every ${INTERVAL} minutes.`);

setInterval(async () => {
    const time = new Date().toString().split(" ").slice(1, 5);
    const log = await updateRemoteData();
    if (log && log.length) {
        console.log(`Ran updater - ${time[0]} ${time[1]}, ${time[2]} - ${time[3]}`);
        console.log(log.join("\n"));
    }
}, INTERVAL * 60 * 1000);

function getModType(type) {
    switch (type) {
        case "CC":
            return "Critical Chance x2";
        case "CD":
            return "Critical Damage x4";
        case "SPE":
            return "Speed x4";
        case "TEN":
            return "Tenacity x2";
        case "OFF":
            return "Offense x4";
        case "POT":
            return "Potency x2";
        case "HP":
            return "Health x2";
        case "DEF":
            return "Defense x2";
        default:
            return "";
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

async function updateIfChanged(localCachePath, dataSourceUri) {
    let updated = false;

    let localCache = {};

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

        if (JSON.stringify(remoteData) !== JSON.stringify(localCache)) {
            saveFile(localCachePath, remoteData);
            updated = true;
        }
    } catch (err) {
        const reason = err || "unknown error";
        return console.log("UpdateRemoteData", "Unable to update cache for " + dataSourceUri + ", reason: " + reason);
    }

    return updated;
}

async function updateRemoteData() {
    // TODO potentially leverage REST end point for google doc farming location spreadsheet (if more accurate / current than swgoh.gg?)
    // https://docs.google.com/spreadsheets/d/1Z0mOMyCctmxXWEU1cLMlDMRDUdw1ocBmWh4poC3RVXg/htmlview#

    const currentCharacters   = require("./data/characters.json");
    const currentCharSnapshot = JSON.parse(JSON.stringify(currentCharacters));
    const currentShips        = require("./data/ships.json");
    const currentShipSnapshot = JSON.parse(JSON.stringify(currentShips));
    const log = [];

    // console.log("UpdateRemoteData", "Checking for updates to remote data sources");
    if (await updateIfChanged(GAMEDATA, "https://swgoh-stat-calc.glitch.me/gameData.json")) {
        log.push("Detected a change in Crinolo's Game Data.");
    }
    if (await updateIfChanged(GG_SHIPS_CACHE, "https://swgoh.gg/api/ships/?format=json")) {
        log.push("Detected a change in ships from swgoh.gg");
        await updateShips(currentShips);
    }

    if (await updateIfChanged(GG_CHAR_CACHE, "https://swgoh.gg/api/characters/?format=json")) {
        log.push("Detected a change in characters from swgoh.gg");
        await updateCharacters(currentCharacters);
    }

    if (await updateIfChanged(RANCOR_MOD_CACHE, "http://apps.crouchingrancor.com/mods/advisor.json")) {
        log.push("Detected a change in mods from Crouching Rancor");
        await updateCharacterMods(currentCharacters);
    }

    if (await updateIfChanged(SWGoH_Help_SQUAD_CACHE, "https://swgoh.help/data/squads.json")) {
        log.push("Detected a squad change from swgoh.help.");
    }

    if (await updateIfChanged(CHARLOCATIONS, "https://script.google.com/macros/s/AKfycbxyzFyyOZvHyLcQcfR6ee8TAJqeuqst7Y-O-oSMNb2wlcnYFrs/exec?isShip=false")) {
        log.push("Detected a change in character locations.");
    }

    if (await updateIfChanged(SHIPLOCATIONS, "https://script.google.com/macros/s/AKfycbxyzFyyOZvHyLcQcfR6ee8TAJqeuqst7Y-O-oSMNb2wlcnYFrs/exec?isShip=true")) {
        log.push("Detected a change in ship locations.");
    }

    if (JSON.stringify(currentCharSnapshot) !== JSON.stringify(currentCharacters)) {
        log.push("Changes detected in character data, saving updates and reloading");
        saveFile("./data/characters.json", currentCharacters.sort((a, b) => a.name > b.name ? 1 : -1));
    }
    if (JSON.stringify(currentShipSnapshot) !== JSON.stringify(currentShips)) {
        log.push("Changes detected in ship data, saving updates and reloading");
        saveFile("./data/ships.json", currentShips.sort((a, b) => a.name > b.name ? 1 : -1));
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

                //updated = true; // force an update of everything

                if (updated) {
                    console.log("Updated: " + ggShip.name);
                    currentShip.factions = ggShip.categories;
                    currentShip.side = ggShip.alignment === "Light Side" ? "light" : "dark";
                    currentShip.avatarURL = "https://swgoh.gg" + ggShip.image;
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
            newShip.avatarURL = "https://swgoh.gg" + ggShip.image;
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

                updated = true; // force an update of everything

                if (updated) {
                    // Some piece of the data needed reconciling, go ahead and request an update from swgoh.gg
                    currentChar.factions = ggChar.categories;
                    currentChar.side = ggChar.alignment === "Light Side" ? "light" : "dark";
                    currentChar.avatarURL = "https://swgoh.gg" + ggChar.image;
                }
                break;
            }
        }

        if (!found) {
            console.log("UpdateRemoteData", "New character discovered from swgoh.gg: " + ggChar.name);
            const newCharacter = createEmptyChar(ggChar.name, ggChar.url, ggChar.base_id);
            newCharacter.factions = ggChar.categories;
            newCharacter.side = ggChar.alignment === "Light Side" ? "light" : "dark";
            newCharacter.avatarURL = "https://swgoh.gg" + ggChar.image;
            currentCharacters.push(newCharacter);
        }
    }
}

async function updateCharacterMods(currentCharacters) {
    const rancorFile = fs.readFileSync(RANCOR_MOD_CACHE);
    const rancorData = JSON.parse(rancorFile);
    const rancorCharacterList = rancorData.data;
    const RANCOR_SOURCE = "Crouching Rancor";

    // Clear out old crouching rancor mod advice
    currentCharacters.forEach(currentChar => {
        for (var thisSet in currentChar.mods) {
            const set = currentChar.mods[thisSet];
            if (set.source === RANCOR_SOURCE) {
                delete currentChar.mods[thisSet];
            }
        }
    });

    // Iterate the crouching rancor data (may contain currently unknown characters)
    for (var rancorCharKey in rancorCharacterList) {
        const rancorChar = rancorCharacterList[rancorCharKey];

        // skip garbage data
        if (typeof rancorChar.cname === "undefined") return;

        let found = false;

        const modObject = {
            "sets": [
                getModType(rancorChar.set1),
                getModType(rancorChar.set2),
                getModType(rancorChar.set3)
            ],
            // Take out the space behind any slashes
            "square": rancorChar.square.replace(/\s+\/\s/g, "/ "),
            "arrow": rancorChar.arrow.replace(/\s+\/\s/g, "/ "),
            "diamond": rancorChar.diamond.replace(/\s+\/\s/g, "/ "),
            "triangle": rancorChar.triangle.replace(/\s+\/\s/g, "/ "),
            "circle": rancorChar.circle.replace(/\s+\/\s/g, "/ "),
            "cross": rancorChar.cross.replace(/\s+\/\s/g, "/ "),
            "source": RANCOR_SOURCE
        };

        let setName = "";
        if (rancorChar.name.includes(rancorChar.cname)) {
            setName = rancorChar.name.split(" ").splice(rancorChar.cname.split(" ").length).join(" ");
            if (setName === "") {
                setName = "General";
            }
        } else {
            setName = rancorChar.name;
        }

        // Make a guess at the character URL in case of poor matchup to swgoh.gg's API by name
        let charLink = "https://swgoh.gg/characters/";
        const linkName = rancorChar.cname.replace(/[^\w\s-]+/g, "");  // Get rid of non-alphanumeric characters besides dashes
        charLink += linkName.replace(/\s+/g, "-").toLowerCase();  // Get rid of extra spaces, and format em to be dashes
        charLink += "/"; // add trailing slash to be consistent with swgoh.gg's conventions

        // Iterate all known characters to find a match
        currentCharacters.forEach(currentChar => {
            if (isSameCharacter(currentChar, rancorChar, "cname") ||
                    (currentChar.url && currentChar.url !== UNKNOWN && currentChar.url === charLink)) {
                found = true;

                if (currentChar.mods[setName]) {
                    setName = rancorChar.name;
                }
                currentChar.mods[setName] = modObject;
            }
        });
        if (!found) {
            // create a new character
            console.log("UpdateRemoteData", "New character discovered from crouching rancor: " + rancorChar.cname);
            const newCharacter = createEmptyChar(rancorChar.cname, charLink, UNKNOWN);

            newCharacter.mods[setName] = modObject;

            currentCharacters.push(newCharacter);
        }
    }
}

function createEmptyChar(name, url, uniqueName) {
    return {
        "name": name,
        "uniqueName": uniqueName,
        "aliases": [name], // common community names
        "nameVariant": [name], // names used by remote data sources, for unique matches
        "url": url,
        "avatarURL": "",
        "side": "",
        "factions": [],
        "mods": {
        }
    };
}

function createEmptyShip(name, url, uniqueName) {
    return {
        "name": name,
        "uniqueName": uniqueName,
        "aliases": [name], // common community names
        "nameVariant": [name], // names used by remote data sources, for unique matches
        "crew": [],
        "url": url,
        "avatarURL": "",
        "side": "",
        "factions": [],
        "abilities": {
        }
    };
}

async function updatePatrons() {
    const patreon = config.patreon;
    if (!patreon) {
        return;
    }
    const mongo = await MongoClient.connect(config.mongodb.url, { useNewUrlParser: true, useUnifiedTopology: true } );
    const cache = await require("./modules/cache.js")(mongo);
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
