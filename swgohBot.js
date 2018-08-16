const { Client, Collection } = require('discord.js');
const { promisify } = require("util");
const { inspect } = require("util");
const readdir = promisify(require("fs").readdir);
const client = new Client();
const fs = require("fs");
const snekfetch = require('snekfetch');
const cheerio = require('cheerio');

const Sequelize = require('sequelize');

// Attach the config to the client so we can use it anywhere
client.config = require('./config.js');

// Attach the character and team files to the client so I don't have to reopen em each time
client.characters = JSON.parse(fs.readFileSync("data/characters.json"));
client.ships = JSON.parse(fs.readFileSync("data/ships.json"));
// client.teams = JSON.parse(fs.readFileSync("data/teams.json"));
client.squads = JSON.parse(fs.readFileSync("data/squads.json"));
client.resources = JSON.parse(fs.readFileSync("data/resources.json"));
client.patrons = [];
const RANCOR_MOD_CACHE = "./data/crouching-rancor-mods.json";
const GG_CHAR_CACHE = "./data/swgoh-gg-chars.json";
const GG_SHIPS_CACHE = "./data/swgoh-gg-ships.json";
const SWGoH_Help_SQUAD_CACHE = "./data/squads.json";
const UNKNOWN = "Unknown";

require("./modules/functions.js")(client);

// Languages
client.languages = {};
client.reloadLanguages();

client.commands = new Collection();
client.aliases = new Collection();

client.evCountdowns = {};

client.database = new Sequelize(client.config.database.data, client.config.database.user, client.config.database.pass, {
    host: client.config.database.host,
    dialect: 'postgres',
    logging: false,
    operatorAliases: false
});


client.database.authenticate().then(async () => {
    await require('./modules/models')(Sequelize, client.database);

    // Get all the models
    const rawAttr = client.database.models.settings.rawAttributes;
    const rawNames = Object.keys(rawAttr);

    // Got through them all
    for (let ix = 0; ix < rawNames.length; ix++) {
        // Try getting each column
        await client.database.models.settings.findAll({limit: 1, attributes: [rawNames[ix]]})
        // If it doesn't exist, it'll throw an error, then it will add them
            .catch(async () => {
                console.log('Adding column ' + rawNames[ix] + ' to settings.');
                await client.database.queryInterface.addColumn('settings',
                    rawAttr[rawNames[ix]].fieldName,
                    {
                        type: rawAttr[rawNames[ix]].type,
                        defaultValue: rawAttr[rawNames[ix]].defaultValue !== null ? rawAttr[rawNames[ix]].defaultValue : null
                    }
                );
            });
    }

    init();
    client.login(client.config.token).then(() => {
        const guildList = client.guilds.keyArray();
        for (let ix = 0; ix < guildList.length; ix++) {
            client.database.models.settings.findOrBuild({
                where: {
                    guildID: guildList[ix]
                }
            }).spread((gModel, initialized) => {
                if (initialized) {
                    return gModel.save();
                }
            }).catch((e) =>  console.log('Error: ' + e));
        }
    }).catch((e) => console.error(e));
});

const init = async () => {
    if (client.config.api_swgoh_help) {
        // Set up the caching
        const MongoClient = require('mongodb').MongoClient;
        client.mongo = await MongoClient.connect('mongodb://localhost:27017/', { useNewUrlParser: true } );
        client.cache = await require('./modules/cache.js')(client.mongo);

        // Load up the api connector/ helpers
        const SwgohHelp = require('api-swgoh-help');
        client.swgoh = new SwgohHelp(client.config.api_swgoh_help);
        client.swgohAPI = require('./modules/swapi.js')(client);
    }
    // If we have the magic, use it
    // if (client.config.swgohAPILoc && client.config.swgohAPILoc !== "") {
    //     const swgohService = require('./'+client.config.swgohAPILoc);
    //     client.swgohAPI = new swgohService(client.config.swgohSettings);
    // }

    // Here we load **commands** into memory, as a collection, so they're accessible
    // here and everywhere else.
    const cmdFiles = await readdir("./commands/");
    cmdFiles.forEach(f => {
        try {
            const props = new(require(`./commands/${f}`))(client);
            if (f.split(".").slice(-1)[0] !== "js") return;
            if (props.help.category === "SWGoH" && !client.swgohAPI) return;
            client.loadCommand(props.help.name);
        } catch (e) {
            client.log('Init', `Unable to load command ${f}: ${e}`);
        }
    });

    // Then we load events, which will include our message and ready event.
    const evtFiles = await readdir("./events/");
    evtFiles.forEach(file => {
        const eventName = file.split(".")[0];
        const event = require(`./events/${file}`);
        client.on(eventName, event.bind(null, client));
        delete require.cache[require.resolve(`./events/${file}`)];
    });
};

client.on('error', (err) => {
    if (err.error.toString().indexOf('ECONNRESET') > -1) {
        console.log('Connection error');
    } else {
        client.log('ERROR', inspect(err.error));
    }
});

// Make it so it only checks for new characters on the main shard
if (!client.shard || client.shard.id === 0) {
    // ## Here down is to update any characters that need it ##
    setTimeout(updateRemoteData,        1 * 60 * 1000);  // Run it a min after start
    setInterval(updateRemoteData, 12 * 60 * 60 * 1000);  // Then every 12 hours after
    //                            hr   min  sec  mSec

    // Set the patron's goh data to be reloaded
    setTimeout(client.reloadPatrons,    1 * 60 * 1000);   // Load em a min after start
    setInterval(client.reloadPatrons,  60 * 60 * 1000);   // Then every hour after
} else {
    // To reload the characters on any shard other than the main one
    // a bit after it would have grabbed new ones
    setTimeout(function() {
        setInterval(function() {
            delete client.characters;
            client.characters = JSON.parse(fs.readFileSync("data/characters.json"));
        }, 12 * 60 * 60 * 1000);
    }, 2 * 60 * 1000);
}

// init();

function getModType(type) {
    switch (type) {
        case 'CC':
            return 'Critical Chance x2';
        case 'CD':
            return 'Critical Damage x4';
        case 'SPE':
            return 'Speed x4';
        case 'TEN':
            return 'Tenacity x2';
        case 'OFF':
            return 'Offense x4';
        case 'POT':
            return 'Potency x2';
        case 'HP':
            return 'Health x2';
        case 'DEF':
            return 'Defense x2';
        default:
            return '';
    }
}

function saveFile(filePath, jsonData) {
    try {
        fs.writeFileSync(filePath, JSON.stringify(jsonData, null, 4), 'utf8');
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
        console.log('UpdateRemoteData', 'Fetching ' + dataSourceUri);
        const remoteResponse = await snekfetch.get(dataSourceUri);
        const remoteData = JSON.parse(remoteResponse.text);

        try {
            localCache = JSON.parse(fs.readFileSync(localCachePath));
        } catch (err) {
            const reason = err || "unknown error";
            localCache = {};
            console.log('UpdateRemoteData', 'Error reading local cache for ' + dataSourceUri + ', reason: ' + reason);
        }

        if (JSON.stringify(remoteData) !== JSON.stringify(localCache)) {
            saveFile(localCachePath, remoteData);
            updated = true;
        }
    } catch (err) {
        const reason = err || "unknown error";
        return console.log('UpdateRemoteData', 'Unable to update cache for ' + dataSourceUri + ', reason: ' + reason);
    }

    return updated;
}

async function updateRemoteData() {
    // TODO potentially leverage REST end point for google doc farming location spreadsheet (if more accurate / current than swgoh.gg?)
    // https://docs.google.com/spreadsheets/d/1Z0mOMyCctmxXWEU1cLMlDMRDUdw1ocBmWh4poC3RVXg/htmlview#
    // https://script.google.com/macros/s/AKfycbxyzFyyOZvHyLcQcfR6ee8TAJqeuqst7Y-O-oSMNb2wlcnYFrs/exec?isShip=false
    // https://script.google.com/macros/s/AKfycbxyzFyyOZvHyLcQcfR6ee8TAJqeuqst7Y-O-oSMNb2wlcnYFrs/exec?isShip=true

    const currentCharacters = client.characters;
    const currentCharSnapshot = JSON.stringify(currentCharacters);

    const currentShips = client.ships;
    const currentShipSnapshot = JSON.stringify(currentShips);

    console.log('UpdateRemoteData', 'Checking for updates to remote data sources');
    if (await updateIfChanged(GG_SHIPS_CACHE, 'https://swgoh.gg/api/ships/')) {
        console.log('UpdateRemoteData', 'Detected a change in ships from swgoh.gg');
        await updateShips(currentShips);
    }

    if (await updateIfChanged(GG_CHAR_CACHE, 'https://swgoh.gg/api/characters/')) {
        console.log('UpdateRemoteData', 'Detected a change in characters from swgoh.gg');
        // TODO - periodic forced updates to adopt updated minor changes?
        await updateCharacters(currentCharacters);
    }

    if (await updateIfChanged(RANCOR_MOD_CACHE, 'http://apps.crouchingrancor.com/mods/advisor.json')) {
        console.log('UpdateRemoteData', 'Detected a change in mods from Crouching Rancor');
        await updateCharacterMods(currentCharacters);
    }

    if (await updateIfChanged(SWGoH_Help_SQUAD_CACHE, 'https://swgoh.help/data/squads.json')) {
        console.log('UpdatedRemoteData', 'Detected a squad change from swgoh.help.');
    }

    console.log('UpdateRemoteData', 'Finished processing remote updates');
    if (currentCharSnapshot !== JSON.stringify(currentCharacters)) {
        console.log('UpdateRemoteData', 'Changes detected in character data, saving updates and reloading');
        saveFile("./data/characters.json", currentCharacters.sort((a, b) => a.name > b.name ? 1 : -1));
        client.characters = currentCharacters;
    }
    if (currentShipSnapshot !== JSON.stringify(currentShips)) {
        console.log('UpdateRemoteData', 'Changes detected in ship data, saving updates and reloading');
        saveFile("./data/ships.json", currentShips.sort((a, b) => a.name > b.name ? 1 : -1));
        client.ships = currentShips;
    }


}

// async function updateShips() {
//     const ggShipList = JSON.parse(fs.readFileSync(GG_SHIPS_CACHE));
//
//     const currentShips = client.ships;
//
//     for (var ggShipkey in ggShipList) {
//         const ggShip = ggShipList[ggShipkey];
//         // TODO - check for new ships / reconcile data source differences
//     }
// }

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
                    console.log('UpdateRemoteData', 'Automatically reconciling ' + currentShip.name + "'s swgoh.gg url");
                    currentShip.url = ggShip.url;
                    updated = true;
                }
                if (currentShip.uniqueName !== ggShip.base_id) {
                    console.log('UpdateRemoteData', 'Automatically reconciling ' + currentShip.name + "'s swgoh.gg base_id");
                    currentShip.uniqueName = ggShip.base_id;
                    updated = true;
                }
                if (!isSameCharacter(currentShip, ggShip)) {
                    console.log('UpdateRemoteData', 'Automatically reconciling ' + currentShip.name + "'s swgoh.gg name variants");
                    if (!currentShip.nameVariant) {
                        currentShip.nameVariant = [];
                    }
                    currentShip.nameVariant.push(ggShip.name);
                    updated = true;
                }

                //updated = true; // force an update of everything

                if (updated) {
                    console.log('Updated: ' + ggShip.name);
                    // some piece of the data needed reconciling, go ahead and request an update from swgoh.gg
                    // await ggShipGrab(currentShip);
                }
                break;
            }
        }

        if (!found) {
            console.log('Adding: ' + ggShip.name);
            console.log('UpdateRemoteData', 'New ship discovered from swgoh.gg: ' + ggShip.name);
            const newShip = createEmptyShip(ggShip.name, ggShip.url, ggShip.base_id);

            currentShips.push(newShip);

            // queue an update to fill in the empty character's details from swgoh.gg
            // await ggShipGrab(newCharacter);
        }
    }
}

function getCleanString(input) {
    const cleanReg = /['-\s]/g;

    return input.toLowerCase().replace(cleanReg, '');
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
                    console.log('UpdateRemoteData', 'Automatically reconciling ' + currentChar.name + "'s swgoh.gg url");
                    currentChar.url = ggChar.url;
                    updated = true;
                }
                if (currentChar.uniqueName !== ggChar.base_id) {
                    console.log('UpdateRemoteData', 'Automatically reconciling ' + currentChar.name + "'s swgoh.gg base_id");
                    currentChar.uniqueName = ggChar.base_id;
                    updated = true;
                }
                if (!isSameCharacter(currentChar, ggChar)) {
                    console.log('UpdateRemoteData', 'Automatically reconciling ' + currentChar.name + "'s swgoh.gg name variants");
                    if (!currentChar.nameVariant) {
                        currentChar.nameVariant = [];
                    }
                    currentChar.nameVariant.push(ggChar.name);
                    updated = true;
                }

                //updated = true; // force an update of everything

                if (updated) {
                    // some piece of the data needed reconciling, go ahead and request an update from swgoh.gg
                    await ggGrab(currentChar);
                }
                break;
            }
        }

        if (!found) {
            console.log('UpdateRemoteData', 'New character discovered from swgoh.gg: ' + ggChar.name);
            const newCharacter = createEmptyChar(ggChar.name, ggChar.url, ggChar.base_id);

            currentCharacters.push(newCharacter);

            // queue an update to fill in the empty character's details from swgoh.gg
            await ggGrab(newCharacter);
        }
    }
}

async function updateCharacterMods(currentCharacters) {
    const rancorFile = fs.readFileSync(RANCOR_MOD_CACHE);
    const rancorData = JSON.parse(rancorFile);
    const rancorCharacterList = rancorData.data;
    const RANCOR_SOURCE = "Crouching Rancor";

    // clear out old crouching rancor mod advice
    currentCharacters.forEach(currentChar => {
        for (var thisSet in currentChar.mods) {
            const set = currentChar.mods[thisSet];
            if (set.source === RANCOR_SOURCE) {
                delete currentChar.mods[thisSet];
            }
        }
    });

    // iterate the crouching rancor data (may contain currently unknown characters)
    for (var rancorCharKey in rancorCharacterList) {
        const rancorChar = rancorCharacterList[rancorCharKey];

        // skip garbage data
        if (typeof rancorChar.cname === 'undefined') return;

        let found = false;

        const modObject = {
            "sets": [
                getModType(rancorChar.set1),
                getModType(rancorChar.set2),
                getModType(rancorChar.set3)
            ],
            // Take out the space behind any slashes
            "square": rancorChar.square.replace(/\s+\/\s/g, '/ '),
            "arrow": rancorChar.arrow.replace(/\s+\/\s/g, '/ '),
            "diamond": rancorChar.diamond.replace(/\s+\/\s/g, '/ '),
            "triangle": rancorChar.triangle.replace(/\s+\/\s/g, '/ '),
            "circle": rancorChar.circle.replace(/\s+\/\s/g, '/ '),
            "cross": rancorChar.cross.replace(/\s+\/\s/g, '/ '),
            "source": RANCOR_SOURCE
        };

        let setName = '';
        if (rancorChar.name.includes(rancorChar.cname)) {
            setName = rancorChar.name.split(' ').splice(rancorChar.cname.split(' ').length).join(' ');
            if (setName === '') {
                setName = 'General';
            }
        } else {
            setName = rancorChar.name;
        }

        // Make a guess at the character URL in case of poor matchup to swgoh.gg's API by name
        let charLink = 'https://swgoh.gg/characters/';
        const linkName = rancorChar.cname.replace(/[^\w\s-]+/g, '');  // Get rid of non-alphanumeric characters besides dashes
        charLink += linkName.replace(/\s+/g, '-').toLowerCase();  // Get rid of extra spaces, and format em to be dashes
        charLink += '/'; // add trailing slash to be consistent with swgoh.gg's conventions

        // iterate all known characters to find a match
        currentCharacters.forEach(currentChar => {
            if (isSameCharacter(currentChar, rancorChar, "cname") ||
                    (currentChar.url && currentChar.url !== UNKNOWN && currentChar.url === charLink)) {
                found = true;

                if (currentChar.mods[setName]) {
                    setName = rancorChar.name;
                }

                currentChar.mods[setName] = modObject;
                //client.log('NewMods', 'I added a new modset to ' + rancorChar.cname);
            }
        });
        if (!found) {
            // create a new character
            console.log('UpdateRemoteData', 'New character discovered from crouching rancor: ' + rancorChar.cname);
            const newCharacter = createEmptyChar(rancorChar.cname, charLink, UNKNOWN);

            newCharacter.mods[setName] = modObject;

            currentCharacters.push(newCharacter);

            // async fetch character information from swgoh.gg
            await ggGrab(newCharacter);
        }
    }
}

function getEmptyShardLocations() {
    return {
        "dark": [],
        "light": [],
        "cantina": [],
        "shops": []
    };
}

function getEmptyStats() {
    return {
        // Primary
        'Power':0,
        'Strength': 0,
        'Agility':0,
        'Intelligence':0,
        // Offensive
        'Speed': 0,
        'Physical Damage': 0,
        'Physical Critical Rating': 0,
        'Special Damage': 0,
        'Special Critical Rating': 0,
        'Armor Penetration': 0,
        'Resistance Penetration': 0,
        'Potency': 0,
        // Defensive
        'Health': 0,
        'Armor': 0,
        'Resistance': 0,
        'Tenacity': 0,
        'Health Steal': 0,
        'Protection': 0,
        // Activation
        'activation': 0
    };
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
        },
        "defaultMods": {
        },
        "gear": {
        },
        "abilities": {
        },
        "shardLocations": getEmptyShardLocations(),
        "stats": getEmptyStats()
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
        },
        "shardLocations": getEmptyShardLocations()
    };
}

async function ggGrab(character) {
    //console.log('ggGrab', 'Fetching: "' + character.url + '"');
    const charGrab = await snekfetch.get(character.url);
    const ggGrabText = charGrab.text;

    // safety nets in case of entries created by hand
    if (!character.abilities) {
        character.abilities = {};
    }
    if (!character.stats) {
        character.stats = getEmptyStats();
    }

    character.shardLocations = getEmptyShardLocations();
    character.gear = {};

    let $ = cheerio.load(ggGrabText);

    // Get the character's image link
    const charImage = 'https:' + $('.panel-profile-img').attr('src');
    character.avatarURL = charImage;

    // Get the character's affiliations
    let affiliations = [];
    $('.panel-body').each(function() {
        if ($(this).find('h5').text().indexOf('Affiliations') !== -1) {
            affiliations = $(this).text().split('\n').slice(2, -1);  // Splice to get the blank and  the header out
            character.factions = affiliations;
            if (affiliations.indexOf('Light Side') !== -1) {
                character.side = 'light';
                affiliations.splice(affiliations.indexOf('Light Side'), 1);
            } else {
                character.side = 'dark';
                affiliations.splice(affiliations.indexOf('Dark Side'), 1);
            }
        }
    });

    // Get the character's abilities and such
    $('.char-detail-info').each(function() {
        let abilityName = $(this).find('h5').text().trim();    // May have the cooldown included, need to get rid of it
        const desc = $(this).find('p').text().split('\n')[1].trim();
        let abilityMat = $(this).find('img').attr('title').split(' ').join('').trim();
        let abilityType = $(this).find('small').text().trim();
        let cooldown = $(this).find('h5 small').text().trim();
        const selectorId = "#" + $(this).parent().attr('aria-controls');

        // remove cooldown information from the ability name
        const cooldownIndex = abilityName.indexOf(cooldown);
        if (cooldown && cooldownIndex !== -1 && cooldownIndex !== 0) {
            abilityName = abilityName.substring(0, cooldownIndex - 1).trim();
        }
        //console.log('ggGrab', 'After splitting out cooldown text ability: "' + abilityName + '"');
        cooldown = cooldown.split(' ')[0];

        // If the cooldown isn't there, set it to 0
        if (cooldown === '') {
            cooldown = '0';
        }


        // Make sure it grabs the right one to work with the rest
        if (abilityMat === "AbilityMaterialOmega") {
            abilityMat = "omega";
        } else if (abilityMat === "AbilityMaterialMkIII") {
            abilityMat = "abilityMatMK3";
        } else if (abilityMat === "AbilityMaterialZeta") {
            abilityMat = "zeta";
        }

        // Grab the ability type
        if (abilityType.indexOf('Basic') !== -1) {
            abilityType = 'Basic';
        } else if (abilityType.indexOf('Special') !== -1) {
            abilityType = 'Special';
        } else if (abilityType.indexOf('Leader') !== -1) {
            abilityType = 'Leader';
        } else if (abilityType.indexOf('Unique') !== -1) {
            abilityType = 'Unique';
        } else {
            // it's probably a Unique
            abilityType = 'Unique';
        }

        let mk3s = 0, omegas = 0, zetas = 0;
        // Each level of the ability is in a tr
        const aCost = [];
        $(selectorId).find('tr').each(function() {
            // And the cost of each is in the 2nd td in each row
            const lvl = [];
            $(this).find('td').each(function() {
                lvl.push($(this).html());
            });
            aCost.push(lvl[1]);
        });
        aCost.splice(0,2);  // Ignore the first two (Header then default unlock)
        aCost.forEach(lvl => {
            const count = getCount(lvl);
            // console.log('Count1: ' + inspect(count));
            mk3s += count.mk3;
            omegas += count.omega;
            zetas += count.zeta;
            // console.log('Count2: ' + inspect(count));
        });
        //console.log(`${mk3s} MK3, ${omegas} Omegas, ${zetas} Zetas`);

        character.abilities[abilityName] = {
            "type": abilityType,
            "abilityCooldown": cooldown,
            "abilityDesc": desc,
            "tier": abilityMat,
            "cost": {
                'mk3': mk3s,
                'omega': omegas,
                'zeta': zetas
            }
        };
    });

    // Get the stats
    $('.content-container-primary-aside').each(function() {
        $(this).find('.media-body').each(function() {
            const rows = $(this).html().split('\n');

            rows.forEach(stat => {
                if (stat.startsWith('<p></p>') || stat.startsWith('</p>')) {
                    stat = stat.replace(/<p><\/p>/g, '').replace(/^<p>/g, '').replace(/^<\/p>/g, '');
                    stat = stat.replace(/\n/g, '').replace(/\(.*\)/g, '');
                    if (stat.startsWith('<div class="pull-right">')) {
                        stat = stat.replace('<div class="pull-right">', '');
                        const statNum = parseInt(stat.replace(/<\/div>.*/g, ''));
                        const statName = stat.replace(/.*<\/div>/g, '').replace(/\s*$/g, '');
                        if (statName.indexOf('Shards for Activation') > -1) {
                            character.stats.activation = statNum;
                        } else {
                            character.stats[statName] = statNum;
                        }
                    }
                }
            });
        });
    });

    // Get the farming locations
    $(".panel-body:contains('Shard Locations')").each(function() {
        $(this).find('li').each(function() {
            const text = $(this).text();
            if (text.startsWith('Cantina Battles')) {
                const battle = text.replace(/^Cantina Battles: Battle /, '').replace(/\s.*/g, '');
                character.shardLocations.cantina.push(battle);
            } else if (text.startsWith('Dark Side Battles')) {
                const battle = text.replace(/^Dark Side Battles: /, '').replace(/\s.*/g, '');
                character.shardLocations.dark.push(battle);
            } else if (text.startsWith('Light Side Battles')) {
                const battle = text.replace(/^Light Side Battles: /, '').replace(/\s.*/g, '');
                character.shardLocations.dark.push(battle);
            } else if (text.startsWith('Squad Cantina Battle Shipments')) {
                character.shardLocations.shops.push('Cantina Shipments');
            } else if (text.startsWith('Squad Arena Shipments')) {
                character.shardLocations.shops.push('Squad Arena Shipments');
            } else if (text.startsWith('Fleet Store')) {
                character.shardLocations.shops.push('Fleet Store');
            } else if (text.startsWith('Guild Shipments')) {
                character.shardLocations.shops.push('Guild Shipments');
            } else if (text.startsWith('Guild Events Store')) {
                character.shardLocations.shops.push('Guild Events Store');
            } else if (text.startsWith('Galactic War Shipments')) {
                character.shardLocations.shops.push('Galactic War Shipments');
            } else if (text.startsWith('Shard Shop')) {
                character.shardLocations.shops.push('Shard Shop');
            }
        });
    });

    // Grab the gear for the character
    const gearLink = character.url + 'gear';
    const gearGrab = await snekfetch.get(gearLink);
    const gearGrabText = gearGrab.text;

    $ = cheerio.load(gearGrabText);

    // Get the gear
    $('.media.list-group-item.p-0.character').each(function(i) {
        const thisGear = $(this).find('a').attr('title');
        const gearLvl = 'Gear ' + (Math.floor(i / 6) + 1).toString();
        if (character.gear[gearLvl]) {
            character.gear[gearLvl].push(thisGear);
        } else {
            character.gear[gearLvl] = [thisGear];
        }
    });

    console.log('ggGrab', 'Finished fetching swgoh.gg data for ' + character.name);
}

const mk3 = '<img src="//swgoh.gg/static/img/assets/tex.skill_pentagon_white.png" style="width: 25px;">';
const omega = '<img src="//swgoh.gg/static/img/assets/tex.skill_pentagon_gold.png" style="width: 25px;">';
const zeta =  '<img src="//swgoh.gg/static/img/assets/tex.skill_zeta.png" style="width: 25px;">';

// Lvl is the string from each level of the ability
function getCount(lvl) {
    const lvlCost = {
        'mk3': 0,
        'omega': 0,
        'zeta': 0
    };
    if (lvl.indexOf(mk3) > -1) {
        let lvlmk3 = lvl;
        lvlmk3 = lvlmk3.replace(new RegExp(`^.*${mk3} x`), '');
        lvlmk3 = lvlmk3.replace(/\s.*/, '');
        lvlCost.mk3 = parseInt(lvlmk3);
    }
    if (lvl.indexOf(omega) > -1) {
        let lvlomega = lvl;
        lvlomega = lvlomega.replace(new RegExp(`^.*${omega} x`), '');
        lvlomega = lvlomega.replace(/\s.*/, '');
        lvlCost.omega = parseInt(lvlomega);
    }
    if (lvl.indexOf(zeta) > -1) {
        let lvlzeta = lvl;
        lvlzeta = lvlzeta.replace(new RegExp(`^.*${zeta} x`), '');
        lvlzeta = lvlzeta.replace(/\s.*/, '');
        lvlCost.zeta = parseInt(lvlzeta);
    }
    return lvlCost;
}


