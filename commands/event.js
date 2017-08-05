var moment = require('moment-timezone');

exports.run = (client, message, args) => {
    const guildEvents = client.guildEvents;
    const guildSettings = client.guildSettings;

    if (!message.guild) return message.channel.send(`Sorry, something went wrong, please try again`);

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

    if (!args[0] || !actions.includes(args[0].toLowerCase())) return message.channel.send(`Valid actions are \`${actions.join(', ')}\`.`);
    action = args[0].toLowerCase();

    if (action === "create" || action === "delete") {
        if (message.author.id !== message.guild.owner.id) {
            if (!message.member.roles.has(guildConf["adminRole"])) {
                return message.channel.send(`Sorry, but either you're not an admin, or your server leader has not set up the configs.\nYou cannot add or remove an event unless you have the configured admin role.`);
            }
        }
    }

    switch (action) {
        case "create": {
            if (!args[1]) return message.channel.send(`You must give a name for your event.`);
            eventName = args[1];

            // Check if that name/ event already exists
            if (events.hasOwnProperty(eventName)) return message.channel.send(`That event name already exists. Cannot add it again.`);

            if (!args[2]) return message.channel.send(`You must give a date for your event. Accepted format is \`DD/MM/YYYY\`.`);
            if (!moment(args[2], 'D/M/YYYY').isValid()) {
                return message.channel.send(`${args[2]} is not a valid date. Accepted format is \`DD/MM/YYYY\`.`);
            } else { // It's valid, go ahead and set it.
                eventDay = moment(args[2], 'D/M/YYYY').format('YYYY-MM-DD');
            }

            if (!args[3]) return message.channel.send(`You must give a time for your event.`);
            if (!moment(args[3], 'H:mm').isValid()) {
                return message.channel.send(`You must give a valid time for your event. Accepted format is \`HH:MM\`, using a 24 hour clock. So no AM or PM`);
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
                return message.channel.send(`You cannot set an event in the past. ${eventDATE} is before ${nowDATE}`);
            }

            const newEvent = {
                "eventDay": eventDay,
                "eventTime": eventTime,
                "eventMessage": eventMessage
            };


            events[eventName] = newEvent;

            guildEvents.set(message.guild.id, events);
            return message.channel.send(`Event \`${eventName}\` created for ${moment(eventDate).format('MMM Do YYYY [at] H:mm')}`);
        } case "view": {
            const array = [];
            if (events) {
                for (var key in events) {
                    var eventDate = moment.tz(`${events[key].eventDay} ${events[key].eventTime}`, 'YYYY-MM-DD HH:mm', guildConf['timezone']).format('MMM Do YYYY [at] H:mm');
                    array.push(`**${key}:**\nEvent Time: ${eventDate}\nEvent Message: ${events[key].eventMessage}`);
                }
                var eventKeys = array.join('\n\n');
                if (array.length === 0) {
                    message.channel.send(`You don't currently have any events scheduled.`);
                } else {
                    message.channel.send(`Here's your server's Event Schedule: \n\n${eventKeys}`);
                }
            }
            break;
        } case "delete": {
            if (!args[1]) return message.channel.send(`You must give an event name to delete.`);
            eventName = args[1];

            // Check if that name/ event already exists
            if (!events.hasOwnProperty(eventName)) {
                return message.channel.send(`That event does not exist.`);
            } else {
                delete events[eventName];
                guildEvents.set(message.guild.id, events);
                message.channel.send(`Deleted event: ${eventName}`);
            }
            break;
        }
        case "help": {
            message.channel.send(`**Extended help for ${this.help.name}** \n**Usage**: ${this.help.usage} \n${this.help.extended}`);
        }
    }
};

exports.conf = {
    enabled: true,
    guildOnly: false,
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
