const Command = require('../base/Command');
const moment = require('moment');

// To get the dates of any upcoming events if any (Adapted from shittybill#3024's Scorpio) 
class CurrentEvents extends Command {
    constructor(client) {
        super(client, {
            name: 'currentevents',
            category: "SWGoH",
            aliases: ['cevents', 'ce'],
            permissions: ['EMBED_LINKS'],    // Starts with ['SEND_MESSAGES', 'VIEW_CHANNEL'] so don't need to add them
        });
    }

    async run(client, message, [num]) {
        const DEF_NUM = 10;
        const lang = 'ENG_US';
    
        let botClient = null;
        try {
            botClient = await client.swgohAPI.getClient(lang);
        } catch (e) {
            console.error(e);
        }
        
        // Let them specify the max # of events to show
        let eNum = parseInt(num);
        if (isNaN(eNum)) {
            eNum = DEF_NUM;
        }

        const fields = [];
        const sortedEvents = botClient.events.sort((p, c) => parseInt(Math.min(...Array.from(p.schedule, t => t.start))) - parseInt(Math.min(...Array.from(c.schedule, t => t.start))));
        for (const event of sortedEvents) {
            if (event.name.endsWith('MODS')) continue;
            if (event.name.endsWith('_NAME')) event.name = event.name.replace(/_NAME$/, '');
            event.name = event.name
                .replace(/\\n/g, '')
                .replace(/\[.*?\]/g, ' ')
                .replace(/[^a-zA-Z0-9\s'-]+/g, ' ')
                .replace(/\s+/g, ' ')
                .trim()
                .toProperCase();

            if (event.name.startsWith('Fleet')) continue;
            // Filter out event dates from the past 
            event.schedule = event.schedule.filter(p => {
                if (!moment().isBefore(moment(p.end))) return false;
                return true;
            });

            // Sort the dates in the event
            event.schedule = event.schedule.sort((p, c) => p.start - c.start);

            let enVal = '';
            if (event.schedule.length) {
                if (fields.length >= eNum) break;
                event.schedule.forEach((d, ix) => {
                    if (ix === 0) {
                        enVal += '`' + moment(d.start).format('DD/MM/YYYY') + '`';
                    } else {
                        enVal += '\n`' + moment(d.start).format('DD/MM/YYYY') + '`';
                    }
                });
                fields.push({
                    name: event.name,
                    value: enVal + '\n`------------------------------`',
                    inline: true
                });
            }
        }

        if (fields.length) {
            return message.channel.send({embed: {
                author: {
                    name: message.language.get('COMMAND_CURRENTEVENTS_HEADER') 
                },
                color: 0x0f0f0f,
                description: message.language.get('COMMAND_CURRENTEVENTS_DESC', eNum),
                fields: fields
            }});
        } else {
            return message.send('No events at this time');
        }
    }
}

module.exports = CurrentEvents;

