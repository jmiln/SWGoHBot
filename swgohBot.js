const Discord = require('discord.js');
const { promisify } = require("util");
// const { inspect } = require("util");
const readdir = promisify(require("fs").readdir);
const client = new Discord.Client();
var moment = require('moment-timezone');
var fs = require("fs");

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

const Op = Sequelize.Op;
client.seqTypeBool = Sequelize.BOOLEAN;
client.sequelize = new Sequelize(client.config.database.data, client.config.database.user, client.config.database.pass, {
    host: client.config.database.host,
    dialect: 'postgres',
    logging: false,
    operatorAliases: Op
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


client.once('ready', () => {
    client.guildSettings.sync();
    client.guildEvents.sync();
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

init();
