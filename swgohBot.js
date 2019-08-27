const { Client, Collection } = require("discord.js");
const { promisify } = require("util");
const { inspect } = require("util");
const readdir = promisify(require("fs").readdir);
const fs = require("fs");
const snekfetch = require("snekfetch");
const cheerio = require("cheerio");

const client = new Client({
    // https://discord.js.org/#/docs/main/stable/typedef/ClientOptions?scrollTo=messageCacheLifetime
    messageCacheLifetime: 300, // How long a message should stay in the cache       (5min)
    messageSweepInterval: 120  // How frequently to remove messages from the cache  (2min)
});

const Sequelize = require("sequelize");

const Bot = {};

// Attach the config to the client so we can use it anywhere
Bot.config = require("./config.js");

// Attach the character and team files to the Bot so I don't have to reopen em each time
Bot.abilityCosts = JSON.parse(fs.readFileSync("data/abilityCosts.json"));
Bot.characters   = JSON.parse(fs.readFileSync("data/characters.json"));
Bot.charLocs     = JSON.parse(fs.readFileSync("data/charLocations.json"));
Bot.factions     = [...new Set(Bot.characters.reduce((a, b) => a.concat(b.factions), []))];
Bot.ships        = JSON.parse(fs.readFileSync("data/ships.json"));
Bot.shipLocs     = JSON.parse(fs.readFileSync("data/shipLocations.json"));
Bot.squads       = JSON.parse(fs.readFileSync("data/squads.json"));
Bot.missions     = JSON.parse(fs.readFileSync("data/missions.json"));
Bot.resources    = JSON.parse(fs.readFileSync("data/resources.json"));
Bot.arenaJumps   = JSON.parse(fs.readFileSync("data/arenaJumps.json"));
Bot.acronyms     = JSON.parse(fs.readFileSync("data/acronyms.json"));
Bot.patrons      = [];
Bot.emotes       = {};

const RANCOR_MOD_CACHE       = "./data/crouching-rancor-mods.json";
const GG_CHAR_CACHE          = "./data/swgoh-gg-chars.json";
const GG_SHIPS_CACHE         = "./data/swgoh-gg-ships.json";
const SWGoH_Help_SQUAD_CACHE = "./data/squads.json";
const CHARLOCATIONS          = "./data/charLocations.json";
const SHIPLOCATIONS          = "./data/shipLocations.json";
const UNKNOWN                = "Unknown";

require("./modules/functions.js")(Bot, client);
require("./modules/prototypes.js");

// Languages
Bot.languages = {};
client.reloadLanguages();
Bot.swgohLangList = ["ENG_US", "GER_DE", "SPA_XM", "FRE_FR", "RUS_RU", "POR_BR", "KOR_KR", "ITA_IT", "TUR_TR", "CHS_CN", "CHT_CN", "IND_ID", "JPN_JP", "THA_TH"];

client.commands = new Collection();
client.aliases = new Collection();

Bot.evCountdowns = {};

Bot.talkedRecently = new Set();

Bot.seqOps = Sequelize.Op;
Bot.database = new Sequelize(
    Bot.config.database.data,
    Bot.config.database.user,
    Bot.config.database.pass, {
        host: Bot.config.database.host,
        dialect: "postgres",
        logging: false
    }
);


Bot.database.authenticate().then(async () => {
    await require("./modules/models")(Sequelize, Bot.database);


    // Get all the models
    const rawAttr = Bot.database.models.settings.rawAttributes;
    const rawNames = Object.keys(rawAttr);

    // Got through them all
    for (let ix = 0; ix < rawNames.length; ix++) {
        // Try getting each column
        await Bot.database.models.settings.findAll({limit: 1, attributes: [rawNames[ix]]})
        // If it doesn't exist, it'll throw an error, then it will add them
            .catch(async () => {
                console.log("Adding column " + rawNames[ix] + " to settings.");
                await Bot.database.queryInterface.addColumn("settings",
                    rawAttr[rawNames[ix]].fieldName,
                    {
                        type: rawAttr[rawNames[ix]].type,
                        defaultValue: rawAttr[rawNames[ix]].defaultValue !== null ? rawAttr[rawNames[ix]].defaultValue : null
                    }
                );
            });
    }

    init();
    client.login(Bot.config.token).then(() => {
        const guildList = client.guilds.keyArray();
        for (let ix = 0; ix < guildList.length; ix++) {
            Bot.database.models.settings.findOrBuild({
                where: {
                    guildID: guildList[ix]
                }
            }).spread((gModel, initialized) => {
                if (initialized) {
                    return gModel.save();
                }
            }).catch((e) =>  console.log("Error: " + e));
        }
    }).catch((e) => console.error(e));
});

const init = async () => {
    const MongoClient = require("mongodb").MongoClient;
    Bot.mongo = await MongoClient.connect(Bot.config.mongodb.url, { useNewUrlParser: true, useUnifiedTopology: true } );
    // Set up the caching
    Bot.cache = await require("./modules/cache.js")(Bot.mongo);
    Bot.userReg = await require("./modules/users.js")(Bot);

    Bot.swgohPlayerCount = await Bot.mongo.db(Bot.config.mongodb.swapidb).collection("players").find({}).count();
    Bot.swgohGuildCount  = await Bot.mongo.db(Bot.config.mongodb.swapidb).collection("guilds").find({}).count();

    if (Bot.config.api_swgoh_help) {
        // Load up the api connector/ helpers
        const SwgohHelp = require("api-swgoh-help");
        Bot.swgoh = new SwgohHelp(Bot.config.api_swgoh_help);
        Bot.swgohAPI = require("./modules/swapi.js")(Bot);

        // Load up the zeta recommendstions
        Bot.zetaRec = await Bot.swgohAPI.zetaRec();
    }

    // Here we load **commands** into memory, as a collection, so they're accessible
    // here and everywhere else.
    const cmdFiles = await readdir("./commands/");
    cmdFiles.forEach(f => {
        try {
            const props = new(require(`./commands/${f}`))(Bot);
            if (f.split(".").slice(-1)[0] !== "js") return;
            if (props.help.category === "SWGoH" && !Bot.swgohAPI) return;
            client.loadCommand(props.help.name);
        } catch (e) {
            Bot.log("Init", `Unable to load command ${f}: ${e}`);
        }
    });

    if (Bot.config.patreon) {
        // Reload any patrons
        await Bot.reloadPatrons();
        setInterval(Bot.reloadPatrons,  1 * 60 * 1000);   // Then every min after
    }

    // Then we load events, which will include our message and ready event.
    const evtFiles = await readdir("./events/");
    evtFiles.forEach(file => {
        const eventName = file.split(".")[0];
        const event = require(`./events/${file}`);
        if (eventName === "ready") {
            client.on(eventName, event.bind(null, Bot, client));
        } else {
            client.on(eventName, event.bind(null, Bot));
        }
        delete require.cache[require.resolve(`./events/${file}`)];
    });
};

client.on("error", (err) => {
    if (err.error.toString().indexOf("ECONNRESET") > -1) {
        console.log("Connection error");
    } else {
        Bot.log("ERROR", inspect(err.error));
    }
});


// Make it so it only checks for new characters on the main shard
if (!client.shard || client.shard.id === 0) {
    // Here down is to update any characters that need it
    setTimeout(updateRemoteData,        1 * 60 * 1000);  // Run it a min after start
    setInterval(updateRemoteData, 12 * 60 * 60 * 1000);  // Then every 12 hours after
    //                            hr   min  sec  mSec
} else {
    // To reload the characters on any shard other than the main one
    // a bit after it would have grabbed new ones
    setTimeout(function() {
        setInterval(function() {
            delete Bot.characters;
            Bot.characters = JSON.parse(fs.readFileSync("data/characters.json"));
        }, 12 * 60 * 60 * 1000);
    }, 2 * 60 * 1000);
}

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
        console.log("UpdateRemoteData", "Fetching " + dataSourceUri);
        const remoteResponse = await snekfetch.get(dataSourceUri);
        const remoteData = JSON.parse(remoteResponse.text);

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

    const currentCharacters = Bot.characters;
    const currentCharSnapshot = JSON.stringify(currentCharacters);

    const currentShips = Bot.ships;
    const currentShipSnapshot = JSON.stringify(currentShips);

    console.log("UpdateRemoteData", "Checking for updates to remote data sources");
    if (await updateIfChanged(GG_SHIPS_CACHE, "https://swgoh.gg/api/ships/?format=json")) {
        console.log("UpdateRemoteData", "Detected a change in ships from swgoh.gg");
        await updateShips(currentShips);
    }

    if (await updateIfChanged(GG_CHAR_CACHE, "https://swgoh.gg/api/characters/?format=json")) {
        console.log("UpdateRemoteData", "Detected a change in characters from swgoh.gg");
        // TODO - periodic forced updates to adopt updated minor changes?
        await updateCharacters(currentCharacters);
    }

    if (await updateIfChanged(RANCOR_MOD_CACHE, "http://apps.crouchingrancor.com/mods/advisor.json")) {
        console.log("UpdateRemoteData", "Detected a change in mods from Crouching Rancor");
        await updateCharacterMods(currentCharacters);
    }

    if (await updateIfChanged(SWGoH_Help_SQUAD_CACHE, "https://swgoh.help/data/squads.json")) {
        console.log("UpdatedRemoteData", "Detected a squad change from swgoh.help.");
    }

    if (await updateIfChanged(CHARLOCATIONS, "https://script.google.com/macros/s/AKfycbxyzFyyOZvHyLcQcfR6ee8TAJqeuqst7Y-O-oSMNb2wlcnYFrs/exec?isShip=false")) {
        console.log("UpdatedRemoteData", "Detected a change in character locations.");
    }

    if (await updateIfChanged(SHIPLOCATIONS, "https://script.google.com/macros/s/AKfycbxyzFyyOZvHyLcQcfR6ee8TAJqeuqst7Y-O-oSMNb2wlcnYFrs/exec?isShip=true")) {
        console.log("UpdatedRemoteData", "Detected a change in ship locations.");
    }

    console.log("UpdateRemoteData", "Finished processing remote updates");
    if (currentCharSnapshot !== JSON.stringify(currentCharacters)) {
        console.log("UpdateRemoteData", "Changes detected in character data, saving updates and reloading");
        saveFile("./data/characters.json", currentCharacters.sort((a, b) => a.name > b.name ? 1 : -1));
        Bot.characters = currentCharacters;
    }
    if (currentShipSnapshot !== JSON.stringify(currentShips)) {
        console.log("UpdateRemoteData", "Changes detected in ship data, saving updates and reloading");
        saveFile("./data/ships.json", currentShips.sort((a, b) => a.name > b.name ? 1 : -1));
        Bot.ships = currentShips;
    }
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
                    // some piece of the data needed reconciling, go ahead and request an update from swgoh.gg
                    // await ggShipGrab(currentShip);
                }
                break;
            }
        }

        if (!found) {
            console.log("Adding: " + ggShip.name);
            console.log("UpdateRemoteData", "New ship discovered from swgoh.gg: " + ggShip.name);
            const newShip = createEmptyShip(ggShip.name, ggShip.url, ggShip.base_id);

            currentShips.push(newShip);

            // queue an update to fill in the empty character's details from swgoh.gg
            // await ggShipGrab(newCharacter);
        }
    }
}

function getCleanString(input) {
    const cleanReg = /['-\s]/g;

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

    for (var ggCharKey in ggCharList) {
        const ggChar = ggCharList[ggCharKey];
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

                // Updated = true; // force an update of everything

                if (updated) {
                    // Some piece of the data needed reconciling, go ahead and request an update from swgoh.gg
                    await ggGrab(currentChar);
                }
                break;
            }
        }

        if (!found) {
            console.log("UpdateRemoteData", "New character discovered from swgoh.gg: " + ggChar.name);
            const newCharacter = createEmptyChar(ggChar.name, ggChar.url, ggChar.base_id);

            currentCharacters.push(newCharacter);

            // Queue an update to fill in the empty character's details from swgoh.gg
            await ggGrab(newCharacter);
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

        // iterate all known characters to find a match
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

            // async fetch character information from swgoh.gg
            await ggGrab(newCharacter);
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

async function ggGrab(character) {
    console.log("ggGrab", "Fetching: \"" + character.url + "\"");
    const charGrab = await snekfetch.get(character.url);
    const ggGrabText = charGrab.text;

    const $ = cheerio.load(ggGrabText);

    // Get the character's image link
    const charImage = "https:" + $(".panel-profile-img").attr("src");
    character.avatarURL = charImage;

    // Get the character's affiliations
    let affiliations = [];
    $(".panel-body").each(function() {
        if ($(this).find("h5").text().indexOf("Affiliations") !== -1) {
            affiliations = $(this).text().split("\n").slice(2, -1);  // Splice to get the blank and  the header out
            character.factions = affiliations;
            if (affiliations.indexOf("Light Side") !== -1) {
                character.side = "light";
                affiliations.splice(affiliations.indexOf("Light Side"), 1);
            } else {
                character.side = "dark";
                affiliations.splice(affiliations.indexOf("Dark Side"), 1);
            }
        }
    });
    console.log("ggGrab", "Finished fetching swgoh.gg data for " + character.name);
}

