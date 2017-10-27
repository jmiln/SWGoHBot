var moment = require('moment-timezone');
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
        guildEvents.set(message.guild.id, {});
        events = guildEvents.get(message.guild.id);
    } else if (Array.isArray(events)) {
        if (events.length === 0) {
            guildEvents.delete(message.guild.id);
            guildEvents.set(message.guild.id, {});
            events = guildEvents.get(message.guild.id);
        }
    }

    let action = "";
    let eventName = "";
    let eventDay = "";
    let eventTime = "";
    let eventMessage = "";
    let repeatDay = 0;
    let repeatHour = 0;
    let repeatMin = 0;

    if (!args[0] || !actions.includes(args[0].toLowerCase())) return message.channel.send(`Valid actions are \`${actions.join(', ')}\`.`).then(msg => msg.delete(10000)).catch(console.error);
    action = args[0].toLowerCase();

    if (action === "create" || action === "delete" || action === "trigger") {
        if (level < 3) {  // Permlevel 3 is the adminRole of the server, so anyone under that shouldn't be able to use these
            return message.channel.send(`Sorry, but either you're not an admin, or your server leader has not set up the configs.\nYou cannot add or remove an event unless you have the configured admin role.`);
        }
    }

    switch (action) {
        case "create": {
            const minArgs = yargs.options({
                'repeat': {
                    alias: ['rep'],
                    describe: 'Repeat the event',
                    type: 'number',
                    default: 0
                },
                'channel': {
                    describe: 'Channel to announce the event in',
                    type: 'string',
                    default: ''
                },
                'countdown': {
                    alias: ['cd'],
                    describe: 'Turn on the countdown',
                    type: 'string',
                    choices: ['yes', 'no'],
                    default: 'no'
                }
            }).parse(args);
            args = minArgs['_'];    // The args without the repeat var in there
            let repeatTime = String(minArgs['repeat']);
            const eventChan = String(minArgs['channel']);
            const countdownOn = String(minArgs['countdown']);
            const timeReg = /^\d{1,2}d\d{1,2}h\d{1,2}m/i;

            // If the repeat is set to something other than default, try to parse it
            if (repeatTime !== '0') {
                if (repeatTime.match(timeReg)) {
                    repeatDay = parseInt(repeatTime.substring(0, repeatTime.indexOf('d')));
                    repeatTime = repeatTime.replace(/^\d{1,2}d/, '');
                    repeatHour = parseInt(repeatTime.substring(0, repeatTime.indexOf('h')));
                    repeatTime = repeatTime.replace(/^\d{1,2}h/, '');
                    repeatMin = parseInt(repeatTime.substring(0, repeatTime.indexOf('m')));
                } else {
                    return message.channel.send(`The repeat is in the wrong format. Example: \`5d3h8m\` for 5 days, 3 hours, and 8 minutes`).then(msg => msg.delete(10000));
                }
            }

            // validate countdown parameter
            if (countdownOn !== 'no' && countdownOn !== 'yes') return message.channel.send(`The only valid options for countdown are yes or no.`).then(msg => msg.delete(10000)).catch(console.error);

            // If the event channel is something other than default, check to make sure it works, then set it
            const announceChannel = message.guild.channels.find('name', guildConf['announceChan']);
            if (eventChan !== '') {
                const checkChan = message.guild.channels.find('name', eventChan);
                if (!checkChan) {   // Make sure it's a real channel
                    return message.channel.send(`This channel is invalid, please try again`).then(msg => msg.delete(10000));
                } else if (!checkChan.permissionsFor(message.guild.me).has(["SEND_MESSAGES", "READ_MESSAGES"])) {   // Make sure it can send messages there
                    return message.channel.send(`I don't have permission to send messages in ${checkChan}, please choose one where I can`).then(msg => msg.delete(10000));
                }
            } else if (!announceChannel) {
                return message.channel.send(`ERROR: I need a configured channel to send this to. Configure \`announceChan\` to be able to make events.`).then(msg => msg.delete(10000)).catch(console.error);
            }

            if (!args[1]) return message.channel.send(`You must give a name for your event.`).then(msg => msg.delete(10000)).catch(console.error);
            eventName = args[1];

            // Check if that name/ event already exists
            if (events.hasOwnProperty(eventName)) return message.channel.send(`That event name already exists. Cannot add it again.`).then(msg => msg.delete(10000)).catch(console.error);

            if (!args[2]) return message.channel.send(`You must give a date for your event. Accepted format is \`DD/MM/YYYY\`.`).then(msg => msg.delete(10000)).catch(console.error);
            if (!moment(args[2], 'D/M/YYYY').isValid()) {
                return message.channel.send(`${args[2]} is not a valid date. Accepted format is \`DD/MM/YYYY\`.`).then(msg => msg.delete(10000)).catch(console.error);
            } else { // It's valid, go ahead and set it.
                eventDay = moment(args[2], 'D/M/YYYY').format('YYYY-MM-DD');
            }

            if (!args[3]) return message.channel.send(`You must give a time for your event.`).then(msg => msg.delete(10000)).catch(console.error);
            if (!moment(args[3], 'H:mm').isValid()) {
                return message.channel.send(`You must give a valid time for your event. Accepted format is \`HH:MM\`, using a 24 hour clock. So no AM or PM`).then(msg => msg.delete(10000)).catch(console.error);
            } else { // It's valid, go ahead and set it.
                eventTime = moment(args[3], 'HH:mm').format('HH:mm');
            }

            if (!args[4]) {
                eventMessage = "";
            } else {
                const newArgs = message.content.split(' ');
                const specialArgs = ['--channel', '--repeat', '--countdown'];
                let newLen = newArgs.length;
                for (var ix = 0; ix < newLen; ix++) {
                    specialArgs.forEach(specA => {
                        if (newArgs[ix].indexOf(specA) > -1) {
                            newArgs[ix] = newArgs[ix].replace(specA, '');
                            if (newArgs[ix+1].indexOf('\n') > -1) {
                                newArgs[ix+1] = newArgs[ix+1].substring(newArgs[ix+1].indexOf('\n'));
                            } else {
                                newArgs.splice(ix+1, 1);
                                newLen--;
                            }
                        }
                    });
                }
                eventMessage = newArgs.splice(5).join(" ");
            }

            eventDate = moment.tz(`${eventDay} ${eventTime}`, 'YYYY-MM-DD HH:mm', guildConf['timezone']);
            if (eventDate.isBefore(moment())) {
                var eventDATE = eventDate.format('D/M/YYYY H:mm');
                var nowDATE = moment().tz(guildConf['timezone']).format('D/M/YYYY H:mm');
                return message.channel.send(`You cannot set an event in the past. ${eventDATE} is before ${nowDATE}`).then(msg => msg.delete(10000)).catch(console.error);
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
                }
            };
            events[eventName] = newEvent;
            client.guildEvents.update({events: events}, {where: {guildID: message.guild.id}});
            return message.channel.send(`Event \`${eventName}\` created for ${moment(eventDate).format('MMM Do YYYY [at] H:mm')}`);
        } case "view": {
            const minArgs = yargs.options({
                'min': {
                    alias: ['minimal', 'minimized'],
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
                        let eventString = `**${args[1]}** \nEvent Time: ${eventDate}\n`;
                        if (thisEvent.eventChan !== '') {
                            eventString += `Sending on channel: ${thisEvent.eventChan}\n`;
                        }
                        if (thisEvent['repeat'] && (thisEvent.repeat['repeatDay'] !== 0 || thisEvent.repeat['repeatHour'] !== 0 || thisEvent.repeat['repeatMin'] !== 0)) { // At least one of em is more than 0
                            eventString += `Repeating every ${thisEvent.repeat['repeatDay']} days, ${thisEvent.repeat['repeatHour']} hours, and  ${thisEvent.repeat['repeatMin']} minutes\n`;
                        }
                        if (!minArgs.min) {
                            // If they want to show all available events without the eventMessage showing
                            eventString += `Event Message: \n\`\`\`md\n${removeTags(message, thisEvent.eventMessage)}\`\`\``;
                        }
                        return message.channel.send(eventString);
                    } else {
                        return message.channel.send(`Sorry, but I cannot find the event \`${args[1]}\``);
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
                        var eventString = `**${key}:**\nEvent Time: ${thisEventDate}\n`;
                        if (event.eventChan !== '') {
                            eventString += `Sending on channel: ${event.eventChan}\n`;
                        }
                        if (event['repeat'] && (event.repeat['repeatDay'] !== 0 || event.repeat['repeatHour'] !== 0 || event.repeat['repeatMin'] !== 0)) { // At least one of em is more than 0
                            eventString += `Repeating every ${event.repeat['repeatDay']} days, ${event.repeat['repeatHour']} hours, and  ${event.repeat['repeatMin']} minutes\n`;
                        }
                        if (!minArgs.min) {
                            // If they want to show all available events with the eventMessage showing
                            const msg = removeTags(message, event.eventMessage);
                            eventString += `Event Message: \n\`\`\`${msg}\`\`\``;
                        }
                        array.push(eventString);
                    });
                    var eventKeys = array.join('\n\n');
                    try {
                        if (array.length === 0) {
                            return message.channel.send(`You don't currently have any events scheduled.`);
                        } else {
                            if (guildConf['useEventPages']) {
                                return message.channel.send(`Here's your server's Event Schedule \n(${eventCount} total event${eventCount > 1 ? 's' : ''}) Showing page ${PAGE_SELECTED}/${PAGES_NEEDED}: \n${eventKeys}`, {'split': true});
                            } else {
                                return message.channel.send(`Here's your server's Event Schedule \n(${eventCount} total event${eventCount > 1 ? 's' : ''}): \n${eventKeys}`, {'split': true});
                            }
                        }
                    } catch (e) {
                        client.log('Event View Broke!', eventKeys);
                    }
                }
            }
            break;
        } case "delete": {
            if (!args[1]) return message.channel.send(`You must give an event name to delete.`).then(msg => msg.delete(10000)).catch(console.error);
            eventName = args[1];

            // Check if that name/ event already exists
            if (!events.hasOwnProperty(eventName)) {
                return message.channel.send(`That event does not exist.`).then(msg => msg.delete(10000)).catch(console.error);
            } else {
                delete events[eventName];
                client.guildEvents.update({events: events}, {where: {guildID: message.guild.id}});
                return message.channel.send(`Deleted event: ${eventName}`);
            }
        } case "trigger": {
            if (!args[1]) return message.channel.send(`You must give an event name to trigger.`).then(msg => msg.delete(10000)).catch(console.error);
            eventName = args[1];

            // Check if that name/ event already exists
            if (!events.hasOwnProperty(eventName)) {
                return message.channel.send(`That event does not exist.`).then(msg => msg.delete(10000)).catch(console.error);
            } else {
                var channel = '';
                const event = events[eventName];
                var announceMessage = `**${eventName}**\n${event.eventMessage}`;
                if (event['eventChan'] && event.eventChan !== '') {  // If they've set a channel, try using it
                    channel = message.guild.channels.find('name', event.eventChan);
                } else { // Else, use the default one from their settings
                    channel = message.guild.channels.find('name', guildConf["announceChan"]);
                }
                if (channel && channel.permissionsFor(message.guild.me).has(["SEND_MESSAGES", "READ_MESSAGES"])) {
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
            return message.channel.send(`**Extended help for ${this.help.name}** \n**Usage**: ${this.help.usage} \n${this.help.extended}`);
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
    --repeat    :: Lets you set a duration with the format of 00d00h00m. It will repeat after that time has passed.
    --channel   :: Lets you set a specific channel for the event to announce on.
    --countdown :: Adds a countdown to when your event will trigger - yes is the only valid parameter
view   :: View your current event listings.
    --min       :: Lets you view the events without the event message
    --page | -p :: Lets you select a page of events to view
delete :: Delete an event.
trigger:: Trigger an event in the specified channel, leaves the event alone.
help   :: Shows this message.\`\`\``,
    example: 'event create FirstEvent 7/2/2017 13:56 This is my event message'
};


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
