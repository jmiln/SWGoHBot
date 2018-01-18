var moment = require('moment-timezone');
require('moment-duration-format');
var yargs = require('yargs');
// var util = require('util');

exports.run = async (client, message, args, level) => {
    const guildSettings = await client.guildSettings.findOne({where: {guildID: message.guild.id}, attributes: ['adminRole', 'enableWelcome', 'useEmbeds', 'welcomeMessage', 'timezone', 'announceChan', 'useEventPages']});
    const guildConf = guildSettings.dataValues;

    const EVENTS_PER_PAGE = 5;

    const guildEvents = await client.guildEvents.findOne({where: {guildID: message.guild.id}, attributes: ['events']});
    var events = guildEvents.dataValues.events;

    const actions = ['create', 'view', 'delete', 'help', 'trigger'];

    if (!events) {
        events = {};
    } else if (Array.isArray(events)) {
        events = {};
    }

    let action = "";
    let eventName = "";
    let eventDay = "";
    let eventTime = "";
    let eventMessage = "";
    let repeatDay = 0;
    let repeatHour = 0;
    let repeatMin = 0;
    let dayList = [];

    if (!args[0] || !actions.includes(args[0].toLowerCase())) return message.channel.send(message.language.COMMAND_EVENT_INVALID_ACTION(actions.join(', '))).then(msg => msg.delete(10000)).catch(console.error);
    action = args[0].toLowerCase();

    if (action === "create" || action === "delete" || action === "trigger") {
        if (level < 3) {  // Permlevel 3 is the adminRole of the server, so anyone under that shouldn't be able to use these
            return message.channel.send(message.language.COMMAND_EVENT_INVALID_PERMS);
        }
    }
    const specialArgs = ['-r', '--rep', '--repeat', '--repeatDay', '--repeatday', '--repday', '--schedule', '--chan', '--channel', '-c', '--countdown', '-d', '--cd'];
    switch (action) {
        case "create": {
            const minArgs = yargs.options({
                'repeat': {
                    alias: ['r', 'rep'],
                    describe: 'Repeat the event on an interval',
                    type: 'string',
                    default: '0'
                },
                'repeatDay': {
                    alias: ['repeatday', 'repday', 'schedule'],
                    describe: 'Repeat the event on set days',
                    type: 'string',
                    default: '0'
                },
                'channel': {
                    alias: ['c', 'chan'],
                    describe: 'Channel to announce the event in',
                    type: 'string',
                    default: ''
                },
                'countdown': {
                    alias: ['d', 'cd'],
                    describe: 'Turn on the countdown',
                    type: 'string',
                    default: 'no'
                }
            }).parse(args);
            args = minArgs['_'];    // The args without the repeat var in there
            let repeatTime = String(minArgs['repeat']);
            const repeatDays = String(minArgs['repeatDay']);
            const eventChan = String(minArgs['channel']);
            const countdownOn = String(minArgs['countdown']);
            const timeReg = /^\d{1,2}d\d{1,2}h\d{1,2}m/i;
            const dayReg  = /^[0-9,]*$/gi;

            // If they try and set a repeat time and a repeating day schedule, tell em to pick just one
            if (repeatDays !== '0' && repeatTime !== '0') {
                return message.channel.send(message.language.COMMAND_EVENT_ONE_REPEAT);
            }

            // If the repeat is set, try to parse it
            if (repeatTime !== '0') {
                if (repeatTime.match(timeReg)) {
                    repeatDay = parseInt(repeatTime.substring(0, repeatTime.indexOf('d')));
                    repeatTime = repeatTime.replace(/^\d{1,2}d/, '');
                    repeatHour = parseInt(repeatTime.substring(0, repeatTime.indexOf('h')));
                    repeatTime = repeatTime.replace(/^\d{1,2}h/, '');
                    repeatMin = parseInt(repeatTime.substring(0, repeatTime.indexOf('m')));
                } else {
                    return message.channel.send(message.language.COMMAND_EVENT_INVALID_REPEAT).then(msg => msg.delete(10000));
                }
            } 

            // If they chose repeatDay, split the days 
            if (repeatDays !== '0') {
                if (repeatDays.match(dayReg)) {
                    dayList = repeatDays.split(',');
                } else {
                    return message.channel.send(message.language.COMMAND_EVENT_USE_COMMAS);
                }
            }

            // Validate countdown parameter
            if (countdownOn !== 'no' && countdownOn !== 'yes') return message.channel.send(`The only valid options for countdown are yes or no.`).then(msg => msg.delete(10000)).catch(console.error);

            // If the event channel is something other than default, check to make sure it works, then set it
            const announceChannel = message.guild.channels.find('name', guildConf['announceChan']);
            if (eventChan !== '') {
                const checkChan = message.guild.channels.find('name', eventChan);
                if (!checkChan) {   // Make sure it's a real channel
                    return message.channel.send(message.language.COMMAND_EVENT_INVALID_CHAN).then(msg => msg.delete(10000));
                } else if (!checkChan.permissionsFor(message.guild.me).has(["SEND_MESSAGES", "VIEW_CHANNEL"])) {   // Make sure it can send messages there
                    return message.channel.send(message.language.COMMAND_EVENT_CHANNEL_NO_PERM(checkChan)).then(msg => msg.delete(10000));
                }
            } else if (!announceChannel) {
                return message.channel.send(message.language.COMMAND_EVENT_NEED_CHAN).then(msg => msg.delete(10000)).catch(console.error);
            }

            if (!args[1]) return message.channel.send(message.language.COMMAND_EVENT_NEED_NAME).then(msg => msg.delete(10000)).catch(console.error);
            eventName = args[1];

            // Check if that name/ event already exists
            if (events.hasOwnProperty(eventName)) return message.channel.send(message.language.COMMAND_EVENT_EVENT_EXISTS).then(msg => msg.delete(10000)).catch(console.error);

            if (!args[2]) return message.channel.send(message.language.COMMAND_EVENT_NEED_DATE).then(msg => msg.delete(10000)).catch(console.error);
            if (!moment(args[2], 'D/M/YYYY').isValid()) {
                return message.channel.send(message.language.COMMAND_EVENT_BAD_DATE(args[2])).then(msg => msg.delete(10000)).catch(console.error);
            } else { // It's valid, go ahead and set it.
                eventDay = moment(args[2], 'D/M/YYYY').format('YYYY-MM-DD');
            }

            if (!args[3]) return message.channel.send(message.language.COMMAND_EVENT_NEED_TIME).then(msg => msg.delete(10000)).catch(console.error);
            if (!moment(args[3], 'H:mm').isValid()) {
                return message.channel.send(message.language.COMMAND_EVEMT_INVALID_TIME).then(msg => msg.delete(10000)).catch(console.error);
            } else { // It's valid, go ahead and set it.
                eventTime = moment(args[3], 'HH:mm').format('HH:mm');
            }

            if (!args[4]) {
                eventMessage = "";
            } else {
                eventMessage = cleanMessage(message, specialArgs);
            }

            eventDate = moment.tz(`${eventDay} ${eventTime}`, 'YYYY-MM-DD HH:mm', guildConf['timezone']);
            if (eventDate.isBefore(moment())) {
                var eventDATE = eventDate.format('D/M/YYYY H:mm');
                var nowDATE = moment().tz(guildConf['timezone']).format('D/M/YYYY H:mm');
                return message.channel.send(message.language.COMMAND_EVENT_PAST_DATE(eventDATE, nowDATE)).then(msg => msg.delete(10000)).catch(console.error);
            }


            const newEvent = {
                "eventDay": eventDay,
                "eventTime": eventTime,
                "eventMessage": eventMessage,
                "eventChan": eventChan,
                "countdown": countdownOn,
                "repeat": {
                    "repeatDay": repeatDay,
                    "repeatHour": repeatHour,
                    "repeatMin": repeatMin
                },
                "repeatDays": dayList
            };
            events[eventName] = newEvent;
            client.guildEvents.update({events: events}, {where: {guildID: message.guild.id}});
            return message.channel.send(message.language.COMMAND_EVENT_CREATED(eventName, moment(eventDate).format('MMM Do YYYY [at] H:mm')));  
        } case "view": {
            const minArgs = yargs.options({
                'min': {
                    alias: ['m', 'minimal', 'minimized'],
                    describe: 'Show the events without the message',
                    type: 'boolean',
                    default: false
                },
                'page': {
                    alias: ['p', 'pages'],
                    describe: 'Choose the page of events you want to see',
                    type: 'number',
                    default: 1
                }
            }).parse(args);
            args = minArgs['_'];
            const array = [];
            if (events) {
                if (args[1]) {
                    // If they are looking to show a specific event
                    if (events[args[1]]) {
                        const thisEvent = events[args[1]];
                        var eventDate = moment.tz(`${thisEvent.eventDay} ${thisEvent.eventTime}`, 'YYYY-MM-DD HH:mm', guildConf['timezone']).format('MMM Do YYYY [at] H:mm');
                        let eventString = message.language.COMMAND_EVENT_TIME(args[1], eventDate);
                        eventString += message.language.COMMAND_EVENT_TIME_LEFT(moment.duration(moment().diff(moment.tz(`${thisEvent.eventDay} ${thisEvent.eventTime}`, 'YYYY-MM-DD HH:mm', guildConf['timezone']), 'minutes') * -1, 'minutes').format("d [days], h [hrs], m [min]"));
                        if (thisEvent.eventChan !== '') {
                            eventString += message.language.COMMAND_EVENT_CHAN(thisEvent.eventChan);
                        }
                        if (thisEvent['repeatDays'].length > 0) {
                            eventString += message.language.COMMAND_EVENT_SCHEDULE(thisEvent.repeatDays.join(', '));
                        } else if (thisEvent['repeat'] && (thisEvent.repeat['repeatDay'] !== 0 || thisEvent.repeat['repeatHour'] !== 0 || thisEvent.repeat['repeatMin'] !== 0)) { // At least one of em is more than 0
                            eventString += message.language.COMMAND_EVENT_REPEAT(thisEvent.repeat['repeatDay'], thisEvent.repeat['repeatHour'], thisEvent.repeat['repeatMin']);
                        }
                        if (!minArgs.min) {
                            // If they want to show all available events without the eventMessage showing
                            eventString += message.language.COMMAND_EVENT_MESSAGE(removeTags(message, thisEvent.eventMessage));
                        }
                        return message.channel.send(eventString);
                    } else {
                        return message.channel.send(message.language.COMMAND_EVENT_UNFOUND_EVENT(args[1]));
                    }
                } else {     
                    // Sort the events by the time/ day
                    let sortedEvents = Object.keys(events).sort((p, c) => moment(`${events[p].eventDay} ${events[p].eventTime}`, 'YYYY-MM-DD HH:mm').diff(moment(`${events[c].eventDay} ${events[c].eventTime}`, 'YYYY-MM-DD HH:mm')));

                    // Grab the total # of events for later use
                    const eventCount = sortedEvents.length;

                    const PAGES_NEEDED = Math.floor(eventCount / EVENTS_PER_PAGE) + 1;
                    if (minArgs.pages < 1) minArgs.pages = 1;
                    if (minArgs.pages > PAGES_NEEDED) minArgs.pages = PAGES_NEEDED;
                    const PAGE_SELECTED = minArgs.pages;

                    if (guildConf['useEventPages']) {
                        // If they have pages enabled, remove everything that isn't within the selected page
                        if (PAGES_NEEDED > 1) {
                            sortedEvents = sortedEvents.slice(EVENTS_PER_PAGE * (PAGE_SELECTED-1), EVENTS_PER_PAGE * PAGE_SELECTED);
                        }
                    }
                    sortedEvents.forEach(key => {
                        const event = events[key];
                        var thisEventDate = moment.tz(`${event.eventDay} ${event.eventTime}`, 'YYYY-MM-DD HH:mm', guildConf['timezone']).format('MMM Do YYYY [at] H:mm');
                        var eventString = message.language.COMMAND_EVENT_TIME(key, thisEventDate);
                        eventString += message.language.COMMAND_EVENT_TIME_LEFT(moment.duration(moment().diff(moment.tz(`${event.eventDay} ${event.eventTime}`, 'YYYY-MM-DD HH:mm', guildConf['timezone']), 'minutes') * -1, 'minutes').format("d [days], h [hrs], m [min]"));
                        if (event.eventChan !== '') {
                            eventString += message.language.COMMAND_EVENT_CHAN(event.eventChan);
                        }
                        if (event['repeatDays'].length > 0) {
                            eventString += message.language.COMMAND_EVENT_SCHEDULE(event.repeatDays.join(', '));
                        } else if (event['repeat'] && (event.repeat['repeatDay'] !== 0 || event.repeat['repeatHour'] !== 0 || event.repeat['repeatMin'] !== 0)) { // At least one of em is more than 0
                            eventString += message.language.COMMAND_EVENT_REPEAT(event.repeat['repeatDay'], event.repeat['repeatHour'], event.repeat['repeatMin']);
                        }
                        if (!minArgs.min) {
                            // If they want to show all available events with the eventMessage showing
                            const msg = removeTags(message, event.eventMessage);
                            eventString += message.language.COMMAND_EVENT_MESSAGE(msg);
                        }
                        array.push(eventString);
                    });
                    var eventKeys = array.join('\n\n');
                    try {
                        if (array.length === 0) {
                            return message.channel.send(message.language.COMMAND_EVENT_NO_EVENT);
                        } else {
                            if (guildConf['useEventPages']) {
                                return message.channel.send(message.language.COMMAND_EVENT_SHOW_PAGED(eventCount, PAGE_SELECTED, PAGES_NEEDED, eventKeys), {split: true});
                            } else {
                                return message.channel.send(message.language.COMMAND_EVENT_SHOW(eventCount, eventKeys), {split: true});
                            }
                        }
                    } catch (e) {
                        client.log('Event View Broke!', eventKeys);
                    }
                }
            }
            break;
        } case "delete": {
            if (!args[1]) return message.channel.send(message.language.COMMAND_EVENT_DELETE_NEED_NAME).then(msg => msg.delete(10000)).catch(console.error);
            eventName = args[1];

            // Check if that name/ event already exists
            if (!events.hasOwnProperty(eventName)) {
                return message.channel.send(message.language.COMMAND_EVENT_UNFOUND_EVENT(eventName)).then(msg => msg.delete(10000)).catch(console.error);
            } else {
                delete events[eventName];
                client.guildEvents.update({events: events}, {where: {guildID: message.guild.id}});
                return message.channel.send(message.language.COMMAND_EVENT_DELETED(eventName));
            }
        } case "trigger": {
            if (!args[1]) return message.channel.send(message.language.COMMAND_EVENT_TRIGGER_NEED_NAME).then(msg => msg.delete(10000)).catch(console.error);
            eventName = args[1];

            // Check if that name/ event already exists
            if (!events.hasOwnProperty(eventName)) {
                return message.channel.send(message.language.COMMAND_EVENT_UNFOUND_EVENT(eventName)).then(msg => msg.delete(10000)).catch(console.error);
            } else {
                var channel = '';
                const event = events[eventName];
                var announceMessage = `**${eventName}**\n${event.eventMessage}`;
                if (event['eventChan'] && event.eventChan !== '') {  // If they've set a channel, try using it
                    channel = message.guild.channels.find('name', event.eventChan);
                } else { // Else, use the default one from their settings
                    channel = message.guild.channels.find('name', guildConf["announceChan"]);
                }
                if (channel && channel.permissionsFor(message.guild.me).has(["SEND_MESSAGES", "VIEW_CHANNEL"])) {
                    try {
                        return channel.send(announceMessage);
                    } catch (e) {
                        client.log('Event trigger Broke!', announceMessage);
                    }
                }
            }
            break;
        }
        case "help": {
            return message.channel.send(message.language.COMMAND_EXTENDED_HELP(this));
        }
    }
};

exports.conf = {
    enabled: true,
    guildOnly: true,
    aliases: ['events'],
    permLevel: 0
};

exports.help = {
    name: 'event',
    category: 'Misc',
    description: 'Used to make or check an event.',
    usage: `event [create] [eventName] [eventDay] [eventTime] [eventMessage]
;event [view|delete|trigger] [eventName]
;event help`,
    extended: `\`\`\`asciidoc
create :: Create a new event listing.
    --repeat|-r  :: Lets you set a duration with the format of 00d00h00m. It will repeat after that time has passed.
    --repeatDay  :: Lets you set it to repeat on set days with the format of 0,0,0,0,0. 
    --channel|-c :: Lets you set a specific channel for the event to announce on.
    --countdown  :: Adds a countdown to when your event will trigger - yes is the only valid parameter
view   :: View your current event listings.
    --min|-m     :: Lets you view the events without the event message
    --page|-p    :: Lets you select a page of events to view
delete :: Delete an event.
trigger:: Trigger an event in the specified channel, leaves the event alone.
help   :: Shows this message.\`\`\``,
    example: 'event create FirstEvent 7/2/2017 13:56 This is my event message'
};

// Remove all special args from the message
function cleanMessage(message, specialArgs) {
    let eventMessage = '';
    let remNext = false;
    const newArgs = message.content.split(' ');
    const newMsg = [];

    for (var ix = 0; ix < newArgs.length; ix++) {
        if (specialArgs.indexOf(newArgs[ix]) > -1) {
            remNext = true;
            if (newArgs[ix].indexOf('\n') > -1) {
                newMsg.push('\n');
            }
        } else if (remNext) {
            remNext = false;
            if (newArgs[ix].indexOf('\n') > -1) {
                newMsg.push('\n');
            }
        } else {
            newMsg.push(newArgs[ix]);
        }
    }
    eventMessage = newMsg.splice(5).join(" ");          // Remove all the beginning args so this is just the message
    eventMessage = eventMessage.replace(/^\s*/, '');    // Remove the annoying space at the begining
    return eventMessage;
}            

function removeTags(message, mess) {
    const userReg = /<@!?(1|\d{17,19})>/g;
    const roleReg = /<@&(1|\d{17,19})>/g;
    const chanReg = /<#(1|\d{17,19})>/g;

    const userResult = mess.match(userReg);
    const roleResult = mess.match(roleReg);
    const chanResult = mess.match(chanReg);
    if (userResult !== null) {
        userResult.forEach(user => {
            const userID = user.replace(/\D/g,'');
            const thisUser = message.guild.members.find('id', userID);
            const userName = thisUser.nickname === null ? `${thisUser.user.username}#${thisUser.user.discriminator}`  : `${thisUser.nickname}#${thisUser.user.discriminator}`;
            mess = mess.replace(user, userName);
        });
    }
    if (roleResult !== null) {
        roleResult.forEach(role => {
            const roleID = role.replace(/\D/g,'');
            const roleName = message.guild.roles.find('id', roleID).name;
            mess = mess.replace(role, `@${roleName}`);
        });
    }
    if (chanResult !== null) {
        chanResult.forEach(chan => {
            const chanID = chan.replace(/\D/g,'');
            const chanName = message.guild.channels.find('id', chanID).name;
            mess = mess.replace(chan, `#${chanName}`);
        });
    }
    mess = mess.replace(/`/g, '');
    return mess;
}
