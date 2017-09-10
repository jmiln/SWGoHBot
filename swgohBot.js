const Discord = require('discord.js');
const { promisify } = require("util");
const readdir = promisify(require("fs").readdir);
const EnMap = require("enmap");
const client = new Discord.Client();
var moment = require('moment-timezone');
var fs = require("fs");

const site = require('./siteSrc/website');

// Attach the config to the client so we can use it anywhere
client.config = require('./config.json');

// Attach the character and team files to the client so I don't have to reopen em each time
client.characters  = JSON.parse(fs.readFileSync("data/characters.json"));
client.ships  = JSON.parse(fs.readFileSync("data/ships.json"));
client.teams = JSON.parse(fs.readFileSync("data/teams.json"));


require("./modules/functions.js")(client);

client.commands = new EnMap();
client.aliases = new EnMap();

client.guildSettings = new EnMap({name: 'guildSettings', persistent: true});
client.guildEvents = new EnMap({name: 'guildEvents', persistent: true});

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

    // Start the site up

    if (client.config.enableSite) {
        site.initSite(client);
    }
};

// The function to check every minute for applicable events
function checkDates() {
    const guildEvents = client.guildEvents;
    const guildList = client.guilds.keyArray();

    guildList.forEach(g => {
        var events = client.guildEvents.get(g);
        var guildConf = client.guildSettings.get(g);
        if (events) {
            for (var key in events) {
                var event = events[key];

                var eventDate = moment(event.eventDay).format('YYYY-MM-DD');
                var nowDate = moment().tz(guildConf['timezone']).format('YYYY-MM-DD');

                var eventTime = moment(event.eventTime, 'H:mm').format('H:mm');
                var nowTime = moment().tz(guildConf['timezone']).format("H:mm");

                if (eventDate === nowDate) {
                    if (eventTime === nowTime) {
                        var announceMessage = `Event alert for \`${key}\`.\n**Event Message:** ${event.eventMessage}`;
                        if (guildConf["announceChan"] != "") {
                            const thisGuild = client.guilds.get(g);
                            var channel = '';
                            if (event['eventChan'] && event.eventChan !== '') {  // If they've set a channel, try using it
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
                        if (event['repeat'] && (event.repeat['repeatDay'] !== 0 || event.repeat['repeatHour'] !== 0 || event.repeat['repeatMin'] !== 0)) { // At least one of em is more than 0
                            const newEvent = {
                                "eventDay": moment(event.eventDay, 'YYYY-MM-DD').add(event.repeat['repeatDay'], 'd').format('YYYY-MM-DD'),
                                "eventTime": moment(event.eventTime, 'H:mm').add(event.repeat['repeatHour'], 'h').add(event.repeat['repeatMin'], 'm').format('H:mm'),
                                "eventMessage": event.eventMessage,
                                "eventChan": event.eventChan,
                                "repeat": {
                                    "repeatDay": event.repeat['repeatDay'],
                                    "repeatHour": event.repeat['repeatHour'],
                                    "repeatMin": event.repeat['repeatMin']
                                }
                            };

                            // Gotta delete it before we can add it, so there won't be conflicts
                            delete events[key];
                            events[key] = newEvent;
                        } else {  // Go ahead and wipe it out
                            delete events[key];
                        }
                        guildEvents.set(g, events);
                    }
                }
            }
        }
    });
}

// Run it once on start up
checkDates();

// Then every 30 seconds after
setInterval(checkDates, 30 * 1000);

init();
