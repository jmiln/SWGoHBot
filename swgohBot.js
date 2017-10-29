const Discord = require('discord.js');
const { promisify } = require("util");
// const { inspect } = require("util");
const readdir = promisify(require("fs").readdir);
const client = new Discord.Client();
var moment = require('moment-timezone');
var fs = require("fs");
var snekfetch = require('snekfetch');

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
    useEventPages: Sequelize.BOOLEAN
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

// The function to check every minute for applicable events
async function checkDates() {
    const guildList = client.guilds.keyArray();

    guildList.forEach(async (g) => {
        const thisGuild = client.guilds.get(g);

        const guildSettings = await client.guildSettings.findOne({where: {guildID: g}, attributes: ['adminRole', 'enableWelcome', 'useEmbeds', 'welcomeMessage', 'timezone', 'announceChan']});
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

                if (eventDate === nowDate) {
                    if (eventTime === nowTime) {
                        var announceMessage = `**${key}**\n${event.eventMessage}`;
                        announceEvent(thisGuild, guildConf, event, announceMessage);
                        if (event['repeat'] && (event.repeat['repeatDay'] !== 0 || event.repeat['repeatHour'] !== 0 || event.repeat['repeatMin'] !== 0)) { // At least one of em is more than 0
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
                                }
                            };

                            // Gotta delete it before we can add it, so there won't be conflicts
                            delete events[key];
                            events[key] = newEvent;
                        } else { // Go ahead and wipe it out
                            delete events[key];
                        }
                        client.guildEvents.update({events: events}, {where: {guildID: g}});
                    }
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

    // this function is run every INTERVAL_SECONDS - currently every 30 seconds
    // we only want to run this function once per minute
    // so let's make sure that the current number of seconds is less than the interval seconds
    // if INTERVAL_SECONDS goes above 60 i.e. more than a minute, this will break

    var now = moment().tz(guildConf['timezone']);
    if (now.seconds() >= INTERVAL_SECONDS) {
        return;
    }

    // full event date and time in the correct timezone
    var eventDate = moment.tz(event.eventDay + " " + event.eventTime, "YYYY-MM-DD H:mm", guildConf['timezone']);
    // full now date and time in the correct timezone with 0 seconds so we can compare against the event date
    var nowDate = moment().tz(guildConf['timezone']).seconds(0);

    // times in minutes before event
    const timesToCountdown = [ 2880, 1440, 720, 360, 180, 120, 60, 30, 10 ];

    // loop through all minutes before event start time
    for (var index = 0; index < timesToCountdown.length; ++index) {
        // get the countdown date to test against
        var countdownDate = moment(eventDate).subtract(timesToCountdown[index], 'minutes');
        // compare to seconds level of accuracy (ignore milliseconds)
        if (countdownDate.isSame(nowDate, 'seconds')) {
            // we should trigger this countdown message so create the announcement message of how long to go
            var timeToGo = moment.duration(eventDate.diff(nowDate)).humanize();
            var announceMessage = `**${key}**\nStarting in ${timeToGo}`;
            announceEvent(thisGuild, guildConf, event, announceMessage);

            // we matched so we don't have to look any more
            break;
        }
    }
}

function announceEvent(thisGuild, guildConf, event, announceMessage) {
    if (guildConf["announceChan"] != "") {
        var channel = '';
        if (event['eventChan'] && event.eventChan !== '') { // If they've set a channel, try using it
            channel = thisGuild.channels.find('name', event.eventChan);
        } else { // Else, use the default one from their settings
            channel = thisGuild.channels.find('name', guildConf["announceChan"]);
        }
        if (channel && channel.permissionsFor(thisGuild.me).has(["SEND_MESSAGES", "READ_MESSAGES"])) {
            try {
                channel.send(announceMessage);
            } catch (e) {
                client.log('Event Broke!', announceMessage);
            }
        }
    }
}

// Run it once on start up
// checkDates();

// Then every INTERVAL_SECONDS seconds after
setInterval(checkDates, INTERVAL_SECONDS * 1000);

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
    // console.log(inspect(jsonGrab.text))
    const characterList = JSON.parse(jsonGrab.text).data;
    const currentCharacters = client.characters;

    let updateCount = 0, newCount = 0;
    const cleanReg = /['-\s]/g;

    characterList.forEach(thisChar => {
        // console.log(inspect(thisChar))
        let found = false;
        currentCharacters.forEach(currentChar => {
            // console.log(thisChar.cname + ' = ' + currentChar.name);
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
                // console.log(inspect(currentChar.mods))
                for (var thisSet in currentChar.mods) {
                    const set = currentChar.mods[thisSet];
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
                    updateCount++;
                    // console.log(inspect(currentChar));
                }
            }
        });
        if (!found) {
            // Make a new character here (Maybe grab all the character info from swgoh.gg here too?
            let setName = '';
            if (thisChar.name.includes(thisChar.cname)) {
                setName = thisChar.name.split(' ').splice(thisChar.cname.split(' ').length).join(' ');
                if (setName === '') {
                    setName = 'General';
                }
            } else {
                setName = thisChar.name;
            }
            console.log('SetName: ' + setName);

            const mods ={};
            mods[setName] = {
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

            const newCharacter = {
                "name": thisChar.cname,
                "aliases": [thisChar.cname],
                "url": '',
                "avatarURL": "",
                "side": "",
                "factions": thisChar.families.split(';'),
                mods,
                "gear": {
                },
                "abilities": {
                }
            };
            currentCharacters.push(newCharacter);
            newCount++;
            client.log('NewChar', 'Added ' + thisChar.cname);
        }
    });

    client.log('ModUpdate', `Updated ${updateCount}, created ${newCount}`);

    if (updateCount > 0 || newCount > 0) {
        fs.writeFile("./data/characters.json", JSON.stringify(currentCharacters, null, 4), 'utf8', function(err) {
            if (err) {
                return console.log(err);
            }

            client.log('Saved', "The updated character file was saved!");
            client.characters = currentCharacters;
        });
    }
}

