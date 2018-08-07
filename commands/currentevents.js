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
            flags: {
                heists: {
                    aliases: ['$', 'heist']
                },
                heroic: {
                    aliases: ['hero']
                }
            }
        });
    }

    async run(client, message, [num], options) {
        const FLEET_CHALLENGES = ['shipevent_PRELUDE_ACKBAR', 'shipevent_PRELUDE_MACEWINDU', 'shipevent_PRELUDE_TARKIN', 'shipevent_SC01UPGRADE', 'shipevent_SC02TRAINING', 'shipevent_SC03TRAINING', 'shipevent_SC03ABILITY'];
        const MOD_CHALLENGES = ['restrictedmodbattle_set_1', 'restrictedmodbattle_set_2', 'restrictedmodbattle_set_3', 'restrictedmodbattle_set_4', 'restrictedmodbattle_set_5', 'restrictedmodbattle_set_6', 'restrictedmodbattle_set_7', 'restrictedmodbattle_set_8'];
        const DAILY_CHALLENGES = ['challenge_XP', 'challenge_CREDIT', 'challenge_ABILITYUPGRADEMATERIALS', 'challenge_EQUIPMENT_AGILITY', 'challenge_EQUIPMENT_INTELLIGENCE', 'challenge_EQUIPMENT_STRENGTH'];
        const HEISTS = ['EVENT_CREDIT_HEIST_GETAWAY_V2', 'EVENT_TRAINING_DROID_SMUGGLING'];
        const HEROIC = ['progressionevent_PIECES_AND_PLANS', 'progressionevent_GRANDMASTERS_TRAINING', 'EVENT_HERO_SCAVENGERREY'];

        const DEF_NUM = 10;
        const lang = message.guildSettings.swgohLanguage;
    
        let gohEvents = null;
        try {
            gohEvents = await client.swgohAPI.events(lang);
            gohEvents = gohEvents.events;
            // console.log(gohEvents.map(e => e.name).join('\n'));
        } catch (e) {
            console.error(e);
        }
        
        // Let them specify the max # of events to show
        let eNum = parseInt(num);
        if (isNaN(eNum)) {
            eNum = DEF_NUM;
        }

        let filter = [];
        const evOut = [];
        if (options.flags.heists) {
            filter = filter.concat(HEISTS);
        }
        if (options.flags.heroic) {
            filter = filter.concat(HEROIC);
        }
        for (const event of gohEvents) {
            if (FLEET_CHALLENGES.includes(event.id) ||
                MOD_CHALLENGES.includes(event.id) ||
                DAILY_CHALLENGES.includes(event.id)) {
                delete gohEvents.event;
                continue;
            }

            if (filter.length) {
                if (filter.indexOf(event.id) < 0) {
                    delete gohEvents.event;
                    continue;
                }
            }

            // Filter out event dates from the past 
            event.schedule = event.schedule.filter(p => {
                if (!moment().isBefore(moment(p.end))) return false;
                return true;
            });

            // Put each event in the array
            event.schedule.forEach(s => {
                evOut.push({
                    name: (HEROIC.includes(event.id) || event.id === 'EVENT_CREDIT_HEIST_GETAWAY_V2') ? `**${event.name}**` : event.name,
                    date: s.start
                });
            });
        }

        const fields = [];
        let desc = '`------------------------------`';
        let count = 0;

        // Sort all the events
        const sortedEvents = evOut.sort((p, c) => p.date - c.date);
        for (const event of sortedEvents) {
            if (count >= eNum) break;
            count ++;
            // Expanded view
            // let enVal = '';
            // if (event.schedule.length) {
            //     if (fields.length >= eNum) break;
            //     event.schedule.forEach((d, ix) => {
            //         enVal += `${ix === 0 ? '' : '\n'}\`` + moment(d.start).format('DD/MM/YYYY') + '`';
            //     });
            //     fields.push({
            //         name: event.name,
            //         value: enVal + '\n`------------------------------`',
            //         inline: true
            //     });
            // }

            // Condensed view
            desc += `\n\`${moment(event.date).format('M-DD')} |\` ${event.name}`;
        }

        if (fields.length) {
            return message.channel.send({embed: {
                author: {
                    name: message.language.get('COMMAND_CURRENTEVENTS_HEADER') 
                },
                color: 0x0f0f0f,
                description: message.language.get('COMMAND_CURRENTEVENTS_DESC', count),
                fields: fields
            }});
        } else if (count > 0) {
            return message.channel.send({embed: {
                author: {
                    name: message.language.get('COMMAND_CURRENTEVENTS_HEADER') 
                },
                color: 0x0f0f0f,
                description: message.language.get('COMMAND_CURRENTEVENTS_DESC', count) + '\n' + desc + '\n`------------------------------`'
            }});
        } else {
            return message.send('No events at this time');
        }
    }
}

module.exports = CurrentEvents;

