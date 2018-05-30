const Command = require('../base/Command');
const moment = require('moment');

// To get the dates of any upcoming heists if any (Adapted from shittybill#3024's Scorpio) 
class Heists extends Command {
    constructor(client) {
        super(client, {
            name: 'heists',
            category: "SWGoH",
            aliases: ['heist', '$'],
            permissions: ['EMBED_LINKS'],    // Starts with ['SEND_MESSAGES', 'VIEW_CHANNEL'] so don't need to add them
        });
    }

    async run(client, message) {
        let result = null;              

        try {
            result = await fetchEvents();
        } catch (e) {
            return console.error('Error in fetchEvents: ',e);           
        }

        let embedDescription = '';
        let droid = message.language.get('COMMAND_HEISTS_NOT_SCHEDULED');
        let credit = message.language.get('COMMAND_HEISTS_NOT_SCHEDULED');

        const events = ['EVENT_CREDIT_HEIST_GETAWAY_NAME', 'EVENT_TRAINING_DROID_SMUGGLING_NAME'];
        for (let ix = 0; ix < result.length; ix++) {
            if (events.indexOf(result[ix].nameKey) > -1) {
                for (let jx = 0; jx < result[ix].instanceList.length; jx++) {
                    const eventDate = new Date();
                    if (eventDate.getTime() < result[ix].instanceList[jx].endTime) { 
                        eventDate.setTime( result[ix].instanceList[jx].startTime);
                        if (result[ix].nameKey === events[0]) {
                            credit = `\`${moment(eventDate).format('dddd[, ]MMM Do')}\``;
                        } else {
                            droid = `\`${moment(eventDate).format('dddd[, ]MMM Do')}\``;
                        }
                    }
                }
            }
        }

        embedDescription += message.language.get('COMMAND_HEISTS_CREDIT', credit);
        embedDescription += message.language.get('COMMAND_HEISTS_DROID', droid);
        return message.channel.send({embed: {
            author: {
                name: message.language.get('COMMAND_HEISTS_HEADER')
            },
            description: embedDescription
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

module.exports = Heists;

