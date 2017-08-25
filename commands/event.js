var moment = require('moment-timezone');

exports.run = (client, message, args, level) => {
    const guildEvents = client.guildEvents;
    const guildSettings = client.guildSettings;

    const guildConf = guildSettings.get(message.guild.id);
    var events = guildEvents.get(message.guild.id);

    const actions = ['create', 'view', 'delete', 'help'];

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

    if (!args[0] || !actions.includes(args[0].toLowerCase())) return message.channel.send(`Valid actions are \`${actions.join(', ')}\`.`).then(msg => msg.delete(10000)).catch(console.error);
    action = args[0].toLowerCase();

    if (action === "create" || action === "delete") {
        if (level < 3) {  // Permlevel 3 is the adminRole of the server, so anyone under that shouldn't be able to use these
            return message.channel.send(`Sorry, but either you're not an admin, or your server leader has not set up the configs.\nYou cannot add or remove an event unless you have the configured admin role.`);
        }
    }

    switch (action) {
        case "create": {
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
                eventMessage = args.splice(4).join(" ");
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
                "eventMessage": eventMessage
            };


            events[eventName] = newEvent;

            var announceChannel = message.guild.channels.find('name', guildConf['announceChan']);
            if (announceChannel) {
                guildEvents.set(message.guild.id, events);
                return message.channel.send(`Event \`${eventName}\` created for ${moment(eventDate).format('MMM Do YYYY [at] H:mm')}`);
            } else {
                return message.channel.send(`ERROR: I need a configured channel to send this to. Configure \`announceChan\` to be able to make events.`).then(msg => msg.delete(10000)).catch(console.error);
            }

        } case "view": {
            const array = [];
            if (events) {
                for (var key in events) {
                    var eventDate = moment.tz(`${events[key].eventDay} ${events[key].eventTime}`, 'YYYY-MM-DD HH:mm', guildConf['timezone']).format('MMM Do YYYY [at] H:mm');
                    array.push(`**${key}:**\nEvent Time: ${eventDate}\nEvent Message: ${events[key].eventMessage}`);
                }
                var eventKeys = array.join('\n\n');
                if (array.length === 0) {
                    return message.channel.send(`You don't currently have any events scheduled.`);
                } else {
                    return message.channel.send(`Here's your server's Event Schedule: \n\n${eventKeys}`);
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
                guildEvents.set(message.guild.id, events);
                return message.channel.send(`Deleted event: ${eventName}`);
            }
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
    description: 'Used to make or check an event',
    usage: 'event [create|view|delete] [eventName] [eventDay] [eventTime] [eventMessage]',
    extended: `\`\`\`md
create :: Create a new event listing.
view   :: View your current event listings.
delete :: Delete an event.
help   :: Shows this message.\`\`\``,
    example: 'event create FirstEvent 7/2/2017 13:56 This is my event message'
};
