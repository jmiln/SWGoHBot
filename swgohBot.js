const Discord = require('discord.js');
const { promisify } = require("util");
const readdir = promisify(require("fs").readdir);
const PersistentCollection = require("djs-collection-persistent");
const client = new Discord.Client();
const util = require('util');
var moment = require('moment-timezone');


// Attach the config to the client so we can use it anywhere
client.config = require('./config.json');

require("./modules/functions.js")(client);

client.commands = new Discord.Collection();
client.aliases = new Discord.Collection();

client.guildSettings = new PersistentCollection({name: 'guildSettings'});
client.guildEvents = new PersistentCollection({name: 'guildEvents'});

const init = async () => {

    // Here we load **commands** into memory, as a collection, so they're accessible
    // here and everywhere else.
    const cmdFiles = await readdir("./commands/");
    client.log("log", `Loading a total of ${cmdFiles.length} commands.`);
    cmdFiles.forEach(f => {
        try {
            const props = require(`./commands/${f}`);
            if(f.split(".").slice(-1)[0] !== "js") return;
            client.commands.set(props.help.name, props);
            props.conf.aliases.forEach(alias => {
                client.aliases.set(alias, props.help.name);
            });
        } catch (e) {
            client.log(`Unable to load command ${f}: ${e}`);
        }
    });

    // Then we load events, which will include our message and ready event.
    const evtFiles = await readdir("./events/");
    client.log("log", `Loading a total of ${evtFiles.length} events.`);
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
};

// The function to check every minute for applicable events
function checkDates() {
    const guildEvents = client.guildEvents;
    const guildList = client.guilds.keyArray();

    guildList.forEach(g => {
        events = guildEvents.get(g);
        guildConf = guildSettings.get(g);
        if (events) {
            for(key in events) {
                event = events[key];
                eventDate = moment(event.eventDay).format('D/M/YYYY');
                nowDate = moment().tz(guildConf['timezone']).format('D/M/YYYY');

                if (eventDate === nowDate) {
                    if(moment(event.eventTime, 'H:mm').format('H:mm') === moment().tz(guildConf['timezone']).format("H:mm")) {
                        announceMessage  = `Event alert for \`${key}\` @here. \n**Event Message:** ${event.eventMessage}`;
                        if(guildConf["announceChan"] != "") {
                            channel = client.guilds.get(g).channels.find('name', guildConf["announceChan"]);
                            if (!channel) {
                                client.guilds.get(g).defaultChannel.send(announceMessage);
                            } else {
                                channel.send(announceMessage);
                            }
                        } else {
                            client.guilds.get(g).defaultChannel.send(announceMessage);
                        }
                        delete events[key];
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
setInterval(checkDates, 30*1000);

init();

