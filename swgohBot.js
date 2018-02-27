const Discord = require('discord.js');
const { promisify } = require("util");
const { inspect } = require("util");
const readdir = promisify(require("fs").readdir);
const client = new Discord.Client();
const fs = require("fs");
const snekfetch = require('snekfetch');
const cheerio = require('cheerio');

const EnMap = require("enmap");

const Sequelize = require('sequelize');

// Attach the config to the client so we can use it anywhere
client.config = require('./config.json');

// Attach the character and team files to the client so I don't have to reopen em each time
client.characters = JSON.parse(fs.readFileSync("data/characters.json"));
client.ships = JSON.parse(fs.readFileSync("data/ships.json"));
client.teams = JSON.parse(fs.readFileSync("data/teams.json"));

require("./modules/functions.js")(client);

// Languages
client.languages = {};
client.languages.en_US = require('./languages/en-US.js');
client.languages.de_DE = require('./languages/de_DE.js');

client.commands = new EnMap();
client.aliases = new EnMap();

client.seqTypeBool = Sequelize.BOOLEAN;
client.sequelize = new Sequelize(client.config.database.data, client.config.database.user, client.config.database.pass, {
    host: client.config.database.host,
    dialect: 'postgres',
    logging: false,
    operatorAliases: false
});
client.guildSettings = client.sequelize.define('settings', {
    guildID: { type: Sequelize.TEXT, primaryKey: true },
    adminRole: Sequelize.ARRAY(Sequelize.TEXT),
    enableWelcome: Sequelize.BOOLEAN,
    welcomeMessage: Sequelize.TEXT,
    useEmbeds: Sequelize.BOOLEAN,
    timezone: Sequelize.TEXT,
    announceChan: Sequelize.TEXT,
    useEventPages: Sequelize.BOOLEAN,
    language: Sequelize.TEXT
});
client.guildEvents = client.sequelize.define('eventDBs', {
    eventID: { type: Sequelize.TEXT, primaryKey: true }, // guildID-eventName
    eventDT: Sequelize.TEXT,
    eventMessage: Sequelize.TEXT,
    eventChan: Sequelize.TEXT,
    countdown: Sequelize.TEXT,
    repeat: Sequelize.JSONB,
    repeatDays: Sequelize.ARRAY(Sequelize.TEXT)
});
client.commandLogs = client.sequelize.define('commands', {
    id: { type: Sequelize.TEXT, primaryKey: true },  // commandName-userID-messageID
    commandText: Sequelize.TEXT
});
client.changelogs = client.sequelize.define('changelogs', {
    logText: Sequelize.TEXT
});

const init = async () => {
    // Here we load **commands** into memory, as a collection, so they're accessible
    // here and everywhere else.
    const cmdFiles = await readdir("./commands/");
    // client.log("Init", `Loading a total of ${cmdFiles.length} commands.`);
    cmdFiles.forEach(f => {
        try {
            const props = require(`./commands/${f}`);
            if (f.split(".").slice(-1)[0] !== "js") return;
            client.commands.set(props.help.name, props);
            props.conf.aliases.forEach(alias => {
                client.aliases.set(alias, props.help.name);
            });
        } catch (e) {
            client.log('Init', `Unable to load command ${f}: ${e}`);
        }
    });

    // Then we load events, which will include our message and ready event.
    const evtFiles = await readdir("./events/");
    // client.log("Init", `Loading a total of ${evtFiles.length} events.`);
    evtFiles.forEach(file => {
        const eventName = file.split(".")[0];
        const event = require(`./events/${file}`);
        // This line is awesome by the way. Just sayin'.
        client.on(eventName, event.bind(null, client));
        delete require.cache[require.resolve(`./events/${file}`)];
    });

    // Here we login the client.
    client.login(client.config.token);
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
    // Run it one minute after the bot boots
    setTimeout(updateCharacterMods,        1 * 60 * 1000);
    // Check every 12 hours to see if any mods have been changed
    setInterval(updateCharacterMods, 12 * 60 * 60 * 1000);
    //                               hr   min  sec  mSec
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

init();

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


async function updateCharacterMods() {
    const jsonGrab = await snekfetch.get('http://apps.crouchingrancor.com/mods/advisor.json');
    const characterList = JSON.parse(jsonGrab.text).data;

    let updated = false, newChar = false;
    const cleanReg = /['-\s]/g;

    characterList.forEach(async thisChar => {
        if (typeof thisChar.cname === 'undefined') return;
        let found = false;
        const currentCharacters = client.characters;
        
        currentCharacters.forEach(currentChar => {
            if (thisChar.cname.toLowerCase().replace(cleanReg, '') === currentChar.name.toLowerCase().replace(cleanReg, '')) {
                found = true;
                let setName = '';
                if (thisChar.name.includes(thisChar.cname)) {
                    setName = thisChar.name.split(' ').splice(thisChar.cname.split(' ').length).join(' ');
                    if (setName === '') {
                        setName = 'General';
                    }
                } else {
                    setName = thisChar.name;
                }
                if (currentChar.mods[setName]) {
                    setName = thisChar.name;
                }

                // Go through all the variations of mods, and if they're the same,
                // ignore em. If they're different, add it in as a new set
                let newSet = true;
                for (var thisSet in currentChar.mods) {
                    const set = currentChar.mods[thisSet];

                    // Take out the space behind any slashes
                    thisChar.square = thisChar.square.replace(/\s+\/\s/g, '/ ');
                    thisChar.arrow = thisChar.arrow.replace(/\s+\/\s/g, '/ ');
                    thisChar.diamond = thisChar.diamond.replace(/\s+\/\s/g, '/ ');
                    thisChar.triangle = thisChar.triangle.replace(/\s+\/\s/g, '/ ');
                    thisChar.circle = thisChar.circle.replace(/\s+\/\s/g, '/ ');
                    thisChar.cross = thisChar.cross.replace(/\s+\/\s/g, '/ ');

                    if (getModType(thisChar.set1) === set.sets[0] && getModType(thisChar.set2) === set.sets[1] && getModType(thisChar.set3) === set.sets[2] && thisChar.square === set.square && thisChar.arrow === set.arrow && thisChar.diamond === set.diamond && thisChar.triangle === set.triangle && thisChar.circle === set.circle && thisChar.cross === set.cross) {
                        newSet = false;
                        break;
                    }
                }
                if (newSet) {
                    currentChar.mods[setName] = {
                        "sets": [
                            getModType(thisChar.set1),
                            getModType(thisChar.set2),
                            getModType(thisChar.set3)
                        ],
                        "square": thisChar.square,
                        "arrow": thisChar.arrow,
                        "diamond": thisChar.diamond,
                        "triangle": thisChar.triangle,
                        "circle": thisChar.circle,
                        "cross": thisChar.cross
                    };
                    updated = true;
                    client.log('NewMods', 'I added a new modset to ' + thisChar.cname);
                }
            }
        });
        if (!found) {
            // Make a new character here (Maybe grab all the character info from swgoh.gg here too?)
            let setName = '';
            let charLink = 'https://swgoh.gg/characters/';
            const linkName = thisChar.cname.replace(/[^\w\s]+/g, '');  // Get rid of non-alphanumeric characters ('"- etc)
            charLink += linkName.replace(/\s+/g, '-').toLowerCase();  // Get rid of extra spaces, and format em to be dashes

            const newCharacter = await ggGrab(charLink);

            if (thisChar.name.includes(thisChar.cname)) {
                setName = thisChar.name.split(' ').splice(thisChar.cname.split(' ').length).join(' ');
                if (setName === '') {
                    setName = 'General';
                }
            } else {
                setName = thisChar.name;
            }

            // Take out the space behind any slashes
            thisChar.square = thisChar.square.replace(/\s+\/\s/g, '/ ');
            thisChar.arrow = thisChar.arrow.replace(/\s+\/\s/g, '/ ');
            thisChar.diamond = thisChar.diamond.replace(/\s+\/\s/g, '/ ');
            thisChar.triangle = thisChar.triangle.replace(/\s+\/\s/g, '/ ');
            thisChar.circle = thisChar.circle.replace(/\s+\/\s/g, '/ ');
            thisChar.cross = thisChar.cross.replace(/\s+\/\s/g, '/ ');

            newCharacter.mods[setName] = {
                "sets": [
                    getModType(thisChar.set1),
                    getModType(thisChar.set2),
                    getModType(thisChar.set3)
                ],
                "square": thisChar.square,
                "arrow": thisChar.arrow,
                "diamond": thisChar.diamond,
                "triangle": thisChar.triangle,
                "circle": thisChar.circle,
                "cross": thisChar.cross

            };
            newCharacter.name = thisChar.cname;
            newCharacter.aliases = [thisChar.cname];

            currentCharacters.push(newCharacter);
            newChar = true;
            client.log('NewChar', 'Added ' + thisChar.cname);
        }
        // If anything was updated, save it
        if (updated || newChar) {
            updated = false, newChar = false;
            fs.writeFile("./data/characters.json", JSON.stringify(currentCharacters, null, 4), 'utf8', function(err) {
                if (err) {
                    return console.log(err);
                }
                client.characters = currentCharacters;
            });
        }
    });
}

async function ggGrab(charLink) {
    const gearLink = charLink + '/gear';
    const character = {
        "name": "",
        "uniqueName": "",
        "aliases": [],
        "url": charLink,
        "avatarURL": "",
        "side": "",
        "factions": [],
        "mods": {
        },
        "gear": {
        },
        "abilities": {
        },
        "shardLocations": { 
            "dark": [], 
            "light": [], 
            "cantina": [], 
            "shops": [] 
        },
        "stats": {
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
        }
    };

    const ggGrab = await snekfetch.get(charLink);
    const ggGrabText = ggGrab.text;

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
        let abilityName = $(this).find('h5').text();    // May have the cooldown included, need to get rid of it
        let desc = $(this).find('p').text().split('\n')[1];
        let abilityMat = $(this).find('img').attr('title').split(' ').join('');
        let abilityType = $(this).find('small').text();
        let cooldown = $(this).find('h5 small').text().split(' ')[0];

        // Make sure it doesn't have any line returns in there
        if (abilityName.indexOf('\n') !== -1) {
            abilityName = abilityName.replace(/\n/g, '');
        }
        if (desc.indexOf('\n') !== -1) {
            desc = desc.replace(/\n/g, '');
        }
        if (abilityMat.indexOf('\n') !== -1) {
            abilityMat = abilityMat.replace(/\n/g, '');
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
        }
        // If the cooldown isn't there, set it to 0
        if (cooldown === '') {
            cooldown = '0';
        } else {
            abilityName = abilityName.split(' ').slice(0, -3).join(' ').toString();
        }

        character.abilities[abilityName] = {
            "type": abilityType,
            "abilityCooldown": cooldown,
            "abilityDesc": desc,
            "tier": abilityMat,
            "cost": {
                'mk3': 0,
                'omega': 0,
                'zeta': 0
            }
        };
    });


    // Grab the cost for each ability
    $('.list-group-item-ability').each(function() {
        const aName = $(this).find('.ability-mechanics-link').text().replace(/^View /, '').replace(/\sMechanics$/, '');

        let mk3s = 0, omegas = 0, zetas = 0;
        // Each level of the ability is in a tr
        const aCost = [];
        $(this).find('tr').each(function() {
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
        // console.log(`${mk3s} MK3, ${omegas} Omegas, ${zetas} Zetas`);
        character.abilities[aName].cost = {
            'mk3': mk3s,
            'omega': omegas,
            'zeta': zetas
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
    return character;
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

