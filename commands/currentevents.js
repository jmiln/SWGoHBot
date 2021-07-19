const Command = require("../base/Command");
const moment = require("moment-timezone");

// To get the dates of any upcoming events if any (Adapted from shittybill#3024's Scorpio)
class CurrentEvents extends Command {
    constructor(Bot) {
        super(Bot, {
            name: "currentevents",
            // enabled: false,
            category: "SWGoH",
            aliases: ["cevents", "ce"],
            permissions: ["EMBED_LINKS"],    // Starts with ['SEND_MESSAGES', 'VIEW_CHANNEL'] so don't need to add them
            flags: {
                heists: {
                    aliases: ["$", "heist"]
                },
                heroic: {
                    aliases: ["hero"]
                }
            }
        });
    }

    async run(Bot, message, [num], options) {
        const FLEET_CHALLENGES = ["shipevent_PRELUDE_ACKBAR", "shipevent_PRELUDE_MACEWINDU", "shipevent_PRELUDE_TARKIN", "shipevent_SC01UPGRADE", "shipevent_SC02TRAINING", "shipevent_SC03TRAINING", "shipevent_SC03ABILITY"];
        const MOD_CHALLENGES = ["restrictedmodbattle_set_1", "restrictedmodbattle_set_2", "restrictedmodbattle_set_3", "restrictedmodbattle_set_4", "restrictedmodbattle_set_5", "restrictedmodbattle_set_6", "restrictedmodbattle_set_7", "restrictedmodbattle_set_8"];
        const DAILY_CHALLENGES = ["challenge_XP", "challenge_CREDIT", "challenge_ABILITYUPGRADEMATERIALS", "challenge_EQUIPMENT_AGILITY", "challenge_EQUIPMENT_INTELLIGENCE", "challenge_EQUIPMENT_STRENGTH"];
        const HEISTS = ["EVENT_CREDIT_HEIST_GETAWAY_V2", "EVENT_TRAINING_DROID_SMUGGLING"];
        const HEROIC = ["progressionevent_PIECES_AND_PLANS", "progressionevent_GRANDMASTERS_TRAINING", "EVENT_HERO_SCAVENGERREY"];
        const EXCLUDE_Strings = ["EVENT_ECONOMY_BH", "SEASON_TEST"];

        const DEF_NUM = 10;
        const lang = message.guildSettings.swgohLanguage;

        let gohEvents = await Bot.swgohAPI.events(lang);
        gohEvents = gohEvents ? gohEvents.events : null;

        if (!gohEvents) {
            return super.error(message, "I couldn't get the current events, please try again in a bit");
        }

        // console.log(gohEvents);
        // console.log(gohEvents.map(e => e.id));

        // Let them specify the max # of events to show
        let eNum;
        if (!num || isNaN(parseInt(num, 10))) {
            eNum = DEF_NUM;
        } else {
            eNum = parseInt(num, 10);
        }


        let filter = [];
        const excludeFilter = [];
        const evOut = [];
        if (options.flags.heists) {
            filter = filter.concat(HEISTS);
        }
        if (options.flags.heroic) {
            filter = filter.concat(HEROIC);
        }
        for (const event of gohEvents) {
            if (event.nameKey === "TERRITORY_TOURNAMENT_EVENT_NAME") {
                event.nameKey = "Territory War";
            }
            if (FLEET_CHALLENGES.includes(event.id) ||
                MOD_CHALLENGES.includes(event.id) ||
                DAILY_CHALLENGES.includes(event.id) ||
                event.id.includes("MOD_SALVAGE")) {
                delete gohEvents.event;
                continue;
            }

            EXCLUDE_Strings.forEach(e => {
                if (event.id.includes(e) || event.nameKey.includes(e)) {
                    excludeFilter.push(event.id);
                }
            });

            if (filter.length) {
                if (filter.indexOf(event.id) < 0) {
                    delete gohEvents.event;
                    continue;
                }
            }

            if (excludeFilter.length) {
                if (excludeFilter.indexOf(event.id) > -1) {
                    delete gohEvents.event;
                    continue;
                }
            }

            // Filter out event dates from the past
            event.schedule = event.instanceList.filter(p => {
                if (!moment().isBefore(moment(p.endTime))) return false;
                return true;
            });

            // Put each event in the array
            event.schedule.forEach(s => {
                event.nameKey = event.nameKey
                    .replace(/\\n/g, " ")
                    .replace(/(\[\/*c*-*\]|\[[\w\d]{6}\])/g,"")
                    /* Comment to stop vim from showing the rest of the file as a comment... */
                    .toProperCase();
                evOut.push({
                    name: (HEROIC.includes(event.id) || event.id === "EVENT_CREDIT_HEIST_GETAWAY_V2") ? `**${event.nameKey}**` : event.nameKey,
                    date: s.startTime
                });
            });
        }

        const fields = [];
        let desc = "`------------------------------`";
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
            desc += `\n\`${moment(event.date).format("M-DD")} |\` ${event.name}`;
        }

        if (fields.length) {
            if (options.defaults) {
                fields.push({
                    name: "Default flags used:",
                    value: Bot.codeBlock(options.defaults)
                });
            }
            return message.channel.send({embeds: [{
                author: {
                    name: message.language.get("COMMAND_CURRENTEVENTS_HEADER")
                },
                color: "#0f0f0f",
                description: message.language.get("COMMAND_CURRENTEVENTS_DESC", count),
                fields: fields
            }]});
        } else if (count > 0) {
            if (options.defaults) {
                fields.push({
                    name: "Default flags used:",
                    value: Bot.codeBlock(options.defaults)
                });
            }
            return message.channel.send({embeds: [{
                author: {
                    name: message.language.get("COMMAND_CURRENTEVENTS_HEADER")
                },
                color: "#0f0f0f",
                description: message.language.get("COMMAND_CURRENTEVENTS_DESC", count) + "\n" + desc + "\n`------------------------------`",
                fields: fields
            }]});
        } else {
            return message.channel.send({content: "No events at this time"});
        }
    }
}

module.exports = CurrentEvents;
