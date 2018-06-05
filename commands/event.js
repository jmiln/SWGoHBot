const momentTZ = require('moment-timezone');
require('moment-duration-format');
// const {inspect} = require('util');

const Command = require('../base/Command');

class Event extends Command {
    constructor(client) {
        super(client, {
            guildOnly: true,
            name: 'event',
            category: 'Misc',
            aliases: ['events'],
            flags: {
                'countdown': {
                    aliases: ['cd']
                },
                'min': {
                    aliases: ['minimal', 'minimize', 'm']
                }
            },
            subArgs: {
                'channel': {
                    aliases: ['c', 'ch', 'chan', 'channel', 'channel']       
                },
                'repeatDay': {
                    aliases: ['repeatday', 'repday', 'rd']
                },
                'repeat': {
                    aliases: ['repeat', 'rep', 'r']
                },
                'schedule': {
                    aliases: ['s']
                },
                'pages': {
                    aliases: ['p', 'page'],
                    default: 0
                }
            }
        });
    }

    async run(client, message, args, options) {
        const level = options.level;

        const maxSize = 1800;
        const guildSettings = await client.guildSettings.findOne({where: {guildID: message.guild.id}, attributes: Object.keys(client.config.defaultSettings)});
        const guildConf = guildSettings.dataValues;

        const EVENTS_PER_PAGE = 5;

        const actions = ['create', 'view', 'delete', 'help', 'trigger'];
        const exampleEvent = {
            "eventID": 'guildID-eventName',
            "eventDT": 1545299520000,
            "eventMessage": 'eventMsg',
            "eventChan": '',
            "countdown": 'no',
            "repeat": {
                "repeatDay": 0,
                "repeatHour": 0,
                "repeatMin": 0
            },
            "repeatDays": 0
        };

        let action = "";
        let eventName = "";
        let eventMessage = "";
        let repeatDay = 0;
        let repeatHour = 0;
        let repeatMin = 0;
        let dayList = [];

        if (!args[0] || !actions.includes(args[0].toLowerCase())) return message.channel.send(message.language.get('COMMAND_EVENT_INVALID_ACTION', actions.join(', '))).then(msg => msg.delete(10000)).catch(console.error);
        action = args.splice(0, 1);
        action = action[0].toLowerCase();

        if (action === "create" || action === "delete" || action === "trigger") {
            if (level < 3) {  // Permlevel 3 is the adminRole of the server, so anyone under that shouldn't be able to use these
                return message.channel.send(message.language.get('COMMAND_EVENT_INVALID_PERMS'));
            }
        }
        // const specialArgs = ['-r', '--rep', '--repeat', '--repeatDay', '--repeatday', '--repday', '--schedule', '--chan', '--channel', '-c', '--countdown', '-d', '--cd'];
        switch (action) {
            case "create": {
                let repeatTime = options.subArgs['repeat'];
                const repeatDays = options.subArgs['repeatDay'];
                const eventChan = options.subArgs['channel'];
                let countdownOn = options.flags['countdown'];
                const timeReg = /^\d{1,2}d\d{1,2}h\d{1,2}m/i;
                const dayReg  = /^[0-9,]*$/gi;
                let msgOut = '';

                // If they try and set a repeat time and a repeating day schedule, tell em to pick just one
                if (repeatDays && repeatTime) {
                    msgOut = message.language.get('COMMAND_EVENT_ONE_REPEAT');
                    if (!msgOut.trim()) {
                        client.log('Trying to send empty message, broke checking for a repeat: ' + message.content);
                    }
                    return message.channel.send(msgOut);
                }

                // If the repeat is set, try to parse it
                if (repeatTime) {
                    if (repeatTime.match(timeReg)) {
                        repeatDay = parseInt(repeatTime.substring(0, repeatTime.indexOf('d')));
                        repeatTime = repeatTime.replace(/^\d{1,2}d/, '');
                        repeatHour = parseInt(repeatTime.substring(0, repeatTime.indexOf('h')));
                        repeatTime = repeatTime.replace(/^\d{1,2}h/, '');
                        repeatMin = parseInt(repeatTime.substring(0, repeatTime.indexOf('m')));
                    } else {
                        msgOut = message.language.get('COMMAND_EVENT_INVALID_REPEAT');
                        if (!msgOut.trim()) {
                            client.log('Trying to send empty message, INVREP: ' + message.content);
                        }
                        return message.channel.send(msgOut);
                    }
                } else {
                    repeatTime = '0';
                }

                if (countdownOn === 'yes') {
                    countdownOn = 'true';
                } else if (countdownOn === 'no') {
                    countdownOn = 'false';
                }

                // If they chose repeatDay, split the days 
                if (repeatDays) {
                    if (repeatDays.match(dayReg)) {
                        dayList = repeatDays.split(',');
                    } else {
                        msgOut = message.language.get('COMMAND_EVENT_USE_COMMAS');
                        if (!msgOut.trim()) {
                            client.log('Trying to send empty message, broke in repeatDay: ' + message.content);
                        }
                        return message.channel.send(msgOut);
                    }
                }

                // If the event channel is something other than default, check to make sure it works, then set it
                const announceChannel = message.guild.channels.find('name', guildConf['announceChan']);
                if (eventChan) {
                    const checkChan = message.guild.channels.find('name', eventChan);
                    if (!checkChan) {   // Make sure it's a real channel
                        msgOut = message.language.get('COMMAND_EVENT_INVALID_CHAN');
                        if (!msgOut.trim()) {
                            client.log('Trying to send empty message, BADCHAN: ' + message.content);
                        }
                        return message.channel.send(msgOut);
                    } else if (!checkChan.permissionsFor(message.guild.me).has(["SEND_MESSAGES", "VIEW_CHANNEL"])) {   // Make sure it can send messages there
                        msgOut = message.language.get('COMMAND_EVENT_CHANNEL_NO_PERM', checkChan);
                        if (!msgOut.trim()) {
                            client.log('Trying to send empty message, NOPERM: ' + message.content);
                        }
                        return message.channel.send(msgOut);
                    }
                } else if (!announceChannel) {
                    msgOut = message.language.get('COMMAND_EVENT_NEED_CHAN');
                    if (!msgOut.trim()) {
                        client.log('Trying to send empty message, NEEDCHAN: ' + message.content);
                    }
                    return message.channel.send(msgOut);
                }

                if (!args[1]) return message.channel.send(message.language.get('COMMAND_EVENT_NEED_NAME')).then(msg => msg.delete(10000)).catch(console.error);
                eventName = args.splice(0,1)[0];

                // Check if that name/ event already exists
                const exists = await client.guildEvents.findOne({where: {eventID: `${message.guild.id}-${eventName}`}})
                    .then(token => token !== null)
                    .then(isUnique => isUnique);
                if (exists) {
                    msgOut = message.language.get('COMMAND_EVENT_EVENT_EXISTS');
                    if (!msgOut.trim()) {
                        client.log('Trying to send empty message, EXISTS: ' + message.content);
                    }
                    return message.channel.send(msgOut);
                }

                if (!args[0]) return message.channel.send(message.language.get('COMMAND_EVENT_NEED_DATE')).then(msg => msg.delete(10000)).catch(console.error);
                const d = args.splice(0,1)[0];
                if (!momentTZ(d, 'D/M/YYYY').isValid()) { 
                    msgOut = message.language.get('COMMAND_EVENT_BAD_DATE', d);
                    if (!msgOut.trim()) {
                        client.log('Trying to send empty message, BADDATE: ' + message.content);
                    }
                    return message.channel.send(msgOut);
                }

                if (!args[0]) return message.channel.send(message.language.get('COMMAND_EVENT_NEED_TIME')).then(msg => msg.delete(10000)).catch(console.error);
                const t = args.splice(0,1)[0];
                if (!momentTZ(t, 'H:mm').isValid()) {
                    msgOut = message.language.get('COMMAND_EVEMT_INVALID_TIME');
                    if (!msgOut.trim()) {
                        client.log('Trying to send empty message, INVTIME: ' + message.content);
                    }
                    return message.channel.send(msgOut);
                }
                const eventDT = momentTZ.tz(`${d} ${t}`, 'DD/MM/YYYY H:mm', guildConf.timezone).unix() * 1000;

                if (!args[0]) {
                    eventMessage = "";
                } else {
                    eventMessage = args.join(' ');
                }
                
                if ((eventMessage.length + eventName.length) > maxSize) {
                    const currentSize = eventMessage.length + eventName.length;
                    msgOut = message.language.get('COMMAND_EVENT_TOO_BIG', currentSize-maxSize);
                    if (!msgOut.trim()) {
                        client.log('Trying to send empty message, TOOBIG: ' + message.content);
                    }
                    return message.channel.send(msgOut);
                }

                if (momentTZ(eventDT).isBefore(momentTZ())) {
                    var eventDATE = momentTZ.tz(eventDT, guildConf.timezone).format('D/M/YYYY H:mm');
                    var nowDATE = momentTZ().tz(guildConf['timezone']).format('D/M/YYYY H:mm');
                    
                    msgOut = message.language.get('COMMAND_EVENT_PAST_DATE', eventDATE, nowDATE);
                    if (!msgOut.trim()) {
                        client.log('Trying to send empty message, PASTTIME: ' + message.content);
                    }
                    return message.channel.send(msgOut);
                }
                const newEvent = {
                    eventID: `${message.guild.id}-${eventName}`,
                    eventDT: eventDT,
                    eventMessage: eventMessage,
                    eventChan: eventChan,
                    countdown: countdownOn,
                    repeat: {
                        "repeatDay": repeatDay,
                        "repeatHour": repeatHour,
                        "repeatMin": repeatMin
                    },
                    repeatDays: dayList
                };
                client.scheduleEvent(newEvent);
                await client.guildEvents.create(newEvent)
                    .then(() => {
                        msgOut = message.language.get('COMMAND_EVENT_CREATED', eventName, momentTZ.tz(eventDT, guildConf.timezone).format('MMM Do YYYY [at] H:mm'));  
                        if (!msgOut.trim()) {
                            client.log('Trying to send empty message, CREATED: ' + message.content);
                        }
                        message.channel.send(msgOut);
                    })
                    .catch(error => { 
                        client.log('ERROR',`Broke trying to create new event \nMessage: ${message.content}\nError: ${error}`); 
                        return message.channel.send(message.language.get('COMMAND_EVENT_NO_CREATE'));  
                    });
                break;
            } case "view": {
                const array = [];
                if (args[0]) {
                    // If they are looking to show a specific event
                    const guildEvents = await client.guildEvents.findOne({where: {eventID: `${message.guild.id}-${args[0]}`}});
                    if (!guildEvents) {
                        return message.channel.send(message.language.get('COMMAND_EVENT_UNFOUND_EVENT', args[1]));
                    }
                    const thisEvent = guildEvents.dataValues; 
                    if (thisEvent) {
                        let eventName = thisEvent.eventID.split('-');
                        eventName.splice(0, 1);
                        eventName = eventName.join('-');
                        const eventDate = momentTZ(parseInt(thisEvent.eventDT)).tz(guildConf.timezone).format('MMM Do YYYY [at] H:mm');
                        
                        let eventString = message.language.get('COMMAND_EVENT_TIME', eventName, eventDate);
                        eventString += message.language.get('COMMAND_EVENT_TIME_LEFT', momentTZ.duration(momentTZ().diff(momentTZ(parseInt(thisEvent.eventDT)), 'minutes') * -1, 'minutes').format("d [days], h [hrs], m [min]"));
                        if (thisEvent.eventChan !== '') {
                            eventString += message.language.get('COMMAND_EVENT_CHAN', thisEvent.eventChan);
                        }
                        if (thisEvent['repeatDays'].length > 0) {
                            eventString += message.language.get('COMMAND_EVENT_SCHEDULE', thisEvent.repeatDays.join(', '));
                        } else if (thisEvent['repeat'] && (thisEvent.repeat['repeatDay'] !== 0 || thisEvent.repeat['repeatHour'] !== 0 || thisEvent.repeat['repeatMin'] !== 0)) { // At least one of em is more than 0
                            eventString += message.language.get('COMMAND_EVENT_REPEAT', thisEvent.repeat['repeatDay'], thisEvent.repeat['repeatHour'], thisEvent.repeat['repeatMin']);
                        }
                        if (!options.flags.min && thisEvent.eventMessage != '') {
                            // If they want to show all available events without the eventMessage showing
                            eventString += message.language.get('COMMAND_EVENT_MESSAGE', removeTags(message, thisEvent.eventMessage));
                        }
                        return message.channel.send(eventString);
                    } else {
                        return message.channel.send(message.language.get('COMMAND_EVENT_UNFOUND_EVENT', args[1]));
                    }
                } else {     
                    // Grab all events for this guild
                    const guildEvents = await client.guildEvents.findAll({where: {eventID: { $like: `${message.guild.id}-%`}}}, {attributes: [Object.keys(exampleEvent)]});
                    const eventList = [];
                    guildEvents.forEach(event => {
                        eventList.push(event.dataValues);
                    });

                    // Sort the events by the time/ day
                    let sortedEvents = eventList.sort((p, c) => p.eventDT - c.eventDT);

                    // Grab the total # of events for later use
                    const eventCount = sortedEvents.length;

                    let PAGE_SELECTED = 1;
                    const PAGES_NEEDED = Math.floor(eventCount / EVENTS_PER_PAGE) + 1;
                    if (guildConf['useEventPages']) {
                        PAGE_SELECTED = options.subArgs.pages;
                        if (PAGE_SELECTED < 1) PAGE_SELECTED = 1;
                        if (PAGE_SELECTED > PAGES_NEEDED) PAGE_SELECTED = PAGES_NEEDED;

                        // If they have pages enabled, remove everything that isn't within the selected page
                        if (PAGES_NEEDED > 1) {
                            sortedEvents = sortedEvents.slice(EVENTS_PER_PAGE * (PAGE_SELECTED-1), EVENTS_PER_PAGE * PAGE_SELECTED);
                        }
                    }
                    sortedEvents.forEach(event => {
                        let eventName = event.eventID.split('-');
                        eventName.splice(0, 1);
                        eventName = eventName.join('-');
                        const eventDate = momentTZ(parseInt(event.eventDT)).tz(guildConf.timezone).format('MMM Do YYYY [at] H:mm');
                        
                        let eventString = message.language.get('COMMAND_EVENT_TIME', eventName, eventDate);
                        eventString += message.language.get('COMMAND_EVENT_TIME_LEFT', momentTZ.duration(momentTZ().diff(momentTZ(parseInt(event.eventDT)), 'minutes') * -1, 'minutes').format("d [days], h [hrs], m [min]"));
                        if (event.eventChan !== '') {
                            eventString += message.language.get('COMMAND_EVENT_CHAN', event.eventChan);
                        }
                        if (event['repeatDays'].length > 0) {
                            eventString += message.language.get('COMMAND_EVENT_SCHEDULE', event.repeatDays.join(', '));
                        } else if (event['repeat'] && (event.repeat['repeatDay'] !== 0 || event.repeat['repeatHour'] !== 0 || event.repeat['repeatMin'] !== 0)) { // At least one of em is more than 0
                            eventString += message.language.get('COMMAND_EVENT_REPEAT', event.repeat['repeatDay'], event.repeat['repeatHour'], event.repeat['repeatMin']);
                        }
                        if (!options.flags.min && event.eventMessage != '') {
                            // If they want to show all available events with the eventMessage showing
                            const msg = removeTags(message, event.eventMessage);
                            eventString += message.language.get('COMMAND_EVENT_MESSAGE', msg);
                        }
                        array.push(eventString);
                    });
                    const evArray = client.msgArray(array, '\n\n');
                    try {
                        if (evArray.length === 0) {
                            return message.channel.send(message.language.get('COMMAND_EVENT_NO_EVENT'));
                        } else {
                            if (evArray.length > 1) {
                                evArray.forEach((evMsg, ix) => {
                                    if (guildConf['useEventPages']) {
                                        return message.channel.send(message.language.get('COMMAND_EVENT_SHOW_PAGED', eventCount, PAGE_SELECTED, PAGES_NEEDED, evMsg), {split: true});
                                    } else {
                                        if (ix === 0) {
                                            return message.channel.send(message.language.get('COMMAND_EVENT_SHOW', eventCount, evMsg), {split: true});
                                        } else {
                                            return message.channel.send(evMsg, {split: true});
                                        }
                                    }
                                });
                            } else {
                                if (guildConf['useEventPages']) {
                                    return message.channel.send(message.language.get('COMMAND_EVENT_SHOW_PAGED',eventCount, PAGE_SELECTED, PAGES_NEEDED, evArray[0]), {split: true});
                                } else {
                                    return message.channel.send(message.language.get('COMMAND_EVENT_SHOW',eventCount, evArray[0]), {split: true});
                                }
                            }
                        }
                    } catch (e) {
                        client.log('Event View Broke!', evArray);
                    }
                }
                break;
            } case "delete": {
                if (!args[0]) return message.channel.send(message.language.get('COMMAND_EVENT_DELETE_NEED_NAME')).then(msg => msg.delete(10000)).catch(console.error);
                eventName = args[0];
                const eventID = `${message.guild.id}-${eventName}`;
               
                // Check if that name/ event exists
                const exists = await client.guildEvents.findOne({where: {eventID: eventID}})
                    .then(token => token !== null)
                    .then(isUnique => isUnique);
                if (exists) {
                    client.deleteEvent(eventID);
                    return message.channel.send(message.language.get('COMMAND_EVENT_DELETED', eventName));
                } else {
                    return message.channel.send(message.language.get('COMMAND_EVENT_UNFOUND_EVENT', eventName)).then(msg => msg.delete(10000)).catch(console.error);
                }
            } case "trigger": {
                if (!args[0]) return message.channel.send(message.language.get('COMMAND_EVENT_TRIGGER_NEED_NAME')).then(msg => msg.delete(10000)).catch(console.error);
                eventName = args[0];

                const exists = await client.guildEvents.findOne({where: {eventID: `${message.guild.id}-${eventName}`}})
                    .then(token => token !== null)
                    .then(isUnique => isUnique);

                // Check if that name/ event already exists
                if (!exists) {
                    return message.channel.send(message.language.get('COMMAND_EVENT_UNFOUND_EVENT', eventName)).then(msg => msg.delete(10000)).catch(console.error);
                } else {
                    const events = await client.guildEvents.findOne({where: {eventID: `${message.guild.id}-${eventName}`}});
                    const event = events.dataValues;
                    var channel = '';
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
                return message.channel.send(client.helpOut(message.language, this));
            }
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
                    const thisUser = message.guild.members.get(userID);
                    const userName = thisUser ? `${thisUser.displayName}` : `${client.users.get(user) ? client.users.get(user).username : 'Unknown User'}`;
                    mess = mess.replace(user, userName);
                });
            }
            if (roleResult !== null) {
                roleResult.forEach(role => {
                    const roleID = role.replace(/\D/g,'');
                    // const roleName = message.guild.roles.find('id', roleID).name;
                    let roleName;
                    try {
                        roleName = message.guild.roles.find('id', roleID).name;
                    } catch (e) {
                        roleName = roleID;
                    }
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
    }
}

module.exports = Event;

