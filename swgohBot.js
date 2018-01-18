const Discord = require('discord.js');
const { promisify } = require("util");
const { inspect } = require("util");
const readdir = promisify(require("fs").readdir);
const client = new Discord.Client();
const moment = require('moment-timezone');
const fs = require("fs");
const snekfetch = require('snekfetch');
const cheerio = require('cheerio');

const EnMap = require("enmap");

const Sequelize = require('sequelize');

const INTERVAL_SECONDS = 30; // if this goes above 60, you need to alter the checkCountdown function

const site = require('./website');

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
client.guildEvents = client.sequelize.define('events', {
    guildID: { type: Sequelize.TEXT, primaryKey: true },
    events: Sequelize.JSONB
});

const init = async () => {
    // Here we load **commands** into memory, as a collection, so they're accessible
    // here and everywhere else.
    const cmdFiles = await readdir("./commands/");
    client.log("Init", `Loading a total of ${cmdFiles.length} commands.`);
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
    client.log("Init", `Loading a total of ${evtFiles.length} events.`);
    evtFiles.forEach(file => {
        const eventName = file.split(".")[0];
        const event = require(`./events/${file}`);
        // This line is awesome by the way. Just sayin'.
        client.on(eventName, event.bind(null, client));
        delete require.cache[require.resolve(`./events/${file}`)];
    });

    // Here we login the client.
    client.login(client.config.token);

    // End top-level async/await function.

    // Check if the site needs to be loaded, and if so, do it
    if (client.config.dashboard) {
        if (client.config.dashboard.enableSite) {
            // Start the site up
            site.initSite(client);
        }
    }
};

client.on('error', (err) => {
    client.log('ERROR', inspect(err.error));
});

// The function to check every minute for applicable events
async function checkDates() {
    const guildList = client.guilds.keyArray();

    guildList.forEach(async (g) => {
        const thisGuild = client.guilds.get(g);

        const guildSettings = await client.guildSettings.findOne({where: {guildID: g}, attributes: Object.keys(client.config.defaultSettings)});
        const guildConf = guildSettings.dataValues;

        const guildEvents = await client.guildEvents.findOne({where: {guildID: g}, attributes: ['events']});
        var events = guildEvents.dataValues.events;

        if (events) {
            for (var key in events) {
                var event = events[key];

                var eventDate = moment(event.eventDay).format('YYYY-MM-DD');
                var nowDate = moment().tz(guildConf['timezone']).format('YYYY-MM-DD');

                var eventTime = moment(event.eventTime, 'H:mm').format('H:mm');
                var nowTime = moment().tz(guildConf['timezone']).format("H:mm");

                if (!event.repeatDays) {
                    event['repeatDays'] = [];
                    await client.guildEvents.update({events: events}, {where: {guildID: g}});
                } 

                if (eventDate === nowDate && eventTime === nowTime) {
                    var announceMessage = `**${key}**\n${event.eventMessage}`;
                    announceEvent(thisGuild, guildConf, event, announceMessage);
                    
                    // If it's got any left in repeatDays
                    if (event.repeatDays.length > 0) {            
                        
                        let eventMsg = event.eventMessage;
                        // If this is the last time, tack a message to the end to let them know it's the last one
                        if (event.repeatDays.length === 1) {
                            eventMsg += client.languages[guildConf.language].BASE_LAST_EVENT_NOTIFICATOIN;
                        }
                        const newEvent = {
                            "eventDay": moment(event.eventDay, 'YYYY-MM-DD').add(parseInt(event.repeatDays.splice(0, 1)), 'd').format('YYYY-MM-DD'),
                            "eventTime": event.eventTime,
                            "eventMessage": eventMsg,
                            "eventChan": event.eventChan,
                            "countdown": event.countdown,
                            "repeat": {
                                "repeatDay": 0,
                                "repeatHour": 0,
                                "repeatMin": 0
                            },
                            "repeatDays": event.repeatDays
                        };

                        // Gotta delete it before we can add it, so there won't be conflicts
                        delete events[key];
                        events[key] = newEvent;
                    // Else if it's set to repeat 
                    } else if (event['repeat'] && (event.repeat['repeatDay'] !== 0 || event.repeat['repeatHour'] !== 0 || event.repeat['repeatMin'] !== 0)) { // At least one of em is more than 0
                        const newEvent = {
                            "eventDay": moment(event.eventDay, 'YYYY-MM-DD').add(event.repeat['repeatDay'], 'd').format('YYYY-MM-DD'),
                            "eventTime": moment(event.eventTime, 'H:mm').add(event.repeat['repeatHour'], 'h').add(event.repeat['repeatMin'], 'm').format('H:mm'),
                            "eventMessage": event.eventMessage,
                            "eventChan": event.eventChan,
                            "countdown": event.countdown,
                            "repeat": {
                                "repeatDay": event.repeat['repeatDay'],
                                "repeatHour": event.repeat['repeatHour'],
                                "repeatMin": event.repeat['repeatMin']
                            },
                            "repeatDays": []
                        };

                        // Gotta delete it before we can add it, so there won't be conflicts
                        delete events[key];
                        events[key] = newEvent;
                    // Else, it's not supposed to repeat at all, so go ahead and wipe it out
                    } else { 
                        delete events[key];
                    }
                    await client.guildEvents.update({events: events}, {where: {guildID: g}});
                // If the event has passed without being noticed, go ahead and wipe it
                // Probably from the bot crashing during an event, or back during testing
                } else if (moment(eventDate).isBefore(moment(nowDate).subtract(2, 'h'))) {
                    delete events[key];
                    await client.guildEvents.update({events: events}, {where: {guildID: g}});
                }

                // if we have a countdown, see if we need to send a message
                if (event.countdown == 'yes') {
                    checkCountdown(thisGuild, guildConf, key, event);
                }
            }
        }
    });
}

function checkCountdown(thisGuild, guildConf, key, event) {

    // This function is run every INTERVAL_SECONDS - currently every 30 seconds
    // We only want to run this function once per minute
    // So let's make sure that the current number of seconds is less than the interval seconds
    // If INTERVAL_SECONDS goes above 60 i.e. more than a minute, this will break

    var now = moment().tz(guildConf['timezone']);
    if (now.seconds() >= INTERVAL_SECONDS) {
        return;
    }

    // Full event date and time in the correct timezone
    var eventDate = moment.tz(event.eventDay + " " + event.eventTime, "YYYY-MM-DD H:mm", guildConf['timezone']);
    // Full now date and time in the correct timezone with 0 seconds so we can compare against the event date
    var nowDate = moment().tz(guildConf['timezone']).seconds(0);

    // Times in minutes before event
    const timesToCountdown = [ 2880, 1440, 720, 360, 180, 120, 60, 30, 10 ];

    // Loop through all minutes before event start time
    for (var index = 0; index < timesToCountdown.length; ++index) {
        // Get the countdown date to test against
        var countdownDate = moment(eventDate).subtract(timesToCountdown[index], 'minutes');
        // Compare to seconds level of accuracy (ignore milliseconds)
        if (countdownDate.isSame(nowDate, 'seconds')) {
            // We should trigger this countdown message so create the announcement message of how long to go
            var timeToGo = moment.duration(eventDate.diff(nowDate)).humanize();
            // var announceMessage = client.languages[guildConf].BASE_EVENT_STARTING_IN_MSG(key, timeToGo);
            var announceMessage = client.languages[guildConf.language].BASE_EVENT_STARTING_IN_MSG(key, timeToGo);
            announceEvent(thisGuild, guildConf, event, announceMessage);

            // We matched so we don't have to look any more
            break;
        }
    }
}

function announceEvent(thisGuild, guildConf, event, announceMessage) {
    if (guildConf["announceChan"] != "") {
        if (event['eventChan'] && event.eventChan !== '') { // If they've set a channel, try using it
            client.announceMsg(thisGuild, announceMessage, event.eventChan);
        } else { // Else, use the default one from their settings
            client.announceMsg(thisGuild, announceMessage);
        }
    }
}

// Then every INTERVAL_SECONDS seconds after
setInterval(checkDates, INTERVAL_SECONDS * 1000);

// Run it one minute after the bot boots
setTimeout(updateCharacterMods,        1 * 60 * 1000);
// Check every 12 hours to see if any mods have been changed
setInterval(updateCharacterMods, 12 * 60 * 60 * 1000);
//                               hr   min  sec  mSec

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
        let found = false;
        const currentCharacters = client.characters;
        
        if (thisChar.cname === 'Bohdi Rook') thisChar.cname = 'Bodhi Rook';

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
                if (currentChar[setName]) {
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
