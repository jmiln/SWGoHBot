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
        let result = null;              
        const fields = [];
        try {
            result = await fetchEvents();
        } catch (e) {
            return console.error('Error in fetchEvents: ' + e);           
        }

        // Let them specify the max # of events to show
        let eNum = parseInt(num);
        if (isNaN(eNum)) {
            eNum = DEF_NUM;
        }

        // Get rid of any events we don't want to show up
        const fResult = result.filter(o => {
            if (o.type === 3 && o.nameKey.includes("HERO")) return false;
            if (!o.nameKey || !o.descKey) return false;
            if (!moment().subtract(10, 'd').isBefore(moment(Math.max(...Array.from(o.instanceList, t => t.startTime))))) return false;
            return true;
        });

        // Filter out event dates from the past 
        fResult.forEach(o => {
            o.instanceList = o.instanceList.filter(p => {
                if (!moment().isBefore(moment(p.endTime))) return false;
                return true;
            });
        });

        // Sort all the events so the closest ones show first
        const sResult = fResult.sort((p, c) => parseInt(Math.min(...Array.from(p.instanceList, t => t.startTime))) - parseInt(Math.min(...Array.from(c.instanceList, t => t.startTime))));

        for (let ix = 0; ix < sResult.length && fields.length < eNum; ix++) {
            let nameKey = sResult[ix].nameKey;
            const descKey = sResult[ix].descKey;
            let schedule = '';
            const sortedEvents = sResult[ix].instanceList.sort((p, c) => p.startTime - c.startTime);
            for (let s = 0; s < sortedEvents.length; ++s) {
                schedule += `\`${moment(sortedEvents[s].startTime).format('DD/MM/YYYY')}\`\n`;
            }

            if (schedule.length) { 
                let keyVals = null;
                try {
                    keyVals = await client.sqlQuery(`CALL getEventText(?, ?, ?)`, [nameKey, descKey, lang]);
                    keyVals = keyVals[0];

                    if (!keyVals || !keyVals.length) { 
                        continue; 
                    }
                } catch (e) {
                    console.error(e);
                }

                const field = {};
                field.value = '';                
                for (const keyval of keyVals) {
                    nameKey = nameKey.replace(keyval.id, JSON.parse(keyval.text)).replace(/(\[[/|\S]*\])/g, '');
                    nameKey = nameKey.split("\\n")[0];
                    if (nameKey.match(/\sMODS/)) { 
                        nameKey = null; 
                        break; 
                    }                    
                }
                if (!nameKey) { continue; }
                field.name = nameKey;
                field.value += schedule+'`------------------------------`';
                field.inline = true; 

                fields.push(field);
            }
        }

        return message.channel.send({embed: {
            author: {
                name: message.language.get('COMMAND_CURRENTEVENTS_HEADER') 
            },
            color: 0x0f0f0f,
            description: message.language.get('COMMAND_CURRENTEVENTS_DESC', eNum),
            fields: fields
        }});

        async function fetchEvents() {
            return new Promise( async (resolve, reject) => {
                try {             
                    const rpc = require(`${process.cwd()}/${client.config.swgohAPILoc}/swgohService/swgohAPI/index.js`);//core/swgoh.rpc.js`);
                    const iData = await rpc.initialDataRequest();
                    resolve( iData.gameEventList );
                } catch (e) {     
                    reject(e);    
                }                 
            });                                                                                                                                                                     
        } 
    }
}

module.exports = CurrentEvents;

